import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransfersService } from './transfers.service';
import { TransfersController } from './transfers.controller';
import { TransferRecipient } from '../entities/transfer-recipient.entity';
import { Transaction } from '../entities/transaction.entity';
import { WalletsModule } from '../wallets/wallets.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([TransferRecipient, Transaction]),
        WalletsModule,
        LedgerModule,
    ],
    providers: [TransfersService],
    controllers: [TransfersController],
    exports: [TransfersService],
})
export class TransfersModule { }
