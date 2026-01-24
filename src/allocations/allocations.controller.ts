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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AllocationsService } from './allocations.service';
import {
    CreateAllocationDto,
    UpdateAllocationDto,
    FundAllocationDto,
    CreateRuleDto,
    UpdateRuleDto,
} from './dto/allocations.dto';
import { AllocationStatus } from '../common/enums';

@ApiTags('Allocations')
@Controller()
export class AllocationsController {
    constructor(private readonly allocationsService: AllocationsService) { }

    // ============ Allocation CRUD ============

    @Post('orgs/:orgId/allocations')
    @ApiOperation({ summary: 'Create an allocation in an organization' })
    async createAllocation(
        @Param('orgId') orgId: string,
        @Query('userId') userId: string, // TODO: Replace with auth guard
        @Body() dto: CreateAllocationDto,
    ) {
        const { allocation, wallet } = await this.allocationsService.createAllocation(
            orgId,
            userId,
            dto,
        );
        return {
            success: true,
            data: {
                id: allocation.id,
                name: allocation.name,
                walletId: wallet.id,
                managerMemberId: allocation.managerMemberId,
                status: allocation.status,
                createdAt: allocation.createdAt,
            },
        };
    }

    @Get('orgs/:orgId/allocations')
    @ApiOperation({ summary: 'Get all allocations for an organization' })
    async getOrgAllocations(@Param('orgId') orgId: string) {
        const allocations = await this.allocationsService.getOrgAllocations(orgId);

        // Get balances for each allocation
        const data = await Promise.all(
            allocations.map(async (allocation) => {
                const wallet = await this.allocationsService.getAllocationWallet(allocation.id);
                return {
                    ...allocation,
                    balance: wallet.cachedBalance,
                };
            }),
        );

        return { success: true, data };
    }

    @Get('allocations/:allocationId')
    @ApiOperation({ summary: 'Get allocation details' })
    async getAllocation(@Param('allocationId') allocationId: string) {
        const allocation = await this.allocationsService.getAllocation(allocationId);
        const wallet = await this.allocationsService.getAllocationWallet(allocationId);
        return {
            success: true,
            data: {
                ...allocation,
                balance: wallet.cachedBalance,
            },
        };
    }

    @Patch('allocations/:allocationId')
    @ApiOperation({ summary: 'Update an allocation' })
    async updateAllocation(
        @Param('allocationId') allocationId: string,
        @Query('userId') userId: string,
        @Body() dto: UpdateAllocationDto,
    ) {
        const allocation = await this.allocationsService.updateAllocation(
            allocationId,
            userId,
            dto,
        );
        return { success: true, data: allocation };
    }

    @Post('allocations/:allocationId/freeze')
    @ApiOperation({ summary: 'Freeze an allocation' })
    async freezeAllocation(
        @Param('allocationId') allocationId: string,
        @Query('userId') userId: string,
    ) {
        const allocation = await this.allocationsService.setAllocationStatus(
            allocationId,
            userId,
            AllocationStatus.FROZEN,
        );
        return { success: true, data: allocation };
    }

    @Post('allocations/:allocationId/unfreeze')
    @ApiOperation({ summary: 'Unfreeze an allocation' })
    async unfreezeAllocation(
        @Param('allocationId') allocationId: string,
        @Query('userId') userId: string,
    ) {
        const allocation = await this.allocationsService.setAllocationStatus(
            allocationId,
            userId,
            AllocationStatus.ACTIVE,
        );
        return { success: true, data: allocation };
    }

    // ============ Funding ============

    @Post('allocations/:allocationId/fund')
    @ApiOperation({ summary: 'Fund allocation from org wallet' })
    async fundFromOrg(
        @Param('allocationId') allocationId: string,
        @Query('userId') userId: string,
        @Body() dto: FundAllocationDto,
    ) {
        const result = await this.allocationsService.fundFromOrg(
            allocationId,
            userId,
            dto,
        );
        return { success: true, data: result };
    }

    @Post('allocations/:allocationId/fund-from-parent')
    @ApiOperation({ summary: 'Fund allocation from parent allocation' })
    async fundFromParent(
        @Param('allocationId') allocationId: string,
        @Query('userId') userId: string,
        @Body() dto: FundAllocationDto,
    ) {
        const result = await this.allocationsService.fundFromParent(
            allocationId,
            userId,
            dto,
        );
        return { success: true, data: result };
    }

    // ============ Rules ============

    @Post('allocations/:allocationId/rules')
    @ApiOperation({ summary: 'Add a spending rule to an allocation' })
    async addRule(
        @Param('allocationId') allocationId: string,
        @Query('userId') userId: string,
        @Body() dto: CreateRuleDto,
    ) {
        const rule = await this.allocationsService.addRule(allocationId, userId, dto);
        return { success: true, data: rule };
    }

    @Get('allocations/:allocationId/rules')
    @ApiOperation({ summary: 'Get all rules for an allocation' })
    async getRules(@Param('allocationId') allocationId: string) {
        const rules = await this.allocationsService.getRules(allocationId);
        return { success: true, data: rules };
    }

    @Patch('rules/:ruleId')
    @ApiOperation({ summary: 'Update a spending rule' })
    async updateRule(
        @Param('ruleId') ruleId: string,
        @Query('userId') userId: string,
        @Body() dto: UpdateRuleDto,
    ) {
        const rule = await this.allocationsService.updateRule(ruleId, userId, dto);
        return { success: true, data: rule };
    }

    @Delete('rules/:ruleId')
    @ApiOperation({ summary: 'Delete a spending rule' })
    async deleteRule(
        @Param('ruleId') ruleId: string,
        @Query('userId') userId: string,
    ) {
        await this.allocationsService.deleteRule(ruleId, userId);
        return { success: true, message: 'Rule deleted' };
    }
}
