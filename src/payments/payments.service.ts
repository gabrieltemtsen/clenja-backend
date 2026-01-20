import {
    Injectable,
    Logger,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaystackService } from '../paystack/paystack.service';
import { WalletsService } from '../wallets/wallets.service';
import { LedgerService } from '../ledger/ledger.service';
import { Transaction } from '../entities/transaction.entity';
import { WebhookEvent } from '../entities/webhook-event.entity';
import {
    TransactionType,
    TransactionStatus,
    WebhookProvider,
} from '../common/enums';
import {
    generateTransactionReference,
    generateIdempotencyKey,
    nairaToKobo,
} from '../common/utils/reference-generator';

export interface InitializeDepositResult {
    transaction: Transaction;
    authorizationUrl: string;
    accessCode: string;
}

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);

    constructor(
        @InjectRepository(Transaction)
        private readonly transactionRepo: Repository<Transaction>,
        @InjectRepository(WebhookEvent)
        private readonly webhookRepo: Repository<WebhookEvent>,
        private readonly paystackService: PaystackService,
        private readonly walletsService: WalletsService,
        private readonly ledgerService: LedgerService,
    ) { }

    /**
     * Initializes a deposit transaction.
     * Creates a pending transaction and returns Paystack authorization URL.
     */
    async initializeDeposit(
        userId: string,
        email: string,
        amountInNaira: number,
        callbackUrl?: string,
        clientIdempotencyKey?: string,
    ): Promise<InitializeDepositResult> {
        // Get user's wallet
        const wallet = await this.walletsService.getUserWallet(userId);

        const amountInKobo = nairaToKobo(amountInNaira);
        const reference = generateTransactionReference(TransactionType.DEPOSIT);
        const idempotencyKey = clientIdempotencyKey || generateIdempotencyKey();

        // Check for existing transaction with this idempotency key
        const existing = await this.transactionRepo.findOne({
            where: { idempotencyKey },
        });

        if (existing) {
            this.logger.warn(`Duplicate deposit initialization: ${idempotencyKey}`);
            // If we have the Paystack data, return it
            if (existing.providerResponse?.authorization_url) {
                return {
                    transaction: existing,
                    authorizationUrl: existing.providerResponse.authorization_url,
                    accessCode: existing.providerResponse.access_code,
                };
            }
        }

        // Create pending transaction
        const transaction = this.transactionRepo.create({
            reference,
            idempotencyKey,
            type: TransactionType.DEPOSIT,
            status: TransactionStatus.PENDING,
            amount: amountInKobo.toString(),
            initiatedByUserId: userId,
            destinationWalletId: wallet.id,
            metadata: { email },
            description: 'Deposit via Paystack',
        });

        await this.transactionRepo.save(transaction);

        try {
            // Initialize with Paystack
            const paystackResponse = await this.paystackService.initializeTransaction(
                email,
                amountInKobo,
                reference,
                {
                    transaction_id: transaction.id,
                    user_id: userId,
                    wallet_id: wallet.id,
                },
                callbackUrl,
            );

            // Update transaction with Paystack response
            transaction.providerReference = paystackResponse.data.reference;
            transaction.providerResponse = paystackResponse.data;
            await this.transactionRepo.save(transaction);

            this.logger.log(`Deposit initialized: ${reference}`);

            return {
                transaction,
                authorizationUrl: paystackResponse.data.authorization_url,
                accessCode: paystackResponse.data.access_code,
            };
        } catch (error) {
            // Mark transaction as failed
            transaction.status = TransactionStatus.FAILED;
            transaction.failureReason = error.message;
            await this.transactionRepo.save(transaction);
            throw error;
        }
    }

    /**
     * Verifies a deposit and credits the wallet if successful.
     */
    async verifyDeposit(reference: string): Promise<Transaction> {
        // Find the transaction
        let transaction = await this.transactionRepo.findOne({
            where: [
                { reference },
                { providerReference: reference },
            ],
        });

        if (!transaction) {
            throw new NotFoundException('Transaction not found');
        }

        // If already completed, return it
        if (transaction.status === TransactionStatus.COMPLETED) {
            return transaction;
        }

        // Verify with Paystack
        const verifyResponse = await this.paystackService.verifyTransaction(reference);

        // Update provider response
        transaction.providerResponse = verifyResponse.data;
        await this.transactionRepo.save(transaction);

        if (verifyResponse.data.status === 'success') {
            // Credit the wallet
            const result = await this.ledgerService.completePendingTransaction(
                transaction.id,
                verifyResponse.data,
            );
            transaction = result.transaction;

            this.logger.log(`Deposit verified and credited: ${reference}`);
        } else if (verifyResponse.data.status === 'failed') {
            transaction.status = TransactionStatus.FAILED;
            transaction.failureReason = 'Payment failed on Paystack';
            await this.transactionRepo.save(transaction);
        }

        return transaction;
    }

    /**
     * Handles Paystack webhook events.
     */
    async handleWebhook(
        eventType: string,
        eventData: Record<string, any>,
        signature: string,
        rawBody: string,
    ): Promise<void> {
        // Verify signature
        const isValid = this.paystackService.verifyWebhookSignature(rawBody, signature);
        if (!isValid) {
            this.logger.error('Invalid webhook signature');
            throw new BadRequestException('Invalid signature');
        }

        // Create webhook event record (for deduplication and audit)
        const eventId = eventData.id?.toString() || eventData.reference || Date.now().toString();

        // Check for duplicate
        const existing = await this.webhookRepo.findOne({
            where: {
                provider: WebhookProvider.PAYSTACK,
                eventId,
            },
        });

        if (existing?.isProcessed) {
            this.logger.warn(`Duplicate webhook ignored: ${eventId}`);
            return;
        }

        const webhookEvent = this.webhookRepo.create({
            provider: WebhookProvider.PAYSTACK,
            eventType,
            eventId,
            payload: eventData,
            signature,
            isProcessed: false,
        });

        await this.webhookRepo.save(webhookEvent);

        try {
            await this.processWebhookEvent(eventType, eventData);

            // Mark as processed
            webhookEvent.isProcessed = true;
            webhookEvent.processedAt = new Date();
            await this.webhookRepo.save(webhookEvent);

            this.logger.log(`Webhook processed: ${eventType} - ${eventId}`);
        } catch (error) {
            webhookEvent.error = error.message;
            await this.webhookRepo.save(webhookEvent);
            throw error;
        }
    }

    /**
     * Processes specific webhook events.
     */
    private async processWebhookEvent(
        eventType: string,
        eventData: Record<string, any>,
    ): Promise<void> {
        switch (eventType) {
            case 'charge.success':
                await this.handleChargeSuccess(eventData);
                break;

            case 'transfer.success':
                await this.handleTransferSuccess(eventData);
                break;

            case 'transfer.failed':
                await this.handleTransferFailed(eventData);
                break;

            case 'transfer.reversed':
                await this.handleTransferReversed(eventData);
                break;

            default:
                this.logger.warn(`Unhandled webhook event: ${eventType}`);
        }
    }

    /**
     * Handles successful charge (deposit) webhook.
     */
    private async handleChargeSuccess(data: Record<string, any>): Promise<void> {
        const reference = data.reference;

        const transaction = await this.transactionRepo.findOne({
            where: [
                { reference },
                { providerReference: reference },
            ],
        });

        if (!transaction) {
            this.logger.error(`Transaction not found for webhook: ${reference}`);
            return;
        }

        if (transaction.status === TransactionStatus.COMPLETED) {
            this.logger.warn(`Transaction already completed: ${reference}`);
            return;
        }

        // Credit the wallet
        await this.ledgerService.completePendingTransaction(transaction.id, data);
        this.logger.log(`Deposit credited via webhook: ${reference}`);
    }

    /**
     * Handles successful transfer (withdrawal) webhook.
     */
    private async handleTransferSuccess(data: Record<string, any>): Promise<void> {
        const reference = data.reference;

        const transaction = await this.transactionRepo.findOne({
            where: { providerReference: reference },
        });

        if (!transaction) {
            this.logger.error(`Transfer transaction not found: ${reference}`);
            return;
        }

        if (transaction.status === TransactionStatus.COMPLETED) {
            return;
        }

        transaction.status = TransactionStatus.COMPLETED;
        transaction.providerResponse = data;
        await this.transactionRepo.save(transaction);

        this.logger.log(`Withdrawal completed via webhook: ${reference}`);
    }

    /**
     * Handles failed transfer webhook.
     */
    private async handleTransferFailed(data: Record<string, any>): Promise<void> {
        const reference = data.reference;

        const transaction = await this.transactionRepo.findOne({
            where: { providerReference: reference },
        });

        if (!transaction) {
            return;
        }

        // Reverse the debit if already debited
        if (transaction.status === TransactionStatus.PROCESSING) {
            // TODO: Implement reversal logic
            this.logger.error(`Withdrawal failed, needs reversal: ${reference}`);
        }

        transaction.status = TransactionStatus.FAILED;
        transaction.failureReason = data.reason || 'Transfer failed';
        transaction.providerResponse = data;
        await this.transactionRepo.save(transaction);
    }

    /**
     * Handles reversed transfer webhook.
     */
    private async handleTransferReversed(data: Record<string, any>): Promise<void> {
        const reference = data.reference;

        const transaction = await this.transactionRepo.findOne({
            where: { providerReference: reference },
        });

        if (!transaction) {
            return;
        }

        transaction.status = TransactionStatus.REVERSED;
        transaction.providerResponse = data;
        await this.transactionRepo.save(transaction);

        // TODO: Credit back the source wallet
        this.logger.warn(`Transfer reversed: ${reference} - manual intervention may be needed`);
    }
}
