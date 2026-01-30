import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Org } from '../entities/org.entity';
import { OrgMember } from '../entities/org-member.entity';
import { OrgInvite } from '../entities/org-invite.entity';
import { Wallet } from '../entities/wallet.entity';
import {
  OrgMemberRole,
  OrgMemberStatus,
  OrgInviteStatus,
  WalletOwnerType,
  WalletStatus,
  Currency,
} from '../common/enums';
import {
  CreateOrgDto,
  UpdateOrgDto,
  CreateInviteDto,
  UpdateMemberDto,
} from './dto/orgs.dto';

@Injectable()
export class OrgsService {
  private readonly logger = new Logger(OrgsService.name);

  constructor(
    @InjectRepository(Org)
    private readonly orgRepo: Repository<Org>,
    @InjectRepository(OrgMember)
    private readonly memberRepo: Repository<OrgMember>,
    @InjectRepository(OrgInvite)
    private readonly inviteRepo: Repository<OrgInvite>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
  ) {}

  // ============ Org CRUD ============

  /**
   * Create a new organization with wallet.
   */
  async createOrg(
    userId: string,
    dto: CreateOrgDto,
  ): Promise<{ org: Org; wallet: Wallet }> {
    // Create the organization
    const org = this.orgRepo.create({
      name: dto.name,
      type: dto.type,
      ownerUserId: userId,
      metadata: dto.metadata,
    });
    await this.orgRepo.save(org);

    // Create org wallet
    const wallet = this.walletRepo.create({
      ownerType: WalletOwnerType.ORG,
      ownerId: org.id,
      currency: Currency.NGN,
      status: WalletStatus.ACTIVE,
      cachedBalance: '0',
    });
    await this.walletRepo.save(wallet);

    // Add owner as member
    const ownerMember = this.memberRepo.create({
      orgId: org.id,
      userId: userId,
      role: OrgMemberRole.OWNER,
      status: OrgMemberStatus.ACTIVE,
    });
    await this.memberRepo.save(ownerMember);

    this.logger.log(`Org created: ${org.id} by user ${userId}`);
    return { org, wallet };
  }

  /**
   * Get organization by ID.
   */
  async getOrg(orgId: string): Promise<Org> {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  /**
   * Get organization wallet.
   */
  async getOrgWallet(orgId: string): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({
      where: { ownerType: WalletOwnerType.ORG, ownerId: orgId },
    });
    if (!wallet) {
      throw new NotFoundException('Organization wallet not found');
    }
    return wallet;
  }

  /**
   * Update organization details.
   */
  async updateOrg(
    orgId: string,
    userId: string,
    dto: UpdateOrgDto,
  ): Promise<Org> {
    await this.requireRole(orgId, userId, [
      OrgMemberRole.OWNER,
      OrgMemberRole.ADMIN,
    ]);

    const org = await this.getOrg(orgId);

    if (dto.name) org.name = dto.name;
    if (dto.metadata) org.metadata = { ...org.metadata, ...dto.metadata };

    return this.orgRepo.save(org);
  }

  /**
   * Get all orgs a user belongs to.
   */
  async getUserOrgs(userId: string): Promise<Org[]> {
    const memberships = await this.memberRepo.find({
      where: { userId, status: OrgMemberStatus.ACTIVE },
    });

    if (memberships.length === 0) return [];

    const orgIds = memberships.map((m) => m.orgId);
    return this.orgRepo.find({ where: { id: In(orgIds) } });
  }

  // ============ Invite System ============

  /**
   * Create an invite.
   */
  async createInvite(
    orgId: string,
    invitedByUserId: string,
    dto: CreateInviteDto,
  ): Promise<OrgInvite> {
    await this.requireRole(orgId, invitedByUserId, [
      OrgMemberRole.OWNER,
      OrgMemberRole.ADMIN,
      OrgMemberRole.MANAGER,
    ]);

    if (!dto.email && !dto.phone && !dto.userId) {
      throw new BadRequestException('Must provide email, phone, or userId');
    }

    // Check if already a member
    if (dto.userId) {
      const existing = await this.memberRepo.findOne({
        where: { orgId, userId: dto.userId, status: OrgMemberStatus.ACTIVE },
      });
      if (existing) {
        throw new BadRequestException('User is already a member');
      }
    }

    // Check for existing pending invite
    const pendingInvite = await this.inviteRepo.findOne({
      where: [
        { orgId, inviteeEmail: dto.email, status: OrgInviteStatus.PENDING },
        { orgId, inviteePhone: dto.phone, status: OrgInviteStatus.PENDING },
        { orgId, inviteeUserId: dto.userId, status: OrgInviteStatus.PENDING },
      ],
    });

    if (pendingInvite) {
      throw new BadRequestException('Pending invite already exists');
    }

    // Create invite with 7-day expiry
    const invite = this.inviteRepo.create({
      orgId,
      invitedByUserId,
      inviteeEmail: dto.email,
      inviteePhone: dto.phone,
      inviteeUserId: dto.userId,
      role: dto.role,
      status: OrgInviteStatus.PENDING,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      message: dto.message,
    });

    await this.inviteRepo.save(invite);
    this.logger.log(`Invite created: ${invite.id} for org ${orgId}`);

    return invite;
  }

