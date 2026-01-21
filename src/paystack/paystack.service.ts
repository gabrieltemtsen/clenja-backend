import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface PaystackInitializeResponse {
    status: boolean;
    message: string;
    data: {
        authorization_url: string;
        access_code: string;
        reference: string;
    };
}

export interface PaystackVerifyResponse {
    status: boolean;
    message: string;
    data: {
        id: number;
        status: 'success' | 'failed' | 'abandoned' | 'pending';
        reference: string;
        amount: number;
        currency: string;
        channel: string;
        paid_at: string;
        customer: {
            email: string;
            customer_code: string;
        };
        metadata: Record<string, any>;
        authorization?: {
            authorization_code: string;
            card_type: string;
            last4: string;
            bank: string;
        };
    };
}

export interface PaystackBankListResponse {
    status: boolean;
    message: string;
    data: Array<{
        id: number;
        name: string;
        slug: string;
        code: string;
        active: boolean;
        country: string;
        currency: string;
        type: string;
    }>;
}

export interface PaystackResolveAccountResponse {
    status: boolean;
    message: string;
    data: {
        account_number: string;
        account_name: string;
        bank_id: number;
    };
}

export interface PaystackCreateRecipientResponse {
    status: boolean;
    message: string;
    data: {
        active: boolean;
        recipient_code: string;
        type: string;
        name: string;
        details: {
            account_number: string;
            account_name: string;
            bank_code: string;
            bank_name: string;
        };
    };
}

export interface PaystackTransferResponse {
    status: boolean;
    message: string;
    data: {
        reference: string;
        integration: number;
        domain: string;
        amount: number;
        currency: string;
        source: string;
        reason: string;
        recipient: number;
        status: 'pending' | 'success' | 'failed' | 'reversed';
        transfer_code: string;
        id: number;
        createdAt: string;
        updatedAt: string;
    };
}

export interface PaystackBalanceResponse {
    status: boolean;
    message: string;
    data: Array<{
        currency: string;
        balance: number;
    }>;
}

@Injectable()
export class PaystackService {
    private readonly logger = new Logger(PaystackService.name);
    private readonly baseUrl: string;
    private readonly secretKey: string;

    constructor(private readonly configService: ConfigService) {
        this.baseUrl = this.configService.get<string>('PAYSTACK_BASE_URL', 'https://api.paystack.co');
        this.secretKey = this.configService.getOrThrow<string>('PAYSTACK_SECRET_KEY');
    }

    /**
     * Makes an authenticated request to Paystack API.
     */
    private async request<T>(
        method: 'GET' | 'POST',
        endpoint: string,
        body?: Record<string, any>,
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${this.secretKey}`,
                    'Content-Type': 'application/json',
                },
                body: body ? JSON.stringify(body) : undefined,
            });

            const data = await response.json();

            if (!response.ok) {
                this.logger.error(`Paystack API error: ${JSON.stringify(data)}`);
                throw new HttpException(
                    data.message || 'Paystack API error',
                    response.status,
                );
            }

            return data as T;
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            this.logger.error(`Paystack request failed: ${error}`);
            throw new HttpException(
                'Payment service unavailable',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
    }

    /**
     * Initialize a transaction for deposits.
     */
    async initializeTransaction(
        email: string,
        amount: number, // in kobo
        reference: string,
        metadata?: Record<string, any>,
        callbackUrl?: string,
    ): Promise<PaystackInitializeResponse> {
        return this.request<PaystackInitializeResponse>('POST', '/transaction/initialize', {
            email,
            amount,
            reference,
            metadata,
            callback_url: callbackUrl,
        });
    }

    /**
     * Verify a transaction status.
     */
    async verifyTransaction(reference: string): Promise<PaystackVerifyResponse> {
        return this.request<PaystackVerifyResponse>('GET', `/transaction/verify/${reference}`);
    }

    /**
     * List all supported banks.
     */
    async listBanks(country: string = 'nigeria'): Promise<PaystackBankListResponse> {
        return this.request<PaystackBankListResponse>('GET', `/bank?country=${country}`);
    }

    /**
     * Resolve bank account to get account name.
     */
    async resolveAccountNumber(
        accountNumber: string,
        bankCode: string,
    ): Promise<PaystackResolveAccountResponse> {
        return this.request<PaystackResolveAccountResponse>(
            'GET',
            `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        );
    }

    /**
     * Create a transfer recipient for withdrawals.
     */
    async createTransferRecipient(
        name: string,
        accountNumber: string,
        bankCode: string,
    ): Promise<PaystackCreateRecipientResponse> {
        return this.request<PaystackCreateRecipientResponse>('POST', '/transferrecipient', {
            type: 'nuban',
            name,
            account_number: accountNumber,
            bank_code: bankCode,
            currency: 'NGN',
        });
    }

    /**
     * Initiate a transfer (withdrawal).
     */
    async initiateTransfer(
        amount: number, // in kobo
        recipientCode: string,
        reason: string,
        reference: string,
    ): Promise<PaystackTransferResponse> {
        return this.request<PaystackTransferResponse>('POST', '/transfer', {
            source: 'balance',
            amount,
            recipient: recipientCode,
            reason,
            reference,
        });
    }

    /**
     * Get Paystack account balance.
     */
    async getBalance(): Promise<PaystackBalanceResponse> {
        return this.request<PaystackBalanceResponse>('GET', '/balance');
    }

    /**
     * Verify webhook signature.
     */
    verifyWebhookSignature(payload: string, signature: string): boolean {
        const hash = crypto
            .createHmac('sha512', this.secretKey)
            .update(payload)
            .digest('hex');
        return hash === signature;
    }
}
