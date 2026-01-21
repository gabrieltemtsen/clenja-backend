import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { Wallet } from '../entities/wallet.entity';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import { Transaction } from '../entities/transaction.entity';
import { WalletOwnerType, WalletStatus, Currency } from '../common/enums';

describe('WalletsService', () => {
    let service: WalletsService;
    let walletRepo: jest.Mocked<Repository<Wallet>>;
    let ledgerRepo: jest.Mocked<Repository<LedgerEntry>>;
    let transactionRepo: jest.Mocked<Repository<Transaction>>;

    const mockWallet: Wallet = {
        id: 'wallet-123',
        ownerType: WalletOwnerType.USER,
        ownerId: 'user-123',
        currency: Currency.NGN,
        status: WalletStatus.ACTIVE,
        cachedBalance: '10000',
        createdAt: new Date(),
        updatedAt: new Date(),
    } as Wallet;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WalletsService,
                {
                    provide: getRepositoryToken(Wallet),
                    useValue: {
                        findOne: jest.fn(),
                        create: jest.fn(),
                        save: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(LedgerEntry),
                    useValue: {
                        findAndCount: jest.fn(),
                        createQueryBuilder: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(Transaction),
                    useValue: {
                        findAndCount: jest.fn(),
                    },
                },
                {
                    provide: DataSource,
                    useValue: {},
                },
            ],
        }).compile();

        service = module.get<WalletsService>(WalletsService);
        walletRepo = module.get(getRepositoryToken(Wallet));
        ledgerRepo = module.get(getRepositoryToken(LedgerEntry));
        transactionRepo = module.get(getRepositoryToken(Transaction));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createWallet', () => {
        it('should create a new wallet', async () => {
            walletRepo.findOne.mockResolvedValue(null);
            walletRepo.create.mockReturnValue(mockWallet);
            walletRepo.save.mockResolvedValue(mockWallet);

            const result = await service.createWallet(
                WalletOwnerType.USER,
                'user-123',
                Currency.NGN,
            );

            expect(result).toEqual(mockWallet);
            expect(walletRepo.create).toHaveBeenCalledWith({
                ownerType: WalletOwnerType.USER,
                ownerId: 'user-123',
                currency: Currency.NGN,
                status: WalletStatus.ACTIVE,
                cachedBalance: '0',
            });
        });

        it('should return existing wallet if one exists', async () => {
            walletRepo.findOne.mockResolvedValue(mockWallet);

            const result = await service.createWallet(
                WalletOwnerType.USER,
                'user-123',
            );

            expect(result).toEqual(mockWallet);
            expect(walletRepo.create).not.toHaveBeenCalled();
        });
    });

    describe('createUserWallet', () => {
        it('should create a wallet for a user', async () => {
            walletRepo.findOne.mockResolvedValue(null);
            walletRepo.create.mockReturnValue(mockWallet);
            walletRepo.save.mockResolvedValue(mockWallet);

            const result = await service.createUserWallet('user-123');

            expect(result.ownerType).toBe(WalletOwnerType.USER);
        });
    });

    describe('getWalletById', () => {
        it('should return a wallet by ID', async () => {
            walletRepo.findOne.mockResolvedValue(mockWallet);

            const result = await service.getWalletById('wallet-123');

            expect(result).toEqual(mockWallet);
        });

        it('should throw NotFoundException if wallet not found', async () => {
            walletRepo.findOne.mockResolvedValue(null);

            await expect(service.getWalletById('non-existent')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('getUserWallet', () => {
        it('should return a user wallet', async () => {
            walletRepo.findOne.mockResolvedValue(mockWallet);

            const result = await service.getUserWallet('user-123');

            expect(result).toEqual(mockWallet);
            expect(walletRepo.findOne).toHaveBeenCalledWith({
                where: {
                    ownerType: WalletOwnerType.USER,
                    ownerId: 'user-123',
                },
            });
        });

        it('should throw NotFoundException if user has no wallet', async () => {
            walletRepo.findOne.mockResolvedValue(null);

            await expect(service.getUserWallet('non-existent')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('getBalance', () => {
        it('should return cached balance as bigint', async () => {
            walletRepo.findOne.mockResolvedValue(mockWallet);

            const result = await service.getBalance('wallet-123');

            expect(result).toBe(BigInt(10000));
        });
    });

    describe('getLedgerBalance', () => {
        it('should compute balance from ledger entries', async () => {
            walletRepo.findOne.mockResolvedValue(mockWallet);

            const mockQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ balance: '50000' }),
            };
            ledgerRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

            const result = await service.getLedgerBalance('wallet-123');

            expect(result).toBe(BigInt(50000));
        });

        it('should return 0 if no ledger entries', async () => {
            walletRepo.findOne.mockResolvedValue(mockWallet);

            const mockQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ balance: null }),
            };
            ledgerRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

            const result = await service.getLedgerBalance('wallet-123');

            expect(result).toBe(BigInt(0));
        });
    });

    describe('getTransactionHistory', () => {
        it('should return paginated transaction history', async () => {
            const mockTransactions = [{ id: 'txn-1' }, { id: 'txn-2' }] as Transaction[];
            transactionRepo.findAndCount.mockResolvedValue([mockTransactions, 2]);

            const result = await service.getTransactionHistory('wallet-123', 1, 20);

            expect(result.transactions).toHaveLength(2);
            expect(result.total).toBe(2);
        });
    });

    describe('getLedgerEntries', () => {
        it('should return paginated ledger entries', async () => {
            const mockEntries = [{ id: 'entry-1' }] as LedgerEntry[];
            ledgerRepo.findAndCount.mockResolvedValue([mockEntries, 1]);

            const result = await service.getLedgerEntries('wallet-123', 1, 50);

            expect(result.entries).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('freezeWallet', () => {
        it('should freeze an active wallet', async () => {
            const activeWallet = { ...mockWallet, status: WalletStatus.ACTIVE };
            walletRepo.findOne.mockResolvedValue(activeWallet);
            walletRepo.save.mockResolvedValue({
                ...activeWallet,
                status: WalletStatus.FROZEN,
            });

            const result = await service.freezeWallet('wallet-123');

            expect(result.status).toBe(WalletStatus.FROZEN);
        });
    });

    describe('unfreezeWallet', () => {
        it('should unfreeze a frozen wallet', async () => {
            const frozenWallet = { ...mockWallet, status: WalletStatus.FROZEN };
            walletRepo.findOne.mockResolvedValue(frozenWallet);
            walletRepo.save.mockResolvedValue({
                ...frozenWallet,
                status: WalletStatus.ACTIVE,
            });

            const result = await service.unfreezeWallet('wallet-123');

            expect(result.status).toBe(WalletStatus.ACTIVE);
        });
    });

    describe('isWalletActive', () => {
        it('should return true for active wallet', async () => {
            walletRepo.findOne.mockResolvedValue(mockWallet);

            const result = await service.isWalletActive('wallet-123');

            expect(result).toBe(true);
        });

        it('should return false for frozen wallet', async () => {
            walletRepo.findOne.mockResolvedValue({
                ...mockWallet,
                status: WalletStatus.FROZEN,
            });

            const result = await service.isWalletActive('wallet-123');

            expect(result).toBe(false);
        });
    });
});
