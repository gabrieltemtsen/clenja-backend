import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Enable raw body for webhook signature verification
    rawBody: true,
  });

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Enable CORS
  app.enableCors();

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('SpewPay API')
    .setDescription(
      `API documentation for SpewPay fintech app.

## Features
- **Wallets**: User wallet management with balance tracking
- **Payments**: Deposit funds via Paystack
- **Transfers**: Withdraw to bank accounts, internal transfers
- **Ledger**: Double-entry accounting for all transactions

## Authentication
Most endpoints require authentication.

## Currency
All amounts are in Nigerian Naira (NGN). Internally stored in Kobo (smallest unit).
₦100 = 10,000 Kobo
    `,
    )
    .setVersion('1.0')
    // Declare tags in the order you want them displayed
    .addTag('Auth', 'Authentication & login/register')
    .addTag('Users', 'User management')
    .addTag('Wallets', 'Wallet and balance management')
    .addTag('Payments', 'Deposits via Paystack')
    .addTag('Transfers', 'Withdrawals and internal transfers')
    .addTag('Ledger', 'Accounting ledger')
    .addTag('Webhooks', 'Payment provider webhooks')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      tagsSorter: (a: { name: string }, b: { name: string }) => {
        const order = [
          'Auth',
          'Users',
          'Wallets',
          'Payments',
          'Transfers',
          'Ledger',
          'Webhooks',
        ];
        return order.indexOf(a.name) - order.indexOf(b.name);
      },
      operationsSorter: 'method',
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 SpewPay API running on http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api`);
}

bootstrap().catch((err) => console.error(err));
