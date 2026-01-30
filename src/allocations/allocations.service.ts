import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Allocation } from '../entities/allocation.entity';
import { AllocationRule } from '../entities/allocation-rule.entity';
import { Wallet } from '../entities/wallet.entity';
import { OrgMember } from '../entities/org-member.entity';
import {
  AllocationStatus,
  WalletOwnerType,
  WalletStatus,
  Currency,
  OrgMemberRole,
  OrgMemberStatus,
  TransactionType,
} from '../common/enums';
import { LedgerService } from '../ledger/ledger.service';
import {
  CreateAllocationDto,
  UpdateAllocationDto,
  FundAllocationDto,
  CreateRuleDto,
  UpdateRuleDto,
} from './dto/allocations.dto';

@Injectable()
export class AllocationsService {
  private readonly logger = new Logger(AllocationsService.name);

  constructor(
    @InjectRepository(Allocation)
    private readonly allocationRepo: Repository<Allocation>,
    @InjectRepository(AllocationRule)
    private readonly ruleRepo: Repository<AllocationRule>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(OrgMember)
    private readonly memberRepo: Repository<OrgMember>,
    private readonly ledgerService: LedgerService,
    private readonly dataSource: DataSource,
  ) {}

  // ============ Allocation CRUD ============

  /**
   * Create an allocation with its own wallet.
   */
  async createAllocation(
    orgId: string,
    userId: string,
    dto: CreateAllocationDto,
  ): Promise<{ allocation: Allocation; wallet: Wallet }> {
    // Verify user has permission
    await this.requireOrgRole(orgId, userId, [
      OrgMemberRole.OWNER,
      OrgMemberRole.ADMIN,
    ]);

    // Verify manager exists
    const manager = await this.memberRepo.findOne({
      where: { id: dto.managerMemberId, orgId, status: OrgMemberStatus.ACTIVE },
    });
    if (!manager) {
      throw new BadRequestException('Manager member not found');
    }

    // If parent allocation specified, verify it exists
    if (dto.parentAllocationId) {
      const parent = await this.allocationRepo.findOne({
        where: { id: dto.parentAllocationId, orgId },
      });
      if (!parent) {
        throw new BadRequestException('Parent allocation not found');
      }
    }

    // Create wallet for allocation
    const wallet = this.walletRepo.create({
      ownerType: WalletOwnerType.ALLOCATION,
      ownerId: '', // Will be set after allocation is created
      currency: Currency.NGN,
      status: WalletStatus.ACTIVE,
      cachedBalance: '0',
    });
    await this.walletRepo.save(wallet);

    // Create allocation
    const allocation = this.allocationRepo.create({
      orgId,
      walletId: wallet.id,
      name: dto.name,
      description: dto.description,
      managerMemberId: dto.managerMemberId,
      parentAllocationId: dto.parentAllocationId,
      status: AllocationStatus.ACTIVE,
      metadata: dto.metadata,
    });
    await this.allocationRepo.save(allocation);

    // Update wallet with allocation ID
    wallet.ownerId = allocation.id;
    await this.walletRepo.save(wallet);

    this.logger.log(`Allocation created: ${allocation.id} for org ${orgId}`);
    return { allocation, wallet };
  }

  /**
   * Get allocation by ID.
   */
  async getAllocation(allocationId: string): Promise<Allocation> {
    const allocation = await this.allocationRepo.findOne({
      where: { id: allocationId },
    });
    if (!allocation) {
      throw new NotFoundException('Allocation not found');
    }
    return allocation;
  }

  /**
   * Get allocation wallet with balance.
   */
  async getAllocationWallet(allocationId: string): Promise<Wallet> {
    const allocation = await this.getAllocation(allocationId);
    const wallet = await this.walletRepo.findOne({
      where: { id: allocation.walletId },
    });
    if (!wallet) {
      throw new NotFoundException('Allocation wallet not found');
    }
    return wallet;
  }

