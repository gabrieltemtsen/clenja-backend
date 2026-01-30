import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { koboToNaira } from '../common/utils/reference-generator';

@ApiTags('Wallets')
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get wallet for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getUserWallet(@Param('userId', ParseUUIDPipe) userId: string) {
    const wallet = await this.walletsService.getUserWallet(userId);
    return {
      id: wallet.id,
      currency: wallet.currency,
      status: wallet.status,
      balance: {
        kobo: wallet.cachedBalance,
        naira: koboToNaira(wallet.cachedBalance),
      },
      createdAt: wallet.createdAt,
    };
  }

  @Get(':walletId/balance')
  @ApiOperation({ summary: 'Get wallet balance' })
  @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  async getBalance(@Param('walletId', ParseUUIDPipe) walletId: string) {
    const wallet = await this.walletsService.getWalletById(walletId);
    const ledgerBalance = await this.walletsService.getLedgerBalance(walletId);

    return {
      walletId,
      currency: wallet.currency,
      cachedBalance: {
        kobo: wallet.cachedBalance,
        naira: koboToNaira(wallet.cachedBalance),
      },
      ledgerBalance: {
        kobo: ledgerBalance.toString(),
        naira: koboToNaira(Number(ledgerBalance)),
      },
    };
  }

  @Get(':walletId/transactions')
  @ApiOperation({ summary: 'Get wallet transaction history' })
  @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTransactions(
    @Param('walletId', ParseUUIDPipe) walletId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const { transactions, total } =
      await this.walletsService.getTransactionHistory(walletId, page, limit);

    return {
      data: transactions.map((tx) => ({
        id: tx.id,
        reference: tx.reference,
        type: tx.type,
        status: tx.status,
        amount: {
          kobo: tx.amount,
          naira: koboToNaira(tx.amount),
        },
        description: tx.description,
        createdAt: tx.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get(':walletId/ledger')
  @ApiOperation({ summary: 'Get wallet ledger entries (detailed statement)' })
  @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getLedgerEntries(
    @Param('walletId', ParseUUIDPipe) walletId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    const { entries, total } = await this.walletsService.getLedgerEntries(
      walletId,
      page,
      limit,
    );

    return {
      data: entries.map((entry) => ({
        id: entry.id,
        transactionId: entry.transactionId,
        direction: entry.direction,
        amount: {
          kobo: entry.amount,
          naira: koboToNaira(entry.amount),
        },
        balanceAfter: {
          kobo: entry.balanceAfter,
          naira: koboToNaira(entry.balanceAfter),
        },
        createdAt: entry.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
