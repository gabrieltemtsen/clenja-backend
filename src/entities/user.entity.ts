import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { UserStatus } from '../common/enums';

@Entity('users')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  email?: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'varchar', nullable: true })
  displayName?: string;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ default: 0 })
  kycLevel: number;
}
