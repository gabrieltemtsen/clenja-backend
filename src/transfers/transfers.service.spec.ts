import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { TransferRecipient } from '../entities/transfer-recipient.entity';
import { Transaction } from '../entities/transaction.entity';
import { PaystackService } from '../paystack/paystack.service';
import { WalletsService } from '../wallets/wallets.service';
import { LedgerService } from '../ledger/ledger.service';
import { TransactionType, TransactionStatus, Currency, WalletOwnerType } from '../common/enums';

describe('TransfersService', () => {
    let service: TransfersService;
    let recipientRepo: jest.Mocked<Repository<TransferRecipient>>;
    let transactionRepo: jest.Mocked<Repository<Transaction>>;
    let paystackService: jest.Mocked<PaystackService>;
    let walletsService: jest.Mocked<WalletsService>;
    let ledgerService: jest.Mocked<LedgerService>;

    const mockRecipient: TransferRecipient = {
        id: 'recipient-123',
        userId: 'user-123',
        bankCode: '044',
        bankName: 'Access Bank',
        accountNumber: '0123456789',
        accountName: 'JOHN DOE',
        recipientCode: 'RCP_abc123',
        isDefault: true,
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    } as TransferRecipient;

    const mockWallet = {
        id: 'wallet-123',
        ownerId: 'user-123',
        ownerType: WalletOwnerType.USER,
        cachedBalance: '100000', // 1000 NGN in kobo
        currency: Currency.NGN,
    };

    const mockTransaction: Transaction = {
        id: 'txn-123',
        reference: 'TXN-20260121-WTH-ABC123',
        idempotencyKey: 'idp-key-123',
        type: TransactionType.WITHDRAWAL,
        status: TransactionStatus.PENDING,
        amount: '10000',
        currency: Currency.NGN,
        initiatedByUserId: 'user-123',
        sourceWalletId: 'wallet-123',
        createdAt: new Date(),
        updatedAt: new Date(),
    } as Transaction;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TransfersService,
                {
                    provide: getRepositoryToken(TransferRecipient),
                    useValue: {
                        findOne: jest.fn(),
                        find: jest.fn(),
                        create: jest.fn(),
                        save: jest.fn(),
                        delete: jest.fn(),
                        update: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(Transaction),
                    useValue: {
                        findOne: jest.fn(),
                        save: jest.fn(),
                    },
                },
                {
                    provide: PaystackService,
                    useValue: {
                        listBanks: jest.fn(),
                        resolveAccountNumber: jest.fn(),
                        createTransferRecipient: jest.fn(),
                        initiateTransfer: jest.fn(),
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
                        postTransfer: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<TransfersService>(TransfersService);
        recipientRepo = module.get(getRepositoryToken(TransferRecipient));
        transactionRepo = module.get(getRepositoryToken(Transaction));
        paystackService = module.get(PaystackService);
        walletsService = module.get(WalletsService);
        ledgerService = module.get(LedgerService);

        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('listBanks', () => {
        it('should return list of banks', async () => {
            const banksResponse = {
                status: true,
                message: 'Banks retrieved',
                data: [
                    { id: 1, name: 'Access Bank', slug: 'access-bank', code: '044', active: true, country: 'nigeria', currency: 'NGN', type: 'nuban' },
                    { id: 2, name: 'GTBank', slug: 'gtbank', code: '058', active: true, country: 'nigeria', currency: 'NGN', type: 'nuban' },
                ],
            };

            paystackService.listBanks.mockResolvedValue(banksResponse);

            const result = await service.listBanks();

            expect(result).toHaveLength(2);
        });
    });

    describe('resolveAccount', () => {
        it('should resolve a bank account', async () => {
            const resolveResponse = {
                status: true,
                message: 'Account resolved',
                data: {
                    account_number: '0123456789',
                    account_name: 'JOHN DOE',
                    bank_id: 1,
                },
            };

            paystackService.resolveAccountNumber.mockResolvedValue(resolveResponse);

            const result = await service.resolveAccount('0123456789', '044');

            expect(result.accountName).toBe('JOHN DOE');
            expect(result.accountNumber).toBe('0123456789');
        });
    });

    describe('addBankAccount', () => {
        it('should add a new bank account', async () => {
            const resolveResponse = {
                status: true,
                message: 'Account resolved',
                data: {
                    account_number: '0123456789',
                    account_name: 'JOHN DOE',
                    bank_id: 1,
                },
            };

            const recipientResponse = {
                status: true,
                message: 'Recipient created',
                data: {
                    recipient_code: 'RCP_abc123',
                    active: true,
                    type: 'nuban',
                    name: 'JOHN DOE',
                    details: {
                        account_number: '0123456789',
                        account_name: 'JOHN DOE',
                        bank_code: '044',
                        bank_name: 'Access Bank',
                    },
                },
            };

            paystackService.resolveAccountNumber.mockResolvedValue(resolveResponse);
            paystackService.createTransferRecipient.mockResolvedValue(recipientResponse);
            paystackService.listBanks.mockResolvedValue({
                status: true,
                message: 'Banks retrieved',
                data: [{ id: 1, name: 'Access Bank', slug: 'access-bank', code: '044', active: true, country: 'nigeria', currency: 'NGN', type: 'nuban' }],
            });
            recipientRepo.findOne.mockResolvedValue(null);
            recipientRepo.create.mockReturnValue(mockRecipient);
            recipientRepo.save.mockResolvedValue(mockRecipient);

            const result = await service.addBankAccount('user-123', '0123456789', '044', true);

            expect(result.recipientCode).toBe('RCP_abc123');
            expect(result.isDefault).toBe(true);
        });

        it('should return existing account if already added', async () => {
            recipientRepo.findOne.mockResolvedValue(mockRecipient);

            const result = await service.addBankAccount('user-123', '0123456789', '044');

            expect(result).toEqual(mockRecipient);
            expect(paystackService.createTransferRecipient).not.toHaveBeenCalled();
        });
    });

    describe('getUserBankAccounts', () => {
        it('should return all bank accounts for a user', async () => {
            recipientRepo.find.mockResolvedValue([mockRecipient]);

            const result = await service.getUserBankAccounts('user-123');

            expect(result).toHaveLength(1);
            expect(recipientRepo.find).toHaveBeenCalledWith({
                where: { userId: 'user-123' },
                order: { isDefault: 'DESC', createdAt: 'DESC' },
            });
        });
    });

    describe('getBankAccount', () => {
        it('should return a specific bank account', async () => {
            recipientRepo.findOne.mockResolvedValue(mockRecipient);

            const result = await service.getBankAccount('recipient-123');

            expect(result).toEqual(mockRecipient);
        });

        it('should throw NotFoundException if account not found', async () => {
            recipientRepo.findOne.mockResolvedValue(null);

            await expect(service.getBankAccount('non-existent')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('setDefaultAccount', () => {
        it('should set an account as default', async () => {
            recipientRepo.findOne.mockResolvedValue(mockRecipient);
            recipientRepo.update.mockResolvedValue({ affected: 1 } as any);
            recipientRepo.save.mockResolvedValue({ ...mockRecipient, isDefault: true });

            await service.setDefaultAccount('user-123', 'recipient-123');

            expect(recipientRepo.update).toHaveBeenCalledWith(
                { userId: 'user-123' },
                { isDefault: false },
            );
        });
    });

    describe('deleteBankAccount', () => {
        it('should delete a bank account', async () => {
            recipientRepo.findOne.mockResolvedValue(mockRecipient);
            recipientRepo.delete.mockResolvedValue({ affected: 1 } as any);

            await service.deleteBankAccount('user-123', 'recipient-123');

            expect(recipientRepo.delete).toHaveBeenCalledWith('recipient-123');
        });

        it('should throw NotFoundException if account not found', async () => {
            recipientRepo.findOne.mockResolvedValue(null);

            await expect(
                service.deleteBankAccount('user-123', 'non-existent'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw if account belongs to different user', async () => {
            recipientRepo.findOne.mockResolvedValue({
                ...mockRecipient,
                userId: 'other-user',
            });

            await expect(
                service.deleteBankAccount('user-123', 'recipient-123'),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('initiateWithdrawal', () => {
        it('should initiate a withdrawal successfully', async () => {
            const transferResponse = {
                status: true,
                message: 'Transfer initiated',
                data: {
                    reference: 'TXN-20260121-WTH-ABC123',
                    status: 'pending' as const,
                    amount: 10000,
                    transfer_code: 'TRF_abc123',
                },
            };

            walletsService.getUserWallet.mockResolvedValue(mockWallet as any);
            recipientRepo.findOne.mockResolvedValue(mockRecipient);
            ledgerService.createPendingTransaction.mockResolvedValue(mockTransaction);
            paystackService.initiateTransfer.mockResolvedValue(transferResponse as any);
            transactionRepo.save.mockResolvedValue({
                ...mockTransaction,
                providerReference: transferResponse.data.reference,
            });

            const result = await service.initiateWithdrawal(
                'user-123',
                'recipient-123',
                100, // 100 NGN
                'Withdrawal to bank',
            );

            expect(result.type).toBe(TransactionType.WITHDRAWAL);
        });

        it('should throw BadRequestException for invalid amount', async () => {
            walletsService.getUserWallet.mockResolvedValue(mockWallet as any);
            recipientRepo.findOne.mockResolvedValue(mockRecipient);

            await expect(
                service.initiateWithdrawal('user-123', 'recipient-123', 0),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException for missing bank account', async () => {
            walletsService.getUserWallet.mockResolvedValue(mockWallet as any);
            recipientRepo.findOne.mockResolvedValue(null);

            await expect(
                service.initiateWithdrawal('user-123', 'non-existent', 100),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('internalTransfer', () => {
        const destWallet = {
            id: 'wallet-456',
            ownerId: 'user-456',
            ownerType: WalletOwnerType.USER,
            cachedBalance: '0',
        };

        it('should execute an internal transfer', async () => {
            walletsService.getUserWallet
                .mockResolvedValueOnce(mockWallet as any)
                .mockResolvedValueOnce(destWallet as any);

            ledgerService.postTransfer.mockResolvedValue({
                transaction: {
                    ...mockTransaction,
                    type: TransactionType.TRANSFER,
                    status: TransactionStatus.COMPLETED,
                    destinationWalletId: 'wallet-456',
                },
                ledgerEntries: [],
            });

            const result = await service.internalTransfer(
                'user-123',
                'user-456',
                100,
                'Payment for services',
            );

            expect(result.type).toBe(TransactionType.TRANSFER);
            expect(result.status).toBe(TransactionStatus.COMPLETED);
        });

        it('should throw BadRequestException for self-transfer', async () => {
            await expect(
                service.internalTransfer('user-123', 'user-123', 100),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException for invalid amount', async () => {
            await expect(
                service.internalTransfer('user-123', 'user-456', 0),
            ).rejects.toThrow(BadRequestException);
        });
    });
});
