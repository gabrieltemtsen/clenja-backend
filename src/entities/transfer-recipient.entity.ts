import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * Bank account recipients for withdrawals.
 * Stores Paystack transfer recipient details.
 */
@Entity('transfer_recipients')
@Index(['userId'])
@Index(['recipientCode'], { unique: true })
export class TransferRecipient extends BaseEntity {
  /**
   * Owner of this bank account.
   */
  @Column('uuid')
  userId: string;

  /**
   * Paystack recipient code (e.g., RCP_xxxxxx).
   */
  @Column({ unique: true })
  recipientCode: string;

  /**
   * Bank code (e.g., "058" for GTBank).
   */
  @Column()
  bankCode: string;

  /**
   * Bank name (e.g., "Guaranty Trust Bank").
   */
  @Column()
  bankName: string;

  /**
   * Bank account number.
   */
  @Column()
  accountNumber: string;

  /**
   * Account holder name (resolved from Paystack).
   */
  @Column()
  accountName: string;

  /**
   * Whether this is the user's default withdrawal account.
   */
  @Column({ default: false })
  isDefault: boolean;

  /**
   * Whether the account has been verified.
   */
  @Column({ default: true })
  isVerified: boolean;
}
