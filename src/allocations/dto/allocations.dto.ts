import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEnum,
    IsUUID,
    IsNumber,
    IsBoolean,
    MaxLength,
    IsPositive,
    IsObject,
} from 'class-validator';
import { AllocationRuleType } from '../../common/enums';

// ============ Allocation DTOs ============

export class CreateAllocationDto {
    @ApiProperty({ example: 'Marketing Budget Q1' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @ApiPropertyOptional({ example: 'Budget for Q1 marketing campaigns' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiProperty({ description: 'Member ID who will manage this allocation' })
    @IsUUID()
    managerMemberId: string;

    @ApiPropertyOptional({ description: 'Parent allocation for hierarchical budgets' })
    @IsOptional()
    @IsUUID()
    parentAllocationId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    metadata?: Record<string, any>;
}

export class FundAllocationDto {
    @ApiProperty({ example: 500000, description: 'Amount in kobo' })
    @IsNumber()
    @IsPositive()
    amount: number;

    @ApiPropertyOptional({ example: 'Initial funding for Q1' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    description?: string;
}

export class UpdateAllocationDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    managerMemberId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    metadata?: Record<string, any>;
}

// ============ Rule DTOs ============

export class CreateRuleDto {
    @ApiProperty({ enum: AllocationRuleType })
    @IsEnum(AllocationRuleType)
    ruleType: AllocationRuleType;

    @ApiProperty({
        example: { maxAmount: 50000 },
        description: 'Rule configuration object'
    })
    @IsObject()
    config: Record<string, any>;

    @ApiPropertyOptional({ example: 'Max 500 NGN per transaction' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    description?: string;
}

export class UpdateRuleDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsObject()
    config?: Record<string, any>;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    enabled?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;
}
