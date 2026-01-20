import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Feature Modules
import { UsersModule } from './users/users.module';
import { PaystackModule } from './paystack/paystack.module';
import { WalletsModule } from './wallets/wallets.module';
import { LedgerModule } from './ledger/ledger.module';
import { PaymentsModule } from './payments/payments.module';
import { TransfersModule } from './transfers/transfers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: true, // DEV ONLY - disable in production!
    }),

    // Core modules
    PaystackModule,
    WalletsModule,
    LedgerModule,

    // Feature modules
    UsersModule,
    PaymentsModule,
    TransfersModule,
  ],
})
export class AppModule { }
