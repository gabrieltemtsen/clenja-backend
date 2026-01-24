import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { OrgMemberRole, OrgInviteStatus } from '../common/enums';

/**
 * Organization invitations.
 * Tracks the full lifecycle of an invite from creation to acceptance/expiry.
 */
@Entity('org_invites')
@Index(['orgId', 'status'])
@Index(['inviteeEmail', 'status'])
export class OrgInvite extends BaseEntity {
    /**
     * Organization this invite belongs to.
     */
    @Column('uuid')
    orgId: string;

    /**
     * User who created the invite.
     */
    @Column('uuid')
    invitedByUserId: string;

    /**
     * Email of the person being invited (for non-existing users).
     */
    @Column({ type: 'varchar', nullable: true })
    inviteeEmail?: string | null;

    /**
     * Phone of the person being invited (alternative to email).
     */
    @Column({ type: 'varchar', nullable: true })
    inviteePhone?: string | null;

    /**
     * User ID if the invitee already exists in the system.
     */
    @Column({ type: 'uuid', nullable: true })
    inviteeUserId?: string | null;

    /**
     * Role the invitee will have upon accepting.
     */
    @Column({
        type: 'enum',
        enum: OrgMemberRole,
        default: OrgMemberRole.MEMBER,
    })
    role: OrgMemberRole;

    /**
     * Current status of the invite.
     */
    @Column({
        type: 'enum',
        enum: OrgInviteStatus,
        default: OrgInviteStatus.PENDING,
    })
    status: OrgInviteStatus;

    /**
     * When the invite expires.
     */
    @Column({ type: 'timestamp', nullable: true })
    expiresAt?: Date | null;

    /**
     * Optional personal message from the inviter.
     */
    @Column({ type: 'text', nullable: true })
    message?: string | null;
}
