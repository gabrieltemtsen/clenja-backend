import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { PaystackService } from './paystack.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('PaystackService', () => {
    let service: PaystackService;
    let configService: ConfigService;

    const mockSecretKey = 'sk_test_mock_secret_key';
    const mockBaseUrl = 'https://api.paystack.co';

    beforeEach(async () => {
        mockFetch.mockClear();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaystackService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string, defaultValue?: string) => {
                            if (key === 'PAYSTACK_BASE_URL') return mockBaseUrl;
                            return defaultValue;
                        }),
                        getOrThrow: jest.fn((key: string) => {
                            if (key === 'PAYSTACK_SECRET_KEY') return mockSecretKey;
                            throw new Error(`Config ${key} not found`);
                        }),
                    },
                },
            ],
        }).compile();

        service = module.get<PaystackService>(PaystackService);
        configService = module.get<ConfigService>(ConfigService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('initializeTransaction', () => {
        it('should initialize a transaction successfully', async () => {
            const mockResponse = {
                status: true,
                message: 'Authorization URL created',
                data: {
                    authorization_url: 'https://checkout.paystack.com/abc123',
                    access_code: 'abc123',
                    reference: 'TXN-20260121-DEP-ABC123',
                },
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await service.initializeTransaction(
                'test@example.com',
                10000, // 100 NGN in kobo
                'TXN-20260121-DEP-ABC123',
                { userId: 'user-123' },
                'https://example.com/callback',
            );

            expect(result).toEqual(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith(
                `${mockBaseUrl}/transaction/initialize`,
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${mockSecretKey}`,
                        'Content-Type': 'application/json',
                    },
                }),
            );
        });

        it('should throw HttpException on API error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: () => Promise.resolve({ message: 'Invalid email' }),
            });

            await expect(
                service.initializeTransaction('invalid', 10000, 'ref-123'),
            ).rejects.toThrow(HttpException);
        });
    });

    describe('verifyTransaction', () => {
        it('should verify a transaction successfully', async () => {
            const mockResponse = {
                status: true,
                message: 'Verification successful',
                data: {
                    id: 12345,
                    status: 'success',
                    reference: 'TXN-20260121-DEP-ABC123',
                    amount: 10000,
                    currency: 'NGN',
                    channel: 'card',
                    paid_at: '2026-01-21T05:00:00.000Z',
                    customer: {
                        email: 'test@example.com',
                        customer_code: 'CUS_abc123',
                    },
                    metadata: {},
                },
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await service.verifyTransaction('TXN-20260121-DEP-ABC123');

            expect(result).toEqual(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith(
                `${mockBaseUrl}/transaction/verify/TXN-20260121-DEP-ABC123`,
                expect.objectContaining({
                    method: 'GET',
                }),
            );
        });

        it('should handle failed verification', async () => {
            const mockResponse = {
                status: true,
                message: 'Verification successful',
                data: {
                    status: 'failed',
                    reference: 'TXN-123',
                },
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await service.verifyTransaction('TXN-123');
            expect(result.data.status).toBe('failed');
        });
    });

    describe('listBanks', () => {
        it('should list all Nigerian banks', async () => {
            const mockResponse = {
                status: true,
                message: 'Banks retrieved',
                data: [
                    { id: 1, name: 'Access Bank', code: '044', active: true },
                    { id: 2, name: 'GTBank', code: '058', active: true },
                ],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await service.listBanks();

            expect(result.data).toHaveLength(2);
            expect(mockFetch).toHaveBeenCalledWith(
                `${mockBaseUrl}/bank?country=nigeria`,
                expect.any(Object),
            );
        });
    });

    describe('resolveAccountNumber', () => {
        it('should resolve a bank account', async () => {
            const mockResponse = {
                status: true,
                message: 'Account number resolved',
                data: {
                    account_number: '0123456789',
                    account_name: 'JOHN DOE',
                    bank_id: 1,
                },
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await service.resolveAccountNumber('0123456789', '044');

            expect(result.data.account_name).toBe('JOHN DOE');
            expect(mockFetch).toHaveBeenCalledWith(
                `${mockBaseUrl}/bank/resolve?account_number=0123456789&bank_code=044`,
                expect.any(Object),
            );
        });
    });

    describe('createTransferRecipient', () => {
        it('should create a transfer recipient', async () => {
            const mockResponse = {
                status: true,
                message: 'Recipient created',
                data: {
                    active: true,
                    recipient_code: 'RCP_abc123',
                    type: 'nuban',
                    name: 'John Doe',
                    details: {
                        account_number: '0123456789',
                        account_name: 'JOHN DOE',
                        bank_code: '044',
                        bank_name: 'Access Bank',
                    },
                },
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await service.createTransferRecipient(
                'John Doe',
                '0123456789',
                '044',
            );

            expect(result.data.recipient_code).toBe('RCP_abc123');
        });
    });

    describe('initiateTransfer', () => {
        it('should initiate a transfer', async () => {
            const mockResponse = {
                status: true,
                message: 'Transfer has been queued',
                data: {
                    reference: 'TXN-20260121-WTH-ABC123',
                    integration: 100,
                    domain: 'test',
                    amount: 10000,
                    currency: 'NGN',
                    source: 'balance',
                    reason: 'Withdrawal',
                    recipient: 123,
                    status: 'pending',
                    transfer_code: 'TRF_abc123',
                    id: 456,
                    createdAt: '2026-01-21T05:00:00.000Z',
                    updatedAt: '2026-01-21T05:00:00.000Z',
                },
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await service.initiateTransfer(
                10000,
                'RCP_abc123',
                'Withdrawal',
                'TXN-20260121-WTH-ABC123',
            );

            expect(result.data.status).toBe('pending');
            expect(result.data.transfer_code).toBe('TRF_abc123');
        });
    });

    describe('getBalance', () => {
        it('should get Paystack account balance', async () => {
            const mockResponse = {
                status: true,
                message: 'Balances retrieved',
                data: [
                    { currency: 'NGN', balance: 500000 },
                ],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await service.getBalance();

            expect(result.data[0].balance).toBe(500000);
        });
    });

    describe('verifyWebhookSignature', () => {
        it('should verify a valid webhook signature', () => {
            const crypto = require('crypto');
            const payload = JSON.stringify({ event: 'charge.success' });
            const expectedHash = crypto
                .createHmac('sha512', mockSecretKey)
                .update(payload)
                .digest('hex');

            const result = service.verifyWebhookSignature(payload, expectedHash);
            expect(result).toBe(true);
        });

        it('should reject an invalid webhook signature', () => {
            const payload = JSON.stringify({ event: 'charge.success' });
            const invalidSignature = 'invalid_signature_hash';

            const result = service.verifyWebhookSignature(payload, invalidSignature);
            expect(result).toBe(false);
        });
    });

    describe('error handling', () => {
        it('should throw SERVICE_UNAVAILABLE on network error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(
                service.initializeTransaction('test@example.com', 10000, 'ref-123'),
            ).rejects.toThrow(HttpException);
        });
    });
});
