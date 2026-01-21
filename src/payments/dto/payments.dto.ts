import { IsEmail, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitializeDepositDto {
    @ApiProperty({ description: 'User ID initiating the deposit' })
    @IsUUID()
    userId: string;

    @ApiProperty({ description: 'Email for Paystack checkout' })
    @IsEmail()
    email: string;

    @ApiProperty({ description: 'Amount in Naira (will be converted to Kobo)' })
    @IsNumber()
    @Min(100) // Minimum ₦100
    amountInNaira: number;

    @ApiPropertyOptional({ description: 'Callback URL after payment' })
    @IsOptional()
    @IsString()
    callbackUrl?: string;

    @ApiPropertyOptional({ description: 'Client-generated idempotency key' })
    @IsOptional()
    @IsString()
    idempotencyKey?: string;
}

export class VerifyDepositDto {
    @ApiProperty({ description: 'Paystack transaction reference' })
    @IsString()
    reference: string;
}

export class DepositResponseDto {
    @ApiProperty()
    transactionId: string;

    @ApiProperty()
    reference: string;

    @ApiProperty()
    authorizationUrl: string;

    @ApiProperty()
    accessCode: string;

    @ApiProperty()
    amount: {
        kobo: string;
        naira: number;
    };
}

export class VerifyDepositResponseDto {
    @ApiProperty()
    transactionId: string;

    @ApiProperty()
    reference: string;

    @ApiProperty()
    status: string;

    @ApiProperty()
    amount: {
        kobo: string;
        naira: number;
    };

    @ApiPropertyOptional()
    walletBalance?: {
        kobo: string;
        naira: number;
    };
}
