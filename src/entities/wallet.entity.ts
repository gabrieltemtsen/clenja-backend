import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { WalletStatus, WalletOwnerType, Currency } from '../common/enums';

@Entity('wallets')
@Index(['ownerType', 'ownerId'])
export class Wallet extends BaseEntity {
  @Column({
    type: 'enum',
    enum: WalletOwnerType,
  })
  ownerType: WalletOwnerType;

  @Column('uuid')
  ownerId: string;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.NGN,
  })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: WalletStatus,
    default: WalletStatus.ACTIVE,
  })
  status: WalletStatus;

  /**
   * Cached balance in kobo (smallest unit).
   * This is an optimization - the source of truth is always the ledger.
   * Updated atomically with ledger entries.
   */
  @Column({ type: 'bigint', default: 0 })
  cachedBalance: string; // bigint comes as string in TypeORM
}
