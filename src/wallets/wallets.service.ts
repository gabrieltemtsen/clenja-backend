import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Wallet } from '../entities/wallet.entity';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import { Transaction } from '../entities/transaction.entity';
import { WalletOwnerType, WalletStatus, Currency } from '../common/enums';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Creates a new wallet for an owner.
   */
  async createWallet(
    ownerType: WalletOwnerType,
    ownerId: string,
    currency: Currency = Currency.NGN,
  ): Promise<Wallet> {
    const existing = await this.walletRepo.findOne({
      where: { ownerType, ownerId, currency },
    });

    if (existing) {
      this.logger.warn(`Wallet already exists for ${ownerType}:${ownerId}`);
      return existing;
    }

    const wallet = this.walletRepo.create({
      ownerType,
      ownerId,
      currency,
      status: WalletStatus.ACTIVE,
      cachedBalance: '0',
    });

    return this.walletRepo.save(wallet);
  }

  /**
   * Creates a wallet for a user (called on registration).
   */
  async createUserWallet(userId: string): Promise<Wallet> {
    return this.createWallet(WalletOwnerType.USER, userId);
  }

  /**
   * Gets a wallet by ID.
   */
  async getWalletById(walletId: string): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  /**
   * Gets a user's wallet.
   */
  async getUserWallet(userId: string): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({
      where: {
        ownerType: WalletOwnerType.USER,
        ownerId: userId,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found for user');
    }

    return wallet;
  }

  /**
   * Gets the balance of a wallet (uses cached balance).
   * For accurate balance, use getLedgerBalance().
   */
  async getBalance(walletId: string): Promise<bigint> {
    const wallet = await this.getWalletById(walletId);
    return BigInt(wallet.cachedBalance);
  }

  /**
   * Computes the actual balance from ledger entries.
   * Use this for reconciliation or when cached balance might be stale.
   */
  async getLedgerBalance(walletId: string): Promise<bigint> {
    const result = await this.ledgerRepo
      .createQueryBuilder('entry')
      .select(
        `SUM(CASE WHEN entry.direction = 'CREDIT' THEN entry.amount::bigint ELSE -entry.amount::bigint END)`,
        'balance',
      )
      .where('entry.walletId = :walletId', { walletId })
      .getRawOne();

    return BigInt(result?.balance || 0);
  }

  /**
   * Gets transaction history for a wallet.
   */
  async getTransactionHistory(
    walletId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const [transactions, total] = await this.transactionRepo.findAndCount({
      where: [{ sourceWalletId: walletId }, { destinationWalletId: walletId }],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { transactions, total };
  }

  /**
   * Gets ledger entries for a wallet (for detailed statement).
   */
  async getLedgerEntries(
    walletId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ entries: LedgerEntry[]; total: number }> {
    const [entries, total] = await this.ledgerRepo.findAndCount({
      where: { walletId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { entries, total };
  }

  /**
   * Freezes a wallet (no transactions allowed).
   */
  async freezeWallet(walletId: string): Promise<Wallet> {
    const wallet = await this.getWalletById(walletId);
    wallet.status = WalletStatus.FROZEN;
    return this.walletRepo.save(wallet);
  }

  /**
   * Unfreezes a wallet.
   */
  async unfreezeWallet(walletId: string): Promise<Wallet> {
    const wallet = await this.getWalletById(walletId);
    wallet.status = WalletStatus.ACTIVE;
    return this.walletRepo.save(wallet);
  }

  /**
   * Checks if a wallet is active and can transact.
   */
  async isWalletActive(walletId: string): Promise<boolean> {
    const wallet = await this.getWalletById(walletId);
    return wallet.status === WalletStatus.ACTIVE;
  }
}
