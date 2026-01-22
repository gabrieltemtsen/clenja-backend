# Payment Gateway Documentation

> **Last Updated**: January 2026  
> **Status**: ✅ Implemented & Ready for Testing  
> **Provider**: Paystack (Test Mode)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [API Endpoints](#api-endpoints)
- [Testing Guide](#testing-guide)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Key Features](#key-features)
- [Webhook Setup](#webhook-setup)
- [Troubleshooting](#troubleshooting)

---

## Overview

This document describes the **Paystack payment gateway integration** for SpewPay. The implementation follows banking best practices:

| Feature | Description |
|---------|-------------|
| **Double-Entry Ledger** | Every transaction creates balanced debit/credit entries |
| **Idempotency** | Duplicate requests are safely handled |
| **Transaction References** | Human-readable format: `TXN-20260120-DEP-A3F8K9` |
| **Row-Level Locking** | Prevents double-spend race conditions |
| **Webhook Security** | HMAC SHA512 signature verification |
| **Full Audit Trail** | All webhook events are logged |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ PaymentsController │ TransfersController │ WalletsController     │
└────────┬────────┴────────┬────────┴────────────┬────────────────┘
         │                 │                      │
         ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Service Layer                              │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ PaymentsService │ TransfersService │ WalletsService             │
└────────┬────────┴────────┬────────┴────────────┬────────────────┘
         │                 │                      │
         └────────────────┬┴──────────────────────┘
                          ▼
                 ┌─────────────────┐
                 │  LedgerService  │  ◄── Core Money Engine
                 └────────┬────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
    ┌─────────┐     ┌───────────┐    ┌─────────────┐
    │ Wallets │     │Transactions│    │LedgerEntries│
    └─────────┘     └───────────┘    └─────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ PaystackService │  ◄── External API
                 └─────────────────┘
```

### Module Structure

```
src/
├── common/
│   ├── enums.ts                    # Transaction types, statuses, etc.
│   └── utils/
│       └── reference-generator.ts   # Generates TXN references
├── entities/
│   ├── wallet.entity.ts            # User/Org wallets
│   ├── transaction.entity.ts       # Master transaction records
│   ├── ledger-entry.entity.ts      # Double-entry entries
│   ├── transfer-recipient.entity.ts # Bank accounts
│   └── webhook-event.entity.ts     # Webhook audit log
├── paystack/
│   ├── paystack.module.ts
│   └── paystack.service.ts         # Paystack API wrapper
├── wallets/
│   ├── wallets.module.ts
│   ├── wallets.service.ts
│   └── wallets.controller.ts
├── ledger/
│   ├── ledger.module.ts
│   └── ledger.service.ts           # Core transaction posting
├── payments/
│   ├── payments.module.ts
│   ├── payments.service.ts
│   ├── payments.controller.ts
│   └── dto/payments.dto.ts
└── transfers/
    ├── transfers.module.ts
    ├── transfers.service.ts
    ├── transfers.controller.ts
    └── dto/transfers.dto.ts
```

---

## Quick Start

### 1. Prerequisites

- Node.js 18+
- PostgreSQL database
- Paystack test account

### 2. Environment Setup

```bash
# Copy environment variables
cp .env.example .env

# Install dependencies
npm install

# Start the server
npm run start:dev
```

### 3. Access Swagger UI

Open http://localhost:3000/api in your browser for interactive API documentation.

---

## API Endpoints

### Base URL: `/api/v1`

### Wallets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/wallets/user/:userId` | Get user's wallet with balance |
| `GET` | `/wallets/:walletId/balance` | Get wallet balance (cached + ledger) |
| `GET` | `/wallets/:walletId/transactions` | Transaction history (paginated) |
| `GET` | `/wallets/:walletId/ledger` | Detailed ledger entries (paginated) |

### Payments (Deposits)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/payments/deposits/initialize` | Start a deposit, get Paystack checkout URL |
| `GET` | `/payments/deposits/:reference/verify` | Verify deposit and credit wallet |

**Initialize Deposit Request:**
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "amountInNaira": 5000,
  "callbackUrl": "https://api.spewpay.com/payment/callback",
  "idempotencyKey": "optional-client-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "uuid",
    "reference": "TXN-20260120-DEP-A3F8K9",
    "authorizationUrl": "https://checkout.paystack.com/xxx",
    "accessCode": "xxx",
    "amount": {
      "kobo": "500000",
      "naira": 5000
    }
  }
}
```

### Transfers (Bank Accounts & Withdrawals)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/transfers/banks` | List all supported Nigerian banks |
| `POST` | `/transfers/resolve-account` | Resolve bank account to get account name |
| `POST` | `/transfers/recipients` | Add a bank account for withdrawals |
| `GET` | `/transfers/recipients?userId=` | List user's saved bank accounts |
| `DELETE` | `/transfers/recipients/:id?userId=` | Delete a bank account |
| `POST` | `/transfers/withdraw` | Initiate withdrawal to bank |
| `POST` | `/transfers/internal` | Transfer between users |

**Add Bank Account Request:**
```json
{
  "userId": "uuid",
  "accountNumber": "0123456789",
  "bankCode": "058",
  "isDefault": true
}
```

**Initiate Withdrawal Request:**
```json
{
  "userId": "uuid",
  "recipientId": "uuid",
  "amountInNaira": 2000,
  "reason": "Funds withdrawal",
  "idempotencyKey": "optional-uuid"
}
```

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/webhooks/paystack` | Receive Paystack webhook events |

---

## Testing Guide

### Step-by-Step Test Flow

#### 1. Create a User (Wallet Auto-Created)

```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "fullName": "Test User"
  }'
```

#### 2. Check Wallet Created

```bash
curl http://localhost:3000/api/v1/wallets/user/{userId}
```

#### 3. Initialize Deposit

```bash
curl -X POST http://localhost:3000/api/v1/payments/deposits/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "{userId}",
    "email": "test@example.com",
    "amountInNaira": 5000
  }'