  /**
   * Accept an invite.
   */
  async acceptInvite(inviteId: string, userId: string): Promise<OrgMember> {
    const invite = await this.inviteRepo.findOne({ where: { id: inviteId } });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status !== OrgInviteStatus.PENDING) {
      throw new BadRequestException(`Invite is ${invite.status.toLowerCase()}`);
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      invite.status = OrgInviteStatus.EXPIRED;
      await this.inviteRepo.save(invite);
      throw new BadRequestException('Invite has expired');
    }

    // Verify this invite is for this user
    if (invite.inviteeUserId && invite.inviteeUserId !== userId) {
      throw new ForbiddenException('This invite is not for you');
    }

    // Check not already a member
    const existing = await this.memberRepo.findOne({
      where: { orgId: invite.orgId, userId, status: OrgMemberStatus.ACTIVE },
    });
    if (existing) {
      throw new BadRequestException('Already a member of this organization');
    }

    // Create membership
    const member = this.memberRepo.create({
      orgId: invite.orgId,
      userId,
      role: invite.role,
      status: OrgMemberStatus.ACTIVE,
    });
    await this.memberRepo.save(member);

    // Mark invite as accepted
    invite.status = OrgInviteStatus.ACCEPTED;
    invite.inviteeUserId = userId;
    await this.inviteRepo.save(invite);

    this.logger.log(`Invite ${inviteId} accepted by user ${userId}`);
    return member;
  }

  /**
   * Decline an invite.
   */
  async declineInvite(inviteId: string, userId: string): Promise<void> {
    const invite = await this.inviteRepo.findOne({ where: { id: inviteId } });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status !== OrgInviteStatus.PENDING) {
      throw new BadRequestException(`Invite is ${invite.status.toLowerCase()}`);
    }

    invite.status = OrgInviteStatus.REVOKED;
    await this.inviteRepo.save(invite);
  }

  /**
   * Get pending invites for an org.
   */
  async getOrgInvites(orgId: string, userId: string): Promise<OrgInvite[]> {
    await this.requireRole(orgId, userId, [
      OrgMemberRole.OWNER,
      OrgMemberRole.ADMIN,
      OrgMemberRole.MANAGER,
    ]);

    return this.inviteRepo.find({
      where: { orgId, status: OrgInviteStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get invites for a user.
   */
  async getUserInvites(userId: string, email?: string): Promise<OrgInvite[]> {
    const conditions: any[] = [
      { inviteeUserId: userId, status: OrgInviteStatus.PENDING },
    ];

    if (email) {
      conditions.push({ inviteeEmail: email, status: OrgInviteStatus.PENDING });
    }

    return this.inviteRepo.find({
      where: conditions,
      order: { createdAt: 'DESC' },
    });
  }

  // ============ Member Management ============

  /**
   * Get org members.
   */
  async getMembers(orgId: string): Promise<OrgMember[]> {
    return this.memberRepo.find({
      where: { orgId, status: OrgMemberStatus.ACTIVE },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Update member role.
   */
  async updateMember(
    orgId: string,
    memberId: string,
    actorUserId: string,
    dto: UpdateMemberDto,
  ): Promise<OrgMember> {
    const actor = await this.requireRole(orgId, actorUserId, [
      OrgMemberRole.OWNER,
      OrgMemberRole.ADMIN,
    ]);

    const member = await this.memberRepo.findOne({
      where: { id: memberId, orgId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Cannot change owner role
    if (member.role === OrgMemberRole.OWNER) {
      throw new ForbiddenException('Cannot change owner role');
    }

    // Admin cannot promote to owner
    if (
      actor.role === OrgMemberRole.ADMIN &&
      dto.role === OrgMemberRole.OWNER
    ) {
      throw new ForbiddenException('Only owner can promote to owner');
    }

    if (dto.role) member.role = dto.role;

    return this.memberRepo.save(member);
  }

  /**
   * Remove a member.
   */
  async removeMember(
    orgId: string,
    memberId: string,
    actorUserId: string,
  ): Promise<void> {
    await this.requireRole(orgId, actorUserId, [
      OrgMemberRole.OWNER,
      OrgMemberRole.ADMIN,
    ]);

    const member = await this.memberRepo.findOne({
      where: { id: memberId, orgId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === OrgMemberRole.OWNER) {
      throw new ForbiddenException('Cannot remove owner');
    }

    member.status = OrgMemberStatus.REMOVED;
    await this.memberRepo.save(member);

    this.logger.log(`Member ${memberId} removed from org ${orgId}`);
  }

  /**
   * Get member by user ID.
   */
  async getMemberByUserId(
    orgId: string,
    userId: string,
  ): Promise<OrgMember | null> {
    return this.memberRepo.findOne({
      where: { orgId, userId, status: OrgMemberStatus.ACTIVE },
    });
  }

  // ============ Helpers ============

  /**
   * Require user has one of the specified roles.
   */
  private async requireRole(
    orgId: string,
    userId: string,
    allowedRoles: OrgMemberRole[],
  ): Promise<OrgMember> {
    const member = await this.memberRepo.findOne({
      where: { orgId, userId, status: OrgMemberStatus.ACTIVE },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this organization');
    }

    if (!allowedRoles.includes(member.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return member;
  }
}
