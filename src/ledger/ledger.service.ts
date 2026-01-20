import {
    Injectable,
    Logger,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { Wallet } from '../entities/wallet.entity';
import { Transaction } from '../entities/transaction.entity';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import {
    TransactionType,
    TransactionStatus,
    LedgerDirection,
    Currency,
    WalletStatus,
} from '../common/enums';
import {
    generateTransactionReference,
    generateIdempotencyKey,
} from '../common/utils/reference-generator';

export interface PostTransactionParams {
    type: TransactionType;
    amount: bigint;
    initiatedByUserId: string;
    sourceWalletId?: string;
    destinationWalletId?: string;
    providerReference?: string;
    providerResponse?: Record<string, any>;
    metadata?: Record<string, any>;
    description?: string;
    idempotencyKey?: string;
}

export interface TransactionResult {
    transaction: Transaction;
    ledgerEntries: LedgerEntry[];
}

@Injectable()
export class LedgerService {
    private readonly logger = new Logger(LedgerService.name);

    constructor(
        @InjectRepository(Wallet)
        private readonly walletRepo: Repository<Wallet>,
        @InjectRepository(Transaction)
        private readonly transactionRepo: Repository<Transaction>,
        @InjectRepository(LedgerEntry)
        private readonly ledgerRepo: Repository<LedgerEntry>,
        private readonly dataSource: DataSource,
    ) { }

    /**
     * Posts a deposit transaction (credits destination wallet).
     */
    async postDeposit(
        destinationWalletId: string,
        amount: bigint,
        initiatedByUserId: string,
        providerReference?: string,
        providerResponse?: Record<string, any>,
        metadata?: Record<string, any>,
        idempotencyKey?: string,
    ): Promise<TransactionResult> {
        return this.postTransaction({
            type: TransactionType.DEPOSIT,
            amount,
            initiatedByUserId,
            destinationWalletId,
            providerReference,
            providerResponse,
            metadata,
            description: 'Deposit via Paystack',
            idempotencyKey,
        });
    }

    /**
     * Posts a withdrawal transaction (debits source wallet).
     */
    async postWithdrawal(
        sourceWalletId: string,
        amount: bigint,
        initiatedByUserId: string,
        providerReference?: string,
        providerResponse?: Record<string, any>,
        metadata?: Record<string, any>,
        idempotencyKey?: string,
    ): Promise<TransactionResult> {
        return this.postTransaction({
            type: TransactionType.WITHDRAWAL,
            amount,
            initiatedByUserId,
            sourceWalletId,
            providerReference,
            providerResponse,
            metadata,
            description: 'Withdrawal to bank account',
            idempotencyKey,
        });
    }

    /**
     * Posts an internal transfer (debits source, credits destination).
     */
    async postTransfer(
        sourceWalletId: string,
        destinationWalletId: string,
        amount: bigint,
        initiatedByUserId: string,
        metadata?: Record<string, any>,
        idempotencyKey?: string,
    ): Promise<TransactionResult> {
        return this.postTransaction({
            type: TransactionType.TRANSFER,
            amount,
            initiatedByUserId,
            sourceWalletId,
            destinationWalletId,
            metadata,
            description: 'Internal transfer',
            idempotencyKey,
        });
    }

    /**
     * Core transaction posting with double-entry ledger.
     * Uses database transaction with row-level locking to prevent double-spend.
     */
    async postTransaction(params: PostTransactionParams): Promise<TransactionResult> {
        const {
            type,
            amount,
            initiatedByUserId,
            sourceWalletId,
            destinationWalletId,
            providerReference,
            providerResponse,
            metadata,
            description,
            idempotencyKey = generateIdempotencyKey(),
        } = params;

        // Check for existing transaction with same idempotency key
        const existingTx = await this.transactionRepo.findOne({
            where: { idempotencyKey },
        });

        if (existingTx) {
            if (existingTx.status === TransactionStatus.COMPLETED) {
                this.logger.warn(`Duplicate transaction attempt: ${idempotencyKey}`);
                const entries = await this.ledgerRepo.find({
                    where: { transactionId: existingTx.id },
                });
                return { transaction: existingTx, ledgerEntries: entries };
            }
            if (existingTx.status === TransactionStatus.PENDING) {
                throw new ConflictException('Transaction is already in progress');
            }
        }

        // Validate amount
        if (amount <= 0n) {
            throw new BadRequestException('Amount must be positive');
        }

        // Execute in transaction with locking
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction('SERIALIZABLE');

        try {
            const ledgerEntries: LedgerEntry[] = [];
            const reference = generateTransactionReference(type);

            // Create transaction record
            const transaction = queryRunner.manager.create(Transaction, {
                reference,
                idempotencyKey,
                type,
                status: TransactionStatus.PENDING,
                amount: amount.toString(),
                currency: Currency.NGN,
                initiatedByUserId,
                sourceWalletId,
                destinationWalletId,
                providerReference,
                providerResponse,
                metadata,
                description,
            });

            await queryRunner.manager.save(transaction);

            // Process source wallet (debit)
            if (sourceWalletId) {
                const sourceWallet = await this.getWalletWithLock(queryRunner, sourceWalletId);
                this.validateWalletForDebit(sourceWallet, amount);

                const newBalance = BigInt(sourceWallet.cachedBalance) - amount;
                const debitEntry = queryRunner.manager.create(LedgerEntry, {
                    transactionId: transaction.id,
                    walletId: sourceWalletId,
                    direction: LedgerDirection.DEBIT,
                    amount: amount.toString(),
                    currency: Currency.NGN,
                    balanceAfter: newBalance.toString(),
                });

                await queryRunner.manager.save(debitEntry);
                ledgerEntries.push(debitEntry);

                // Update cached balance
                sourceWallet.cachedBalance = newBalance.toString();
                await queryRunner.manager.save(sourceWallet);
            }

            // Process destination wallet (credit)
            if (destinationWalletId) {
                const destWallet = await this.getWalletWithLock(queryRunner, destinationWalletId);
                this.validateWalletForCredit(destWallet);

                const newBalance = BigInt(destWallet.cachedBalance) + amount;
                const creditEntry = queryRunner.manager.create(LedgerEntry, {
                    transactionId: transaction.id,
                    walletId: destinationWalletId,
                    direction: LedgerDirection.CREDIT,
                    amount: amount.toString(),
                    currency: Currency.NGN,
                    balanceAfter: newBalance.toString(),
                });

                await queryRunner.manager.save(creditEntry);
                ledgerEntries.push(creditEntry);

                // Update cached balance
                destWallet.cachedBalance = newBalance.toString();
                await queryRunner.manager.save(destWallet);
            }

            // Mark transaction as completed
            transaction.status = TransactionStatus.COMPLETED;
            await queryRunner.manager.save(transaction);

            await queryRunner.commitTransaction();

            this.logger.log(`Transaction completed: ${reference}`);
            return { transaction, ledgerEntries };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Transaction failed: ${error.message}`);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Creates a pending transaction (for async operations like withdrawals).
     */
    async createPendingTransaction(params: PostTransactionParams): Promise<Transaction> {
        const {
            type,
            amount,
            initiatedByUserId,
            sourceWalletId,
            destinationWalletId,
            providerReference,
            metadata,
            description,
            idempotencyKey = generateIdempotencyKey(),
        } = params;

        // Check for existing transaction
        const existingTx = await this.transactionRepo.findOne({
            where: { idempotencyKey },
        });

        if (existingTx) {
            return existingTx;
        }

        const reference = generateTransactionReference(type);

        const transaction = this.transactionRepo.create({
            reference,
            idempotencyKey,
            type,
            status: TransactionStatus.PENDING,
            amount: amount.toString(),
            currency: Currency.NGN,
            initiatedByUserId,
            sourceWalletId,
            destinationWalletId,
            providerReference,
            metadata,
            description,
        });

        return this.transactionRepo.save(transaction);
    }

    /**
     * Completes a pending transaction with ledger entries.
     */
    async completePendingTransaction(
        transactionId: string,
        providerResponse?: Record<string, any>,
    ): Promise<TransactionResult> {
        const transaction = await this.transactionRepo.findOne({
            where: { id: transactionId },
        });

        if (!transaction) {
            throw new BadRequestException('Transaction not found');
        }

        if (transaction.status === TransactionStatus.COMPLETED) {
            const entries = await this.ledgerRepo.find({
                where: { transactionId },
            });
            return { transaction, ledgerEntries: entries };
        }

        if (transaction.status !== TransactionStatus.PENDING) {
            throw new BadRequestException(`Cannot complete transaction with status: ${transaction.status}`);
        }

        // Execute with locking
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction('SERIALIZABLE');

        try {
            const ledgerEntries: LedgerEntry[] = [];
            const amount = BigInt(transaction.amount);

            // Process source wallet (debit)
            if (transaction.sourceWalletId) {
                const sourceWallet = await this.getWalletWithLock(queryRunner, transaction.sourceWalletId);
                this.validateWalletForDebit(sourceWallet, amount);

                const newBalance = BigInt(sourceWallet.cachedBalance) - amount;
                const debitEntry = queryRunner.manager.create(LedgerEntry, {
                    transactionId: transaction.id,
                    walletId: transaction.sourceWalletId,
                    direction: LedgerDirection.DEBIT,
                    amount: amount.toString(),
                    currency: Currency.NGN,
                    balanceAfter: newBalance.toString(),
                });

                await queryRunner.manager.save(debitEntry);
                ledgerEntries.push(debitEntry);

                sourceWallet.cachedBalance = newBalance.toString();
                await queryRunner.manager.save(sourceWallet);
            }

            // Process destination wallet (credit)
            if (transaction.destinationWalletId) {
                const destWallet = await this.getWalletWithLock(queryRunner, transaction.destinationWalletId);
                this.validateWalletForCredit(destWallet);

                const newBalance = BigInt(destWallet.cachedBalance) + amount;
                const creditEntry = queryRunner.manager.create(LedgerEntry, {
                    transactionId: transaction.id,
                    walletId: transaction.destinationWalletId,
                    direction: LedgerDirection.CREDIT,
                    amount: amount.toString(),
                    currency: Currency.NGN,
                    balanceAfter: newBalance.toString(),
                });

                await queryRunner.manager.save(creditEntry);
                ledgerEntries.push(creditEntry);

                destWallet.cachedBalance = newBalance.toString();
                await queryRunner.manager.save(destWallet);
            }

            // Update transaction
            transaction.status = TransactionStatus.COMPLETED;
            transaction.providerResponse = providerResponse;
            await queryRunner.manager.save(transaction);

            await queryRunner.commitTransaction();

            this.logger.log(`Pending transaction completed: ${transaction.reference}`);
            return { transaction, ledgerEntries };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Failed to complete pending transaction: ${error.message}`);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Fails a pending transaction.
     */
    async failTransaction(transactionId: string, reason: string): Promise<Transaction> {
        const transaction = await this.transactionRepo.findOne({
            where: { id: transactionId },
        });

        if (!transaction) {
            throw new BadRequestException('Transaction not found');
        }

        transaction.status = TransactionStatus.FAILED;
        transaction.failureReason = reason;

        return this.transactionRepo.save(transaction);
    }

    /**
     * Gets a transaction by reference.
     */
    async getTransactionByReference(reference: string): Promise<Transaction | null> {
        return this.transactionRepo.findOne({ where: { reference } });
    }

    /**
     * Gets a transaction by provider reference.
     */
    async getTransactionByProviderReference(providerReference: string): Promise<Transaction | null> {
        return this.transactionRepo.findOne({ where: { providerReference } });
    }

    /**
     * Gets wallet with row-level lock for updates.
     */
    private async getWalletWithLock(queryRunner: QueryRunner, walletId: string): Promise<Wallet> {
        const wallet = await queryRunner.manager
            .createQueryBuilder(Wallet, 'wallet')
            .setLock('pessimistic_write')
            .where('wallet.id = :walletId', { walletId })
            .getOne();

        if (!wallet) {
            throw new BadRequestException(`Wallet not found: ${walletId}`);
        }

        return wallet;
    }

    /**
     * Validates wallet can be debited.
     */
    private validateWalletForDebit(wallet: Wallet, amount: bigint): void {
        if (wallet.status !== WalletStatus.ACTIVE) {
            throw new BadRequestException(`Wallet is ${wallet.status.toLowerCase()}`);
        }

        const balance = BigInt(wallet.cachedBalance);
        if (balance < amount) {
            throw new BadRequestException('Insufficient balance');
        }
    }

    /**
     * Validates wallet can be credited.
     */
    private validateWalletForCredit(wallet: Wallet): void {
        if (wallet.status === WalletStatus.CLOSED) {
            throw new BadRequestException('Wallet is closed');
        }
    }
}