```

Copy the `authorizationUrl` from the response.

#### 4. Complete Payment

1. Open the `authorizationUrl` in a browser
2. Use Paystack test card: `4084084084084081`
3. Expiry: Any future date
4. CVV: Any 3 digits
5. OTP: `123456`

#### 5. Verify Deposit

```bash
curl http://localhost:3000/api/v1/payments/deposits/{reference}/verify
```

#### 6. Check Updated Balance

```bash
curl http://localhost:3000/api/v1/wallets/user/{userId}
```

### Paystack Test Cards

| Card Number | Scenario |
|-------------|----------|
| `4084084084084081` | Successful transaction |
| `4084080000005408` | Declined transaction |
| `5060666666666666666` | Verve card (successful) |

### Test Bank for Withdrawals

Use these test values:
- **Bank Code**: `058` (GTBank)
- **Account Number**: `0123456789`

---

## Database Schema

### Wallet
```sql
CREATE TABLE wallets (
  id UUID PRIMARY KEY,
  owner_type ENUM('USER', 'ORG', 'ALLOCATION'),
  owner_id UUID NOT NULL,
  currency ENUM('NGN') DEFAULT 'NGN',
  status ENUM('ACTIVE', 'FROZEN', 'CLOSED') DEFAULT 'ACTIVE',
  cached_balance BIGINT DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Transaction
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  reference VARCHAR UNIQUE,
  idempotency_key VARCHAR UNIQUE,
  type ENUM('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'REVERSAL'),
  status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED'),
  amount BIGINT,
  currency VARCHAR DEFAULT 'NGN',
  initiated_by_user_id UUID,
  source_wallet_id UUID,
  destination_wallet_id UUID,
  provider_reference VARCHAR,
  provider_response JSONB,
  metadata JSONB,
  failure_reason VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Ledger Entry
```sql
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id),
  wallet_id UUID REFERENCES wallets(id),
  direction ENUM('DEBIT', 'CREDIT'),
  amount BIGINT,
  currency VARCHAR,
  balance_after BIGINT,
  created_at TIMESTAMP
);
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_USERNAME` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | `password` |
| `DB_NAME` | Database name | `clenja` |
| `PORT` | API server port | `3000` |
| `PAYSTACK_SECRET_KEY` | Paystack secret key | `sk_test_xxx` |
| `PAYSTACK_BASE_URL` | Paystack API URL | `https://api.paystack.co` |

---

## Key Features

### 1. Double-Entry Ledger

Every transaction creates balanced entries:

```
Deposit ₦5,000:
  ├── CREDIT wallet: +₦5,000
  └── Balance after: ₦5,000

Withdrawal ₦2,000:
  ├── DEBIT wallet: -₦2,000
  └── Balance after: ₦3,000

Internal Transfer ₦1,000 (User A → User B):
  ├── DEBIT User A: -₦1,000
  └── CREDIT User B: +₦1,000
```

### 2. Idempotency

Clients can provide an `idempotencyKey` with requests. If the same key is used:
- Completed transaction → Returns existing result
- Pending transaction → Returns "in progress" error
- No transaction → Proceeds normally

### 3. Transaction References

Human-readable, sortable format:
```
TXN-{YYYYMMDD}-{TYPE}-{RANDOM}

Examples:
- TXN-20260120-DEP-A3F8K9 (deposit)
- TXN-20260120-WTH-B7C2M4 (withdrawal)
- TXN-20260120-TRF-D5E1N8 (transfer)
```

### 4. Row-Level Locking

All balance-affecting operations use:
- `SERIALIZABLE` transaction isolation
- Pessimistic write locks on wallet rows
- Prevents double-spend race conditions

---

## Webhook Setup

### For Local Development

Use [ngrok](https://ngrok.com) to expose your local server:

```bash
ngrok http 3000
```

Then configure the webhook URL in Paystack Dashboard:
```
https://your-ngrok-url.ngrok.io/api/v1/webhooks/paystack
```

### For Production

1. Go to Paystack Dashboard → Settings → Webhooks
2. Add your production webhook URL
3. Select events: `charge.success`, `transfer.success`, `transfer.failed`

### Webhook Events Handled

| Event | Action |
|-------|--------|
| `charge.success` | Credits wallet, completes deposit |
| `transfer.success` | Marks withdrawal as completed |
| `transfer.failed` | Marks withdrawal as failed |
| `transfer.reversed` | Marks withdrawal as reversed |

---

## Troubleshooting

### Common Issues

#### "Wallet not found for user"
The user doesn't have a wallet. This can happen if:
- User was created before the wallet auto-creation feature
- Wallet creation failed during registration

**Fix**: Create wallet manually or re-register user.

#### "Insufficient balance"
User is trying to withdraw/transfer more than available.

**Fix**: Check balance with `/wallets/user/:userId` endpoint.

#### "Invalid signature" on webhooks
Webhook signature verification failed.

**Fix**: Ensure `PAYSTACK_SECRET_KEY` matches your Paystack dashboard.

#### Duplicate transaction errors
Client is retrying without idempotency key.

**Fix**: Always include `idempotencyKey` in requests.

---

## Support

For questions or issues:
- Check the Swagger docs at `/api`
- Review webhook event logs in `webhook_events` table
- Check transaction status in `transactions` table

---

*Built with ❤️ for SpewPay*
