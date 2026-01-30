import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { AllocationStatus, Currency } from '../common/enums';

/**
 * Budget allocations within an organization.
 * Each allocation has its own wallet for clean ledger separation.
 * Supports hierarchical allocations (parent → child).
 */
@Entity('allocations')
@Index(['orgId', 'status'])
@Index(['walletId'])
export class Allocation extends BaseEntity {
  /**
   * Organization this allocation belongs to.
   */
  @Column('uuid')
  orgId: string;

  /**
   * Wallet for this allocation's funds.
   * Created automatically when allocation is created.
   */
  @Column('uuid')
  walletId: string;

  /**
   * Display name for the allocation.
   */
  @Column()
  name: string;

  /**
   * Optional description.
   */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /**
   * Member who manages this allocation (can spend from it).
   */
  @Column('uuid')
  managerMemberId: string;

  /**
   * Parent allocation for hierarchical budgets.
   * Enables VC → HOD → Secretary chains.
   */
  @Column({ type: 'uuid', nullable: true })
  parentAllocationId?: string | null;

  /**
   * Currency for this allocation.
   */
  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.NGN,
  })
  currency: Currency;

  /**
   * Status of the allocation.
   */
  @Column({
    type: 'enum',
    enum: AllocationStatus,
    default: AllocationStatus.ACTIVE,
  })
  status: AllocationStatus;

  /**
   * Optional metadata for custom use.
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null;
}
