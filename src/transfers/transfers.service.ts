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
import { TransferRecipient } from '../entities/transfer-recipient.entity';
import { Transaction } from '../entities/transaction.entity';
import { TransactionType, TransactionStatus } from '../common/enums';
import {
  generateTransactionReference,
  generateIdempotencyKey,
  nairaToKobo,
} from '../common/utils/reference-generator';

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    @InjectRepository(TransferRecipient)
    private readonly recipientRepo: Repository<TransferRecipient>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly paystackService: PaystackService,
    private readonly walletsService: WalletsService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Lists all supported banks.
   */
  async listBanks() {
    const response = await this.paystackService.listBanks();
    return response.data.filter((bank) => bank.active);
  }

  /**
   * Resolves a bank account to get the account name.
   */
  async resolveAccount(accountNumber: string, bankCode: string) {
    const response = await this.paystackService.resolveAccountNumber(
      accountNumber,
      bankCode,
    );

    return {
      accountNumber: response.data.account_number,
      accountName: response.data.account_name,
      bankCode,
    };
  }

  /**
   * Adds a bank account for a user.
   */
  async addBankAccount(
    userId: string,
    accountNumber: string,
    bankCode: string,
    isDefault: boolean = false,
  ): Promise<TransferRecipient> {
    // Check if account already exists for user
    const existing = await this.recipientRepo.findOne({
      where: { userId, accountNumber, bankCode },
    });

    if (existing) {
      if (isDefault && !existing.isDefault) {
        await this.setDefaultAccount(userId, existing.id);
        existing.isDefault = true;
      }
      return existing;
    }

    // Resolve account name from Paystack
    const resolved = await this.resolveAccount(accountNumber, bankCode);

    // Get bank name
    const banks = await this.listBanks();
    const bank = banks.find((b) => b.code === bankCode);
    const bankName = bank?.name || 'Unknown Bank';

    // Create transfer recipient on Paystack
    const paystackResponse = await this.paystackService.createTransferRecipient(
      resolved.accountName,
      accountNumber,
      bankCode,
    );

    // If setting as default, unset other defaults
    if (isDefault) {
      await this.recipientRepo.update(
        { userId, isDefault: true },
        { isDefault: false },
      );
    }

    // Create local record
    const recipient = this.recipientRepo.create({
      userId,
      recipientCode: paystackResponse.data.recipient_code,
      bankCode,
      bankName,
      accountNumber,
      accountName: resolved.accountName,
      isDefault,
      isVerified: true,
    });

    await this.recipientRepo.save(recipient);

    this.logger.log(`Bank account added for user ${userId}: ${accountNumber}`);

    return recipient;
  }

  /**
   * Gets all bank accounts for a user.
   */
  async getUserBankAccounts(userId: string): Promise<TransferRecipient[]> {
    return this.recipientRepo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Gets a specific bank account.
   */
  async getBankAccount(recipientId: string): Promise<TransferRecipient> {
    const recipient = await this.recipientRepo.findOne({
      where: { id: recipientId },
    });

    if (!recipient) {
      throw new NotFoundException('Bank account not found');
    }

    return recipient;
  }

  /**
   * Sets a bank account as default.
   */
  async setDefaultAccount(userId: string, recipientId: string): Promise<void> {
    // Unset all defaults
    await this.recipientRepo.update(
      { userId, isDefault: true },
      { isDefault: false },
    );

    // Set new default
    await this.recipientRepo.update(
      { id: recipientId, userId },
      { isDefault: true },
    );
  }

  /**
   * Deletes a bank account.
   */
  async deleteBankAccount(userId: string, recipientId: string): Promise<void> {
    const result = await this.recipientRepo.delete({
      id: recipientId,
      userId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Bank account not found');
    }
  }

  /**
   * Initiates a withdrawal to a bank account.
   * Debits the wallet first, then initiates transfer with Paystack.
   */
  async initiateWithdrawal(
    userId: string,
    recipientId: string,
    amountInNaira: number,
    reason?: string,
    clientIdempotencyKey?: string,
  ): Promise<Transaction> {
    const wallet = await this.walletsService.getUserWallet(userId);
    const recipient = await this.getBankAccount(recipientId);

    if (recipient.userId !== userId) {
      throw new BadRequestException('Bank account does not belong to user');
    }

    const amountInKobo = nairaToKobo(amountInNaira);
    const balance = await this.walletsService.getBalance(wallet.id);

    if (balance < BigInt(amountInKobo)) {
      throw new BadRequestException('Insufficient balance');
    }

    const reference = generateTransactionReference(TransactionType.WITHDRAWAL);
    const idempotencyKey = clientIdempotencyKey || generateIdempotencyKey();

    // Check for existing transaction
    const existing = await this.transactionRepo.findOne({
      where: { idempotencyKey },
    });

    if (existing) {
      return existing;
    }

    // Create transaction and debit wallet atomically
    const result = await this.ledgerService.postWithdrawal(
      wallet.id,
      BigInt(amountInKobo),
      userId,
      reference,
      undefined,
      {
        recipientId,
        bankName: recipient.bankName,
        accountNumber: recipient.accountNumber,
        accountName: recipient.accountName,
      },
      idempotencyKey,
    );

    const transaction = result.transaction;

    try {
      // Initiate transfer with Paystack
      const transferResponse = await this.paystackService.initiateTransfer(
        amountInKobo,
        recipient.recipientCode,
        reason || `Withdrawal to ${recipient.bankName}`,
        reference,
      );

      // Update transaction with provider reference
      transaction.providerReference = transferResponse.data.reference;
      transaction.providerResponse = transferResponse.data;
      transaction.status = TransactionStatus.PROCESSING;
      await this.transactionRepo.save(transaction);

      this.logger.log(`Withdrawal initiated: ${reference}`);

      return transaction;
    } catch (error) {
      // TODO: Handle failed transfer initiation - may need to reverse the debit
      this.logger.error(`Failed to initiate transfer: ${error.message}`);
      transaction.status = TransactionStatus.FAILED;
      transaction.failureReason = error.message;
      await this.transactionRepo.save(transaction);
      throw error;
    }
  }

  /**
   * Internal transfer between users.
   */
  async internalTransfer(
    sourceUserId: string,
    destinationUserId: string,
    amountInNaira: number,
    description?: string,
    clientIdempotencyKey?: string,
  ): Promise<Transaction> {
    if (sourceUserId === destinationUserId) {
      throw new BadRequestException('Cannot transfer to yourself');
    }

    const sourceWallet = await this.walletsService.getUserWallet(sourceUserId);
    const destWallet =
      await this.walletsService.getUserWallet(destinationUserId);

    const amountInKobo = nairaToKobo(amountInNaira);
    const idempotencyKey = clientIdempotencyKey || generateIdempotencyKey();

    // Check for existing transaction
    const existing = await this.transactionRepo.findOne({
      where: { idempotencyKey },
    });

    if (existing) {
      return existing;
    }

    // Post the transfer
    const result = await this.ledgerService.postTransfer(
      sourceWallet.id,
      destWallet.id,
      BigInt(amountInKobo),
      sourceUserId,
      {
        destinationUserId,
        description,
      },
      idempotencyKey,
    );

    this.logger.log(
      `Internal transfer completed: ${result.transaction.reference}`,
    );

    return result.transaction;
  }
}
