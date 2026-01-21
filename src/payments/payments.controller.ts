import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Headers,
    Req,
    HttpCode,
    HttpStatus,
    RawBodyRequest,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { InitializeDepositDto } from './dto/payments.dto';
import { koboToNaira } from '../common/utils/reference-generator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Post('deposits/initialize')
    @ApiOperation({ summary: 'Initialize a deposit transaction' })
    async initializeDeposit(@Body() dto: InitializeDepositDto) {
        const result = await this.paymentsService.initializeDeposit(
            dto.userId,
            dto.email,
            dto.amountInNaira,
            dto.callbackUrl,
            dto.idempotencyKey,
        );

        return {
            success: true,
            data: {
                transactionId: result.transaction.id,
                reference: result.transaction.reference,
                authorizationUrl: result.authorizationUrl,
                accessCode: result.accessCode,
                amount: {
                    kobo: result.transaction.amount,
                    naira: koboToNaira(result.transaction.amount),
                },
            },
        };
    }

    @Get('deposits/:reference/verify')
    @ApiOperation({ summary: 'Verify a deposit transaction' })
    async verifyDeposit(@Param('reference') reference: string) {
        const transaction = await this.paymentsService.verifyDeposit(reference);

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

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Post('paystack')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Handle Paystack webhook events' })
    @ApiHeader({ name: 'x-paystack-signature', description: 'Paystack signature' })
    async handlePaystackWebhook(
        @Headers('x-paystack-signature') signature: string,
        @Body() body: { event: string; data: Record<string, any> },
        @Req() req: RawBodyRequest<Request>,
    ) {
        const rawBody = req.rawBody?.toString() || JSON.stringify(body);

        await this.paymentsService.handleWebhook(
            body.event,
            body.data,
            signature,
            rawBody,
        );

        return { status: 'success' };
    }
}
