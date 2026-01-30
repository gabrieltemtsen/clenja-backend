import {
  Entity,
  Column,
  Index,
  CreateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LedgerDirection, Currency } from '../common/enums';

/**
 * Double-entry ledger entries.
 * Every transaction creates at least 2 entries (debit and credit).
 * This is immutable - entries are never updated or deleted.
 */
@Entity('ledger_entries')
@Index(['walletId', 'createdAt'])
@Index(['transactionId'])
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Reference to the parent transaction.
   */
  @Column('uuid')
  transactionId: string;

  /**
   * Wallet affected by this entry.
   */
  @Column('uuid')
  walletId: string;

  /**
   * DEBIT decreases balance, CREDIT increases balance.
   */
  @Column({
    type: 'enum',
    enum: LedgerDirection,
  })
  direction: LedgerDirection;

  /**
   * Amount in kobo (always positive).
   */
  @Column({ type: 'bigint' })
  amount: string;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.NGN,
  })
  currency: Currency;

  /**
   * Running balance after this entry.
   * Useful for quick balance lookups and statement generation.
   */
  @Column({ type: 'bigint' })
  balanceAfter: string;

  /**
   * Immutable - only set at creation.
   */
  @CreateDateColumn()
  createdAt: Date;
}
