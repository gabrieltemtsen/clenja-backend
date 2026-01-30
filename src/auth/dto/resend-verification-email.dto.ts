import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendVerificationEmailDto {
    @ApiProperty({
        example: 'user@example.com',
        description: 'Email address to resend verification code to'
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;
}
