import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { AllocationRuleType } from '../common/enums';

/**
 * Spending rules for allocations.
 * Evaluated before any spend from an allocation wallet.
 */
@Entity('allocation_rules')
@Index(['allocationId'])
export class AllocationRule extends BaseEntity {
  /**
   * Allocation this rule applies to.
   */
  @Column('uuid')
  allocationId: string;

  /**
   * Type of rule.
   */
  @Column({
    type: 'enum',
    enum: AllocationRuleType,
  })
  ruleType: AllocationRuleType;

  /**
   * Rule configuration (JSON).
   *
   * Examples:
   * - TXN_LIMIT: { maxAmount: 50000 }
   * - DAILY_LIMIT: { maxAmount: 200000 }
   * - MONTHLY_LIMIT: { maxAmount: 1000000 }
   * - TIME_LOCK: { startHour: 9, endHour: 17, days: [1,2,3,4,5] }
   * - WHITELIST_RECIPIENTS: { userIds: ["uuid1", "uuid2"] }
   * - REQUIRES_APPROVAL: { threshold: 100000, approverRoles: ["ADMIN", "OWNER"] }
   */
  @Column({ type: 'jsonb' })
  config: Record<string, any>;

  /**
   * Whether this rule is active.
   */
  @Column({ default: true })
  enabled: boolean;

  /**
   * Optional description of the rule.
   */
  @Column({ type: 'text', nullable: true })
  description?: string | null;
}
