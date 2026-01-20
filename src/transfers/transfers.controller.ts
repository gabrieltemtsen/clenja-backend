import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TransfersService } from './transfers.service';
import {
    ResolveAccountDto,
    AddBankAccountDto,
    InitiateWithdrawalDto,
    InternalTransferDto,
} from './dto/transfers.dto';
import { koboToNaira } from '../common/utils/reference-generator';

@ApiTags('Transfers')
@Controller('transfers')
export class TransfersController {
    constructor(private readonly transfersService: TransfersService) { }

    @Get('banks')
    @ApiOperation({ summary: 'List all supported banks' })
    async listBanks() {
        const banks = await this.transfersService.listBanks();
        return {
            success: true,
            data: banks.map((bank) => ({
                id: bank.id,
                name: bank.name,
                code: bank.code,
            })),
        };
    }

    @Post('resolve-account')
    @ApiOperation({ summary: 'Resolve bank account to get account name' })
    async resolveAccount(@Body() dto: ResolveAccountDto) {
        const result = await this.transfersService.resolveAccount(
            dto.accountNumber,
            dto.bankCode,
        );

        return {
            success: true,
            data: result,
        };
    }

    @Post('recipients')
    @ApiOperation({ summary: 'Add a bank account for withdrawals' })
    async addBankAccount(@Body() dto: AddBankAccountDto) {
        const recipient = await this.transfersService.addBankAccount(
            dto.userId,
            dto.accountNumber,
            dto.bankCode,
            dto.isDefault,
        );

        return {
            success: true,
            data: {
                id: recipient.id,
                bankName: recipient.bankName,
                accountNumber: recipient.accountNumber,
                accountName: recipient.accountName,
                isDefault: recipient.isDefault,
                isVerified: recipient.isVerified,
            },
        };
    }

    @Get('recipients')
    @ApiOperation({ summary: 'Get all bank accounts for a user' })
    @ApiQuery({ name: 'userId', required: true })
    async getUserBankAccounts(@Query('userId', ParseUUIDPipe) userId: string) {
        const recipients = await this.transfersService.getUserBankAccounts(userId);

        return {
            success: true,
            data: recipients.map((r) => ({
                id: r.id,
                bankName: r.bankName,
                bankCode: r.bankCode,
                accountNumber: r.accountNumber,
                accountName: r.accountName,
                isDefault: r.isDefault,
                isVerified: r.isVerified,
            })),
        };
    }

    @Delete('recipients/:recipientId')
    @ApiOperation({ summary: 'Delete a bank account' })
    @ApiParam({ name: 'recipientId', description: 'Recipient ID' })
    @ApiQuery({ name: 'userId', required: true })
    async deleteBankAccount(
        @Param('recipientId', ParseUUIDPipe) recipientId: string,
        @Query('userId', ParseUUIDPipe) userId: string,
    ) {
        await this.transfersService.deleteBankAccount(userId, recipientId);

        return {
            success: true,
            message: 'Bank account deleted',
        };
    }

    @Post('withdraw')
    @ApiOperation({ summary: 'Initiate a withdrawal to a bank account' })
    async initiateWithdrawal(@Body() dto: InitiateWithdrawalDto) {
        const transaction = await this.transfersService.initiateWithdrawal(
            dto.userId,
            dto.recipientId,
            dto.amountInNaira,
            dto.reason,
            dto.idempotencyKey,
        );

        return {
            success: true,
            data: {
                transactionId: transaction.id,
                reference: transaction.reference,
                status: transaction.status,
                amount: {
                    kobo: transaction.amount,
                    naira: koboToNaira(transaction.amount),
                },
            },
        };
    }

    @Post('internal')
    @ApiOperation({ summary: 'Transfer funds between users' })
    async internalTransfer(@Body() dto: InternalTransferDto) {
        const transaction = await this.transfersService.internalTransfer(
            dto.sourceUserId,
            dto.destinationUserId,
            dto.amountInNaira,
            dto.description,
            dto.idempotencyKey,
        );

        return {
            success: true,
            data: {
                transactionId: transaction.id,
                reference: transaction.reference,
                status: transaction.status,
                amount: {
                    kobo: transaction.amount,
                    naira: koboToNaira(transaction.amount),
                },
            },
        };
    }
}
