import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { OrgsService } from './orgs.service';
import {
  CreateOrgDto,
  UpdateOrgDto,
  CreateInviteDto,
  AcceptInviteDto,
  UpdateMemberDto,
} from './dto/orgs.dto';

@ApiTags('Organizations')
@Controller('orgs')
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  // ============ Org CRUD ============

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  async createOrg(
    @Body() dto: CreateOrgDto,
    @Query('userId') userId: string, // TODO: Replace with auth guard
  ) {
    const { org, wallet } = await this.orgsService.createOrg(userId, dto);
    return {
      success: true,
      data: {
        id: org.id,
        name: org.name,
        type: org.type,
        walletId: wallet.id,
        createdAt: org.createdAt,
      },
    };
  }

  @Get('my')
  @ApiOperation({ summary: 'Get organizations for current user' })
  async getMyOrgs(@Query('userId') userId: string) {
    const orgs = await this.orgsService.getUserOrgs(userId);
    return { success: true, data: orgs };
  }

  @Get(':orgId')
  @ApiOperation({ summary: 'Get organization details' })
  async getOrg(@Param('orgId') orgId: string) {
    const org = await this.orgsService.getOrg(orgId);
    const wallet = await this.orgsService.getOrgWallet(orgId);
    return {
      success: true,
      data: {
        ...org,
        walletId: wallet.id,
        balance: wallet.cachedBalance,
      },
    };
  }

  @Patch(':orgId')
  @ApiOperation({ summary: 'Update organization' })
  async updateOrg(
    @Param('orgId') orgId: string,
    @Query('userId') userId: string,
    @Body() dto: UpdateOrgDto,
  ) {
    const org = await this.orgsService.updateOrg(orgId, userId, dto);
    return { success: true, data: org };
  }

  // ============ Invites ============

  @Post(':orgId/invites')
  @ApiOperation({ summary: 'Create invitation to join org' })
  async createInvite(
    @Param('orgId') orgId: string,
    @Query('userId') userId: string,
    @Body() dto: CreateInviteDto,
  ) {
    const invite = await this.orgsService.createInvite(orgId, userId, dto);
    return { success: true, data: invite };
  }

  @Get(':orgId/invites')
  @ApiOperation({ summary: 'Get pending invites for org' })
  async getOrgInvites(
    @Param('orgId') orgId: string,
    @Query('userId') userId: string,
  ) {
    const invites = await this.orgsService.getOrgInvites(orgId, userId);
    return { success: true, data: invites };
  }

  @Get('invites/my')
  @ApiOperation({ summary: 'Get invites for current user' })
  @ApiQuery({ name: 'email', required: false })
  async getMyInvites(
    @Query('userId') userId: string,
    @Query('email') email?: string,
  ) {
    const invites = await this.orgsService.getUserInvites(userId, email);
    return { success: true, data: invites };
  }

  @Post('invites/:inviteId/accept')
  @ApiOperation({ summary: 'Accept an invitation' })
  async acceptInvite(
    @Param('inviteId') inviteId: string,
    @Body() dto: AcceptInviteDto,
  ) {
    const member = await this.orgsService.acceptInvite(inviteId, dto.userId);
    return { success: true, data: member };
  }

  @Post('invites/:inviteId/decline')
  @ApiOperation({ summary: 'Decline an invitation' })
  async declineInvite(
    @Param('inviteId') inviteId: string,
    @Query('userId') userId: string,
  ) {
    await this.orgsService.declineInvite(inviteId, userId);
    return { success: true, message: 'Invite declined' };
  }

  // ============ Members ============

  @Get(':orgId/members')
  @ApiOperation({ summary: 'Get org members' })
  async getMembers(@Param('orgId') orgId: string) {
    const members = await this.orgsService.getMembers(orgId);
    return { success: true, data: members };
  }

  @Patch(':orgId/members/:memberId')
  @ApiOperation({ summary: 'Update member role' })
  async updateMember(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Query('userId') userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    const member = await this.orgsService.updateMember(
      orgId,
      memberId,
      userId,
      dto,
    );
    return { success: true, data: member };
  }

  @Delete(':orgId/members/:memberId')
  @ApiOperation({ summary: 'Remove member from org' })
  async removeMember(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Query('userId') userId: string,
  ) {
    await this.orgsService.removeMember(orgId, memberId, userId);
    return { success: true, message: 'Member removed' };
  }
}
