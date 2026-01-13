import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { OrgMemberRole, OrgMemberStatus } from '../common/enums';

@Entity('org_members')
@Index(['orgId', 'userId'], { unique: true })
export class OrgMember extends BaseEntity {
  @Column()
  orgId: string;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: OrgMemberRole,
  })
  role: OrgMemberRole;

  @Column({
    type: 'enum',
    enum: OrgMemberStatus,
    default: OrgMemberStatus.ACTIVE,
  })
  status: OrgMemberStatus;

  @Column({ nullable: true })
  parentMemberId?: string | null;
}
