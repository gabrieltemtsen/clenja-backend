import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PaystackModule } from './paystack/paystack.module';
import { WalletsModule } from './wallets/wallets.module';
import { LedgerModule } from './ledger/ledger.module';
import { PaymentsModule } from './payments/payments.module';
import { TransfersModule } from './transfers/transfers.module';
import { OrgsModule } from './orgs/orgs.module';
import { AllocationsModule } from './allocations/allocations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      autoLoadEntities: true,
      synchronize: true, // DEV ONLY
    }),

    // AUTH
    AuthModule,

    // Core modules
    UsersModule,
    WalletsModule,
    LedgerModule,
    PaystackModule,

    // Feature modules
    PaymentsModule,
    TransfersModule,
    OrgsModule,
    AllocationsModule,
  ],
})
export class AppModule {}
