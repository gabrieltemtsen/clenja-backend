import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Transaction } from '../entities/transaction.entity';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { WalletsModule } from '../wallets/wallets.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Transaction, WebhookEvent]),
        WalletsModule,
        LedgerModule,
    ],
    providers: [PaymentsService],
    controllers: [PaymentsController],
    exports: [PaymentsService],
})
export class PaymentsModule { }
