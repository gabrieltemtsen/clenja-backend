import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { Wallet } from '../entities/wallet.entity';
import { Transaction } from '../entities/transaction.entity';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import {
    TransactionType,
    TransactionStatus,
    Currency,
} from '../common/enums';

describe('LedgerService', () => {
    let service: LedgerService;
    let transactionRepo: jest.Mocked<Repository<Transaction>>;

    const mockTransaction: Transaction = {
        id: 'txn-123',
        reference: 'TXN-20260121-DEP-ABC123',
        idempotencyKey: 'idp-key-123',
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
        amount: '10000',
        currency: Currency.NGN,
        initiatedByUserId: 'user-123',
        destinationWalletId: 'wallet-123',
        createdAt: new Date(),
        updatedAt: new Date(),
    } as Transaction;

    const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                LedgerService,
                {
                    provide: getRepositoryToken(Wallet),
                    useValue: {
                        findOne: jest.fn(),
                        save: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(Transaction),
                    useValue: {
                        findOne: jest.fn(),
                        create: jest.fn(),
                        save: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(LedgerEntry),
                    useValue: {
                        create: jest.fn(),
                        save: jest.fn(),
                    },
                },
                {
                    provide: DataSource,
                    useValue: {
                        createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
                    },
                },
            ],
        }).compile();

        service = module.get<LedgerService>(LedgerService);
        transactionRepo = module.get(getRepositoryToken(Transaction));

        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getTransactionByReference', () => {
        it('should return a transaction by reference', async () => {
            transactionRepo.findOne.mockResolvedValue(mockTransaction);

            const result = await service.getTransactionByReference('TXN-20260121-DEP-ABC123');

            expect(result).toEqual(mockTransaction);
            expect(transactionRepo.findOne).toHaveBeenCalledWith({
                where: { reference: 'TXN-20260121-DEP-ABC123' },
            });
        });

        it('should return null if transaction not found', async () => {
            transactionRepo.findOne.mockResolvedValue(null);

            const result = await service.getTransactionByReference('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('getTransactionByProviderReference', () => {
        it('should return a transaction by provider reference', async () => {
            transactionRepo.findOne.mockResolvedValue(mockTransaction);

            const result = await service.getTransactionByProviderReference('paystack-ref-123');

            expect(result).toEqual(mockTransaction);
        });
    });

    describe('createPendingTransaction', () => {
        it('should create a pending transaction', async () => {
            const pendingTxn = {
                ...mockTransaction,
                status: TransactionStatus.PENDING,
            };
            transactionRepo.findOne.mockResolvedValue(null);
            transactionRepo.create.mockReturnValue(pendingTxn);
            transactionRepo.save.mockResolvedValue(pendingTxn);

            const result = await service.createPendingTransaction({
                type: TransactionType.WITHDRAWAL,
                amount: BigInt(10000),
                initiatedByUserId: 'user-123',
                sourceWalletId: 'wallet-123',
            });

            expect(result.status).toBe(TransactionStatus.PENDING);
        });

        it('should throw ConflictException for duplicate idempotency key', async () => {
            transactionRepo.findOne.mockResolvedValue(mockTransaction);

            await expect(
                service.createPendingTransaction({
                    type: TransactionType.DEPOSIT,
                    amount: BigInt(10000),
                    initiatedByUserId: 'user-123',
                    idempotencyKey: 'existing-key',
                }),
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('failTransaction', () => {
        it('should fail a pending transaction', async () => {
            const pendingTxn = { ...mockTransaction, status: TransactionStatus.PENDING };
            transactionRepo.findOne.mockResolvedValue(pendingTxn);
            transactionRepo.save.mockResolvedValue({
                ...pendingTxn,
                status: TransactionStatus.FAILED,
                failureReason: 'Test failure',
            });

            const result = await service.failTransaction('txn-123', 'Test failure');

            expect(result.status).toBe(TransactionStatus.FAILED);
            expect(result.failureReason).toBe('Test failure');
        });

        it('should throw NotFoundException for non-existent transaction', async () => {
            transactionRepo.findOne.mockResolvedValue(null);

            await expect(
                service.failTransaction('non-existent', 'Reason'),
            ).rejects.toThrow(NotFoundException);
        });
    });
});
