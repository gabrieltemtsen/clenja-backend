import { IsString, IsNumber, IsUUID, IsOptional, Min, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResolveAccountDto {
    @ApiProperty({ description: 'Bank account number' })
    @IsString()
    @Length(10, 10)
    accountNumber: string;

    @ApiProperty({ description: 'Bank code (e.g., "058" for GTBank)' })
    @IsString()
    bankCode: string;
}

export class AddBankAccountDto {
    @ApiProperty({ description: 'User ID' })
    @IsUUID()
    userId: string;

    @ApiProperty({ description: 'Bank account number' })
    @IsString()
    @Length(10, 10)
    accountNumber: string;

    @ApiProperty({ description: 'Bank code' })
    @IsString()
    bankCode: string;

    @ApiPropertyOptional({ description: 'Set as default withdrawal account' })
    @IsOptional()
    isDefault?: boolean;
}

export class InitiateWithdrawalDto {
    @ApiProperty({ description: 'User ID initiating the withdrawal' })
    @IsUUID()
    userId: string;

    @ApiProperty({ description: 'Transfer recipient ID (bank account)' })
    @IsUUID()
    recipientId: string;

    @ApiProperty({ description: 'Amount in Naira' })
    @IsNumber()
    @Min(100) // Minimum ₦100
    amountInNaira: number;

    @ApiPropertyOptional({ description: 'Reason/description for the withdrawal' })
    @IsOptional()
    @IsString()
    reason?: string;

    @ApiPropertyOptional({ description: 'Client-generated idempotency key' })
    @IsOptional()
    @IsString()
    idempotencyKey?: string;
}

export class InternalTransferDto {
    @ApiProperty({ description: 'Source user ID' })
    @IsUUID()
    sourceUserId: string;

    @ApiProperty({ description: 'Destination user ID' })
    @IsUUID()
    destinationUserId: string;

    @ApiProperty({ description: 'Amount in Naira' })
    @IsNumber()
    @Min(1)
    amountInNaira: number;

    @ApiPropertyOptional({ description: 'Description/note for the transfer' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ description: 'Client-generated idempotency key' })
    @IsOptional()
    @IsString()
    idempotencyKey?: string;
}

export class BankDto {
    @ApiProperty()
    id: number;

    @ApiProperty()
    name: string;

    @ApiProperty()
    code: string;

    @ApiProperty()
    active: boolean;
}

export class ResolvedAccountDto {
    @ApiProperty()
    accountNumber: string;

    @ApiProperty()
    accountName: string;

    @ApiProperty()
    bankCode: string;
}

export class TransferRecipientResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    bankName: string;

    @ApiProperty()
    accountNumber: string;

    @ApiProperty()
    accountName: string;

    @ApiProperty()
    isDefault: boolean;

    @ApiProperty()
    isVerified: boolean;
}
