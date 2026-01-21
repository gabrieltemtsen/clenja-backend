import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Transaction } from '../entities/transaction.entity';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { PaystackService } from '../paystack/paystack.service';
import { WalletsService } from '../wallets/wallets.service';
import { LedgerService } from '../ledger/ledger.service';
import { TransactionType, TransactionStatus, Currency } from '../common/enums';

describe('PaymentsService', () => {
    let service: PaymentsService;
    let transactionRepo: jest.Mocked<Repository<Transaction>>;
    let webhookRepo: jest.Mocked<Repository<WebhookEvent>>;
    let paystackService: jest.Mocked<PaystackService>;
    let walletsService: jest.Mocked<WalletsService>;
    let ledgerService: jest.Mocked<LedgerService>;

    const mockTransaction: Transaction = {
        id: 'txn-123',
        reference: 'TXN-20260121-DEP-ABC123',
        idempotencyKey: 'idp-key-123',
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.PENDING,
        amount: '10000',
        currency: Currency.NGN,
        initiatedByUserId: 'user-123',
        destinationWalletId: 'wallet-123',
        providerReference: 'paystack-ref-123',
        createdAt: new Date(),
        updatedAt: new Date(),
    } as Transaction;

    const mockWallet = {
        id: 'wallet-123',
        ownerId: 'user-123',
        cachedBalance: '50000',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaymentsService,
                {
                    provide: getRepositoryToken(Transaction),
                    useValue: {
                        findOne: jest.fn(),
                        create: jest.fn(),
                        save: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(WebhookEvent),
                    useValue: {
                        findOne: jest.fn(),
                        create: jest.fn(),
                        save: jest.fn(),
                    },
                },
                {
                    provide: PaystackService,
                    useValue: {
                        initializeTransaction: jest.fn(),
                        verifyTransaction: jest.fn(),
                        verifyWebhookSignature: jest.fn(),
                    },
                },
                {
                    provide: WalletsService,
                    useValue: {
                        getUserWallet: jest.fn(),
                    },
                },
                {
                    provide: LedgerService,
                    useValue: {
                        createPendingTransaction: jest.fn(),
                        completePendingTransaction: jest.fn(),
                        failTransaction: jest.fn(),
                        getTransactionByProviderReference: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<PaymentsService>(PaymentsService);
        transactionRepo = module.get(getRepositoryToken(Transaction));
        webhookRepo = module.get(getRepositoryToken(WebhookEvent));
        paystackService = module.get(PaystackService);
        walletsService = module.get(WalletsService);
        ledgerService = module.get(LedgerService);

        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('initializeDeposit', () => {
        it('should initialize a deposit successfully', async () => {
            const paystackResponse = {
                status: true,
                message: 'Authorization URL created',
                data: {
                    authorization_url: 'https://checkout.paystack.com/abc123',
                    access_code: 'abc123',
                    reference: 'TXN-20260121-DEP-ABC123',
                },
            };

            walletsService.getUserWallet.mockResolvedValue(mockWallet as any);
            ledgerService.createPendingTransaction.mockResolvedValue(mockTransaction);
            paystackService.initializeTransaction.mockResolvedValue(paystackResponse);
            transactionRepo.save.mockResolvedValue({
                ...mockTransaction,
                providerReference: paystackResponse.data.reference,
            });

            const result = await service.initializeDeposit(
                'user-123',
                'test@example.com',
                100, // 100 NGN
                'https://example.com/callback',
            );

            expect(result.authorizationUrl).toBe(paystackResponse.data.authorization_url);
            expect(result.accessCode).toBe(paystackResponse.data.access_code);
            expect(walletsService.getUserWallet).toHaveBeenCalledWith('user-123');
        });

        it('should throw BadRequestException for invalid amount', async () => {
            walletsService.getUserWallet.mockResolvedValue(mockWallet as any);

            await expect(
                service.initializeDeposit('user-123', 'test@example.com', 0),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('verifyDeposit', () => {
        it('should verify a successful deposit', async () => {
            const verifyResponse = {
                status: true,
                message: 'Verification successful',
                data: {
                    id: 12345,
                    status: 'success' as const,
                    reference: 'TXN-20260121-DEP-ABC123',
                    amount: 10000,
                    currency: 'NGN',
                    channel: 'card',
                    paid_at: '2026-01-21T05:00:00.000Z',
                    customer: { email: 'test@example.com', customer_code: 'CUS_123' },
                    metadata: {},
                },
            };

            transactionRepo.findOne.mockResolvedValue(mockTransaction);
            paystackService.verifyTransaction.mockResolvedValue(verifyResponse);
            ledgerService.completePendingTransaction.mockResolvedValue({
                transaction: { ...mockTransaction, status: TransactionStatus.COMPLETED },
                ledgerEntries: [],
            });

            const result = await service.verifyDeposit('TXN-20260121-DEP-ABC123');

            expect(result.status).toBe(TransactionStatus.COMPLETED);
        });

        it('should throw NotFoundException for non-existent transaction', async () => {
            transactionRepo.findOne.mockResolvedValue(null);

            await expect(
                service.verifyDeposit('non-existent'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should handle failed verification from Paystack', async () => {
            const verifyResponse = {
                status: true,
                message: 'Verification successful',
                data: {
                    id: 12345,
                    status: 'failed' as const,
                    reference: 'TXN-123',
                    amount: 10000,
                    currency: 'NGN',
                    channel: 'card',
                    paid_at: '2026-01-21T05:00:00.000Z',
                    customer: { email: 'test@example.com', customer_code: 'CUS_123' },
                    metadata: {},
                },
            };

            transactionRepo.findOne.mockResolvedValue(mockTransaction);
            paystackService.verifyTransaction.mockResolvedValue(verifyResponse);
            ledgerService.failTransaction.mockResolvedValue({
                ...mockTransaction,
                status: TransactionStatus.FAILED,
            });

            const result = await service.verifyDeposit('TXN-123');

            expect(result.status).toBe(TransactionStatus.FAILED);
        });
    });

    describe('handleWebhook', () => {
        const rawBody = '{"event":"charge.success","data":{}}';
        const signature = 'valid-signature';

        it('should process a valid webhook', async () => {
            paystackService.verifyWebhookSignature.mockReturnValue(true);
            webhookRepo.findOne.mockResolvedValue(null);
            webhookRepo.create.mockReturnValue({} as WebhookEvent);
            webhookRepo.save.mockResolvedValue({} as WebhookEvent);

            await expect(
                service.handleWebhook('charge.success', { reference: 'ref' }, signature, rawBody),
            ).resolves.not.toThrow();
        });

        it('should reject invalid webhook signature', async () => {
            paystackService.verifyWebhookSignature.mockReturnValue(false);

            await expect(
                service.handleWebhook('charge.success', {}, 'invalid', rawBody),
            ).rejects.toThrow(BadRequestException);
        });

        it('should skip duplicate webhook events', async () => {
            paystackService.verifyWebhookSignature.mockReturnValue(true);
            webhookRepo.findOne.mockResolvedValue({ isProcessed: true } as WebhookEvent);

            await expect(
                service.handleWebhook('charge.success', { id: 'event-123' }, signature, rawBody),
            ).resolves.not.toThrow();
        });
    });
});
