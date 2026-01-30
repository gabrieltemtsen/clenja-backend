import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsEmail,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { OrgType, OrgMemberRole } from '../../common/enums';

// ============ Org DTOs ============

export class CreateOrgDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: OrgType, example: OrgType.COMPANY })
  @IsEnum(OrgType)
  type: OrgType;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateOrgDto {
  @ApiPropertyOptional({ example: 'Acme Corp Updated' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, any>;
}

// ============ Invite DTOs ============

export class CreateInviteDto {
  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'User ID if already in system' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ enum: OrgMemberRole, example: OrgMemberRole.MEMBER })
  @IsEnum(OrgMemberRole)
  role: OrgMemberRole;

  @ApiPropertyOptional({ example: 'Welcome to our team!' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class AcceptInviteDto {
  @ApiProperty({ description: 'User ID accepting the invite' })
  @IsUUID()
  userId: string;
}

// ============ Member DTOs ============

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: OrgMemberRole })
  @IsOptional()
  @IsEnum(OrgMemberRole)
  role?: OrgMemberRole;
}

// ============ Response DTOs ============

export class OrgResponseDto {
  id: string;
  name: string;
  type: OrgType;
  ownerUserId: string;
  walletId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export class InviteResponseDto {
  id: string;
  orgId: string;
  inviteeEmail?: string;
  inviteePhone?: string;
  role: OrgMemberRole;
  status: string;
  expiresAt?: Date;
  createdAt: Date;
}

export class MemberResponseDto {
  id: string;
  orgId: string;
  userId: string;
  role: OrgMemberRole;
  status: string;
  parentMemberId?: string;
  createdAt: Date;
}