  /**
   * Get all allocations for an org.
   */
  async getOrgAllocations(orgId: string): Promise<Allocation[]> {
    return this.allocationRepo.find({
      where: { orgId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Update allocation.
   */
  async updateAllocation(
    allocationId: string,
    userId: string,
    dto: UpdateAllocationDto,
  ): Promise<Allocation> {
    const allocation = await this.getAllocation(allocationId);

    await this.requireOrgRole(allocation.orgId, userId, [
      OrgMemberRole.OWNER,
      OrgMemberRole.ADMIN,
    ]);

    if (dto.name) allocation.name = dto.name;
    if (dto.description !== undefined) allocation.description = dto.description;
    if (dto.managerMemberId) {
      // Verify new manager exists
      const manager = await this.memberRepo.findOne({
        where: {
          id: dto.managerMemberId,
          orgId: allocation.orgId,
          status: OrgMemberStatus.ACTIVE,
        },
      });
      if (!manager) {
        throw new BadRequestException('Manager member not found');
      }
      allocation.managerMemberId = dto.managerMemberId;
    }
    if (dto.metadata) {
      allocation.metadata = { ...allocation.metadata, ...dto.metadata };
    }

    return this.allocationRepo.save(allocation);
  }

  /**
   * Freeze/unfreeze allocation.
   */
  async setAllocationStatus(
    allocationId: string,
    userId: string,
    status: AllocationStatus,
  ): Promise<Allocation> {
    const allocation = await this.getAllocation(allocationId);

    await this.requireOrgRole(allocation.orgId, userId, [
      OrgMemberRole.OWNER,
      OrgMemberRole.ADMIN,
    ]);

    allocation.status = status;
    return this.allocationRepo.save(allocation);
  }

  // ============ Funding ============

  /**
   * Fund allocation from org wallet.
   */
  async fundFromOrg(
    allocationId: string,
    userId: string,
    dto: FundAllocationDto,
  ): Promise<{ success: boolean; newBalance: string }> {
    const allocation = await this.getAllocation(allocationId);

    await this.requireOrgRole(allocation.orgId, userId, [
      OrgMemberRole.OWNER,
      OrgMemberRole.ADMIN,
    ]);

    // Get org wallet
    const orgWallet = await this.walletRepo.findOne({
      where: { ownerType: WalletOwnerType.ORG, ownerId: allocation.orgId },
    });
    if (!orgWallet) {
      throw new NotFoundException('Organization wallet not found');
    }

    // Transfer from org to allocation
    const amount = BigInt(dto.amount);
    await this.ledgerService.postTransaction({
      type: TransactionType.ALLOCATION_TOPUP,
      amount,
      initiatedByUserId: userId,
      sourceWalletId: orgWallet.id,
      destinationWalletId: allocation.walletId,
      description: dto.description || `Fund allocation: ${allocation.name}`,
    });

    // Get updated balance
    const updatedWallet = await this.walletRepo.findOne({
      where: { id: allocation.walletId },
    });

    this.logger.log(
      `Allocation ${allocationId} funded with ${dto.amount} kobo`,
    );
    return {
      success: true,
      newBalance: updatedWallet?.cachedBalance || '0',
    };
  }

  /**
   * Fund child allocation from parent allocation.
   */
  async fundFromParent(
    allocationId: string,
    userId: string,
    dto: FundAllocationDto,
  ): Promise<{ success: boolean; newBalance: string }> {
    const allocation = await this.getAllocation(allocationId);

    if (!allocation.parentAllocationId) {
      throw new BadRequestException('Allocation has no parent');
    }

    // Verify user is manager of parent allocation
    const parent = await this.getAllocation(allocation.parentAllocationId);
    const member = await this.memberRepo.findOne({
      where: { id: parent.managerMemberId },
    });
    if (!member || member.userId !== userId) {
      throw new ForbiddenException('Only parent allocation manager can fund');
    }

    // Transfer from parent to child
    const amount = BigInt(dto.amount);
    await this.ledgerService.postTransaction({
      type: TransactionType.ALLOCATION_TOPUP,
      amount,
      initiatedByUserId: userId,
      sourceWalletId: parent.walletId,
      destinationWalletId: allocation.walletId,
      description:
        dto.description || `Sub-allocation funding: ${allocation.name}`,
    });

    const updatedWallet = await this.walletRepo.findOne({
      where: { id: allocation.walletId },
    });

    return {
      success: true,
      newBalance: updatedWallet?.cachedBalance || '0',
    };
  }

  // ============ Rules ============

  /**
   * Add a rule to an allocation.
   */
  async addRule(
    allocationId: string,
    userId: string,
    dto: CreateRuleDto,
  ): Promise<AllocationRule> {
    const allocation = await this.getAllocation(allocationId);

    await this.requireOrgRole(allocation.orgId, userId, [
      OrgMemberRole.OWNER,
      OrgMemberRole.ADMIN,
    ]);

    const rule = this.ruleRepo.create({
      allocationId,
      ruleType: dto.ruleType,
      config: dto.config,
      enabled: true,
      description: dto.description,
    });

    await this.ruleRepo.save(rule);
    this.logger.log(`Rule ${dto.ruleType} added to allocation ${allocationId}`);

    return rule;
  }

  /**
   * Get rules for an allocation.
   */
  async getRules(allocationId: string): Promise<AllocationRule[]> {
    return this.ruleRepo.find({
      where: { allocationId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Update a rule.
   */
  async updateRule(
    ruleId: string,
    userId: string,
    dto: UpdateRuleDto,
  ): Promise<AllocationRule> {
    const rule = await this.ruleRepo.findOne({ where: { id: ruleId } });
    if (!rule) {
      throw new NotFoundException('Rule not found');
    }

    const allocation = await this.getAllocation(rule.allocationId);
    await this.requireOrgRole(allocation.orgId, userId, [
      OrgMemberRole.OWNER,
      OrgMemberRole.ADMIN,
    ]);

    if (dto.config) rule.config = dto.config;
    if (dto.enabled !== undefined) rule.enabled = dto.enabled;
    if (dto.description !== undefined) rule.description = dto.description;

    return this.ruleRepo.save(rule);
  }

  /**
   * Delete a rule.
   */
  async deleteRule(ruleId: string, userId: string): Promise<void> {
    const rule = await this.ruleRepo.findOne({ where: { id: ruleId } });
    if (!rule) {
      throw new NotFoundException('Rule not found');
    }

    const allocation = await this.getAllocation(rule.allocationId);
    await this.requireOrgRole(allocation.orgId, userId, [
      OrgMemberRole.OWNER,
      OrgMemberRole.ADMIN,
    ]);

    await this.ruleRepo.delete(ruleId);
  }

  // ============ Helpers ============

  private async requireOrgRole(
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
