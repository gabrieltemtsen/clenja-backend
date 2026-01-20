# Frontend Integration Guide - Paystack Payments

> **Version**: 1.0  
> **Last Updated**: January 2026  
> **For**: Frontend Developers  
> **Base URL**: `http://localhost:3000/api/v1` (development)

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Authentication](#2-authentication)
3. [Wallet Management](#3-wallet-management)
4. [Deposit Flow (Fund Wallet)](#4-deposit-flow-fund-wallet)
5. [Withdrawal Flow (Bank Transfer)](#5-withdrawal-flow-bank-transfer)
6. [Internal Transfers (User to User)](#6-internal-transfers-user-to-user)
7. [Transaction History](#7-transaction-history)
8. [Error Handling](#8-error-handling)
9. [TypeScript Interfaces](#9-typescript-interfaces)
10. [Code Examples](#10-code-examples)
11. [Test Credentials](#11-test-credentials)
12. [Best Practices](#12-best-practices)

---

## 1. Quick Start

### API Base URL
```
Development: http://localhost:3000/api/v1
Production:  https://api.clenja.com/api/v1
```

### Headers for All Requests
```javascript
const headers = {
  'Content-Type': 'application/json',
  // Add Authorization header when auth is implemented
  // 'Authorization': `Bearer ${token}`
};
```

### Response Format
All API responses follow this consistent format:
```typescript
// Success Response
{
  "success": true,
  "data": { /* response payload */ }
}

// Success with Pagination
{
  "data": [ /* array of items */ ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}

// Error Response
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

---

## 2. Authentication

> ⚠️ **Note**: Auth integration pending. For now, the `userId` is passed in requests directly.

When authentication is implemented, include the JWT token in all requests:
```javascript
headers: {
  'Authorization': `Bearer ${accessToken}`
}
```

---

## 3. Wallet Management

### Get User's Wallet

Every user has a wallet created automatically on registration.

```http
GET /wallets/user/{userId}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "currency": "NGN",
  "status": "ACTIVE",
  "balance": {
    "kobo": "500000",
    "naira": 5000
  },
  "createdAt": "2026-01-20T10:30:00.000Z"
}
```

**Important Notes:**
- `balance.kobo` is a string (bigint) for precision
- `balance.naira` is a number for display
- Always convert Naira inputs to Kobo for backend operations (×100)

### Get Detailed Balance

Use this when you need both cached and verified ledger balance.

```http
GET /wallets/{walletId}/balance
```

**Response:**
```json
{
  "walletId": "550e8400-e29b-41d4-a716-446655440000",
  "currency": "NGN",
  "cachedBalance": {
    "kobo": "500000",
    "naira": 5000
  },
  "ledgerBalance": {
    "kobo": "500000",
    "naira": 5000
  }
}
```

---

## 4. Deposit Flow (Fund Wallet)

### Step 1: Initialize Deposit

```http
POST /payments/deposits/initialize
```

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "amountInNaira": 5000,
  "callbackUrl": "https://yourapp.com/payment/callback",
  "idempotencyKey": "unique-client-uuid-optional"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | UUID | ✅ | The user's ID |
| `email` | string | ✅ | User's email for Paystack receipt |
| `amountInNaira` | number | ✅ | Amount in Naira (min: 100) |
| `callbackUrl` | string | ❌ | URL to redirect after payment |
| `idempotencyKey` | string | ❌ | Unique key to prevent duplicates |

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "123e4567-e89b-12d3-a456-426614174000",
    "reference": "TXN-20260120-DEP-A3F8K9",
    "authorizationUrl": "https://checkout.paystack.com/abc123xyz",
    "accessCode": "abc123xyz",
    "amount": {
      "kobo": "500000",
      "naira": 5000
    }
  }
}
```

### Step 2: Redirect to Paystack

Open the `authorizationUrl` in a new tab or redirect the user:

```javascript
// Option 1: Redirect (recommended for mobile)
window.location.href = response.data.authorizationUrl;

// Option 2: New tab
window.open(response.data.authorizationUrl, '_blank');

// Option 3: Inline modal using Paystack.js (advanced)
// See: https://paystack.com/docs/payments/accept-payments
```

### Step 3: Handle Callback

After payment, Paystack redirects to your `callbackUrl` with query params:

```
https://yourapp.com/payment/callback?reference=TXN-20260120-DEP-A3F8K9
```

Extract the reference and verify:

```javascript
const urlParams = new URLSearchParams(window.location.search);
const reference = urlParams.get('reference');
```

### Step 4: Verify Deposit

```http
GET /payments/deposits/{reference}/verify
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "transactionId": "123e4567-e89b-12d3-a456-426614174000",
    "reference": "TXN-20260120-DEP-A3F8K9",
    "status": "COMPLETED",
    "amount": {
      "kobo": "500000",
      "naira": 5000
    }
  }
}
```

**Transaction Status Values:**
| Status | Description | Action |
|--------|-------------|--------|
| `PENDING` | Payment not yet made | Show "Waiting for payment" |
| `PROCESSING` | Payment received, processing | Show spinner |
| `COMPLETED` | Wallet credited | Show success |
| `FAILED` | Payment failed | Show error, allow retry |

---

## 5. Withdrawal Flow (Bank Transfer)

### Step 1: Get List of Banks

Fetch Nigerian banks supported by Paystack.

```http
GET /transfers/banks
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Access Bank", "code": "044" },
    { "id": 2, "name": "Guaranty Trust Bank", "code": "058" },
    { "id": 3, "name": "First Bank of Nigeria", "code": "011" },
    // ... more banks
  ]
}
```

**UI Tip:** Use this for a searchable dropdown/select component.

### Step 2: Resolve Bank Account

Verify the account before adding it.

```http
POST /transfers/resolve-account
```

**Request:**
```json
{
  "accountNumber": "0123456789",
  "bankCode": "058"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accountNumber": "0123456789",
    "accountName": "JOHN DOE",
    "bankCode": "058"
  }
}
```

**UI Flow:**
1. User enters account number
2. User selects bank from dropdown
3. Call this endpoint to get account name
4. Display account name for confirmation
5. Proceed to add bank account

### Step 3: Add Bank Account

Save the verified bank account for withdrawals.

```http
POST /transfers/recipients
```

**Request:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "accountNumber": "0123456789",
  "bankCode": "058",
  "isDefault": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "recipient-uuid",
    "bankName": "Guaranty Trust Bank",
    "accountNumber": "0123456789",
    "accountName": "JOHN DOE",
    "isDefault": true,
    "isVerified": true
  }
}
```

### Step 4: Get User's Bank Accounts

```http
GET /transfers/recipients?userId={userId}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "recipient-uuid-1",
      "bankName": "Guaranty Trust Bank",
      "bankCode": "058",
      "accountNumber": "0123456789",
      "accountName": "JOHN DOE",
      "isDefault": true,
      "isVerified": true
    },
    {
      "id": "recipient-uuid-2",
      "bankName": "Access Bank",
      "bankCode": "044",
      "accountNumber": "9876543210",
      "accountName": "JOHN DOE",
      "isDefault": false,
      "isVerified": true
    }
  ]
}
```

### Step 5: Delete Bank Account

```http
DELETE /transfers/recipients/{recipientId}?userId={userId}
```

**Response:**
```json
{
  "success": true,
  "message": "Bank account deleted"
}
```

### Step 6: Initiate Withdrawal

```http
POST /transfers/withdraw
```

**Request:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "recipientId": "recipient-uuid-1",
  "amountInNaira": 2000,
  "reason": "Personal withdrawal",
  "idempotencyKey": "optional-unique-key"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | UUID | ✅ | The user's ID |
| `recipientId` | UUID | ✅ | Bank account ID from Step 4 |
| `amountInNaira` | number | ✅ | Amount (min: 100) |
| `reason` | string | ❌ | Description for the transfer |
| `idempotencyKey` | string | ❌ | Unique key to prevent duplicates |

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "456e7890-e12b-34d5-b678-901234567890",
    "reference": "TXN-20260120-WTH-B7C2M4",
    "status": "PROCESSING",
    "amount": {
      "kobo": "200000",
      "naira": 2000
    }
  }
}
```

**Withdrawal Status Flow:**
```
PENDING → PROCESSING → COMPLETED
                    ↘ FAILED
```

---

## 6. Internal Transfers (User to User)

Transfer money between users instantly.

```http
POST /transfers/internal
```

**Request:**
```json
{
  "sourceUserId": "user-a-uuid",
  "destinationUserId": "user-b-uuid",
  "amountInNaira": 1000,
  "description": "Payment for services",
  "idempotencyKey": "optional-unique-key"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "789e0123-e45b-67d8-c901-234567890123",
    "reference": "TXN-20260120-TRF-D5E1N8",
    "status": "COMPLETED",
    "amount": {
      "kobo": "100000",
      "naira": 1000
    }
  }
}
```

**Note:** Internal transfers are instant and always `COMPLETED` if successful.

---

## 7. Transaction History

### Get Transaction List

```http
GET /wallets/{walletId}/transactions?page=1&limit=20
```

**Response:**
```json
{
  "data": [
    {
      "id": "txn-uuid-1",
      "reference": "TXN-20260120-DEP-A3F8K9",
      "type": "DEPOSIT",
      "status": "COMPLETED",
      "amount": {
        "kobo": "500000",
        "naira": 5000
      },
      "description": null,
      "createdAt": "2026-01-20T10:30:00.000Z"
    },
    {
      "id": "txn-uuid-2",
      "reference": "TXN-20260120-WTH-B7C2M4",
      "type": "WITHDRAWAL",
      "status": "COMPLETED",
      "amount": {
        "kobo": "200000",
        "naira": 2000
      },
      "description": "Personal withdrawal",
      "createdAt": "2026-01-20T11:00:00.000Z"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

**Transaction Types:**
| Type | Description | UI Icon Suggestion |
|------|-------------|-------------------|
| `DEPOSIT` | Added money to wallet | ⬇️ Green arrow down |
| `WITHDRAWAL` | Sent to bank account | ⬆️ Red arrow up |
| `TRANSFER` | User-to-user transfer | ↔️ Blue arrows |
| `REVERSAL` | Refund/chargeback | 🔄 Orange refresh |

### Get Detailed Ledger

For account statement with running balance:

```http
GET /wallets/{walletId}/ledger?page=1&limit=50
```

**Response:**
```json
{
  "data": [
    {
      "id": "entry-uuid-1",
      "transactionId": "txn-uuid-1",
      "direction": "CREDIT",
      "amount": {
        "kobo": "500000",
        "naira": 5000
      },
      "balanceAfter": {
        "kobo": "500000",
        "naira": 5000
      },
      "createdAt": "2026-01-20T10:30:00.000Z"
    }
  ],
  "meta": { /* pagination */ }
}
```

**Ledger Directions:**
| Direction | Description |
|-----------|-------------|
| `CREDIT` | Money added (+) |
| `DEBIT` | Money removed (-) |

---

## 8. Error Handling

### Common Error Responses

```typescript
// 400 Bad Request - Validation Error
{
  "statusCode": 400,
  "message": ["email must be an email", "amountInNaira must not be less than 100"],
  "error": "Bad Request"
}

// 404 Not Found
{
  "statusCode": 404,
  "message": "Wallet not found for user",
  "error": "Not Found"
}

// 400 Insufficient Balance
{
  "statusCode": 400,
  "message": "Insufficient balance",
  "error": "Bad Request"
}

// 409 Conflict - Idempotency
{
  "statusCode": 409,
  "message": "Transaction in progress with this idempotency key",
  "error": "Conflict"
}
```

### Error Handling Example

```typescript
try {
  const response = await api.post('/payments/deposits/initialize', data);
  // Handle success
} catch (error) {
  if (error.response) {
    const { statusCode, message } = error.response.data;
    
    switch (statusCode) {
      case 400:
        if (message.includes('Insufficient balance')) {
          showToast('You don\'t have enough funds');
        } else {
          showToast('Please check your input');
        }
        break;
      case 404:
        showToast('Resource not found');
        break;
      case 409:
        showToast('Transaction already in progress');
        break;
      default:
        showToast('Something went wrong');
    }
  }
}
```

---

## 9. TypeScript Interfaces

```typescript
// ============ Wallet Types ============

interface Wallet {
  id: string;
  currency: 'NGN';
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
  balance: MoneyAmount;
  createdAt: string;
}

interface MoneyAmount {
  kobo: string;  // bigint as string for precision
  naira: number; // for display
}

// ============ Transaction Types ============

type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'REVERSAL';
type TransactionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

interface Transaction {
  id: string;
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: MoneyAmount;
  description: string | null;
  createdAt: string;
}

// ============ Deposit Types ============

interface InitializeDepositRequest {
  userId: string;
  email: string;
  amountInNaira: number;
  callbackUrl?: string;
  idempotencyKey?: string;
}

interface InitializeDepositResponse {
  success: true;
  data: {
    transactionId: string;
    reference: string;
    authorizationUrl: string;
    accessCode: string;
    amount: MoneyAmount;
  };
}

// ============ Bank Account Types ============

interface Bank {
  id: number;
  name: string;
  code: string;
}

interface ResolveAccountRequest {
  accountNumber: string;
  bankCode: string;
}

interface ResolvedAccount {
  accountNumber: string;
  accountName: string;
  bankCode: string;
}

interface BankAccount {
  id: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
  isVerified: boolean;
}

interface AddBankAccountRequest {
  userId: string;
  accountNumber: string;
  bankCode: string;
  isDefault?: boolean;
}

// ============ Withdrawal Types ============

interface InitiateWithdrawalRequest {
  userId: string;
  recipientId: string;
  amountInNaira: number;
  reason?: string;
  idempotencyKey?: string;
}

// ============ Transfer Types ============

interface InternalTransferRequest {
  sourceUserId: string;
  destinationUserId: string;
  amountInNaira: number;
  description?: string;
  idempotencyKey?: string;
}

// ============ Pagination ============

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

---

## 10. Code Examples

### React: Complete Deposit Flow

```tsx
import { useState } from 'react';
import { api } from '@/lib/api';

export function DepositForm({ userId, userEmail }: Props) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDeposit = async () => {
    setLoading(true);
    try {
      // Step 1: Initialize deposit
      const response = await api.post('/payments/deposits/initialize', {
        userId,
        email: userEmail,
        amountInNaira: Number(amount),
        callbackUrl: `${window.location.origin}/wallet/deposit/callback`,
        idempotencyKey: crypto.randomUUID(), // Prevent duplicates
      });

      // Step 2: Store reference for verification after redirect
      localStorage.setItem('pendingDeposit', response.data.data.reference);

      // Step 3: Redirect to Paystack
      window.location.href = response.data.data.authorizationUrl;
    } catch (error) {
      console.error('Deposit failed:', error);
      alert('Failed to initialize deposit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Enter amount in Naira"
        min={100}
      />
      <button onClick={handleDeposit} disabled={loading || !amount}>
        {loading ? 'Processing...' : 'Fund Wallet'}
      </button>
    </div>
  );
}
```

### React: Deposit Callback Page

```tsx
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

export function DepositCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');

  useEffect(() => {
    const verifyDeposit = async () => {
      const reference = searchParams.get('reference');
      
      if (!reference) {
        setStatus('failed');
        return;
      }

      try {
        const response = await api.get(`/payments/deposits/${reference}/verify`);
        
        if (response.data.data.status === 'COMPLETED') {
          setStatus('success');
          // Clear stored reference
          localStorage.removeItem('pendingDeposit');
        } else {
          setStatus('failed');
        }
      } catch (error) {
        setStatus('failed');
      }
    };

    verifyDeposit();
  }, [searchParams]);

  if (status === 'loading') {
    return <div>Verifying your payment...</div>;
  }

  if (status === 'success') {
    return (
      <div>
        <h1>✅ Payment Successful!</h1>
        <p>Your wallet has been credited.</p>
        <button onClick={() => navigate('/wallet')}>View Wallet</button>
      </div>
    );
  }

  return (
    <div>
      <h1>❌ Payment Failed</h1>
      <p>Something went wrong. Please try again.</p>
      <button onClick={() => navigate('/wallet/deposit')}>Try Again</button>
    </div>
  );
}
```

### React: Bank Account Form

```tsx
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export function AddBankAccountForm({ userId, onSuccess }: Props) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolvedAccount, setResolvedAccount] = useState<ResolvedAccount | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch banks on mount
  useEffect(() => {
    api.get('/transfers/banks').then((res) => setBanks(res.data.data));
  }, []);

  // Resolve account when both fields are filled
  useEffect(() => {
    if (accountNumber.length === 10 && bankCode) {
      setLoading(true);
      api.post('/transfers/resolve-account', { accountNumber, bankCode })
        .then((res) => setResolvedAccount(res.data.data))
        .catch(() => setResolvedAccount(null))
        .finally(() => setLoading(false));
    }
  }, [accountNumber, bankCode]);

  const handleSubmit = async () => {
    if (!resolvedAccount) return;

    try {
      await api.post('/transfers/recipients', {
        userId,
        accountNumber,
        bankCode,
        isDefault: true,
      });
      onSuccess();
    } catch (error) {
      alert('Failed to add bank account');
    }
  };

  return (
    <form>
      <select value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
        <option value="">Select Bank</option>
        {banks.map((bank) => (
          <option key={bank.code} value={bank.code}>
            {bank.name}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={accountNumber}
        onChange={(e) => setAccountNumber(e.target.value)}
        placeholder="Account Number"
        maxLength={10}
      />

      {loading && <p>Verifying account...</p>}
      
      {resolvedAccount && (
        <div className="account-preview">
          <p>Account Name: <strong>{resolvedAccount.accountName}</strong></p>
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!resolvedAccount}
      >
        Add Bank Account
      </button>
    </form>
  );
}
```

---

## 11. Test Credentials

### Paystack Test Cards

| Card Number | Scenario |
|-------------|----------|
| `4084084084084081` | ✅ Successful payment |
| `4084080000005408` | ❌ Declined |
| `5060666666666666666` | ✅ Verve card success |

**For all test cards:**
- Expiry: Any future date (e.g., `12/30`)
- CVV: Any 3 digits (e.g., `123`)
- OTP: `123456`
- PIN: `1234` (if prompted)

### Test Bank Details

| Bank | Code | Test Account |
|------|------|--------------|
| GTBank | `058` | `0123456789` |

---

## 12. Best Practices

### 1. Always Use Idempotency Keys

For any money-related operation, generate and send a unique idempotency key:

```typescript
const idempotencyKey = crypto.randomUUID();
// or
const idempotencyKey = `${userId}-${Date.now()}-${Math.random().toString(36)}`;
```

### 2. Handle Loading States

Show appropriate loading states for each step of payment flows.

### 3. Validate Amounts Client-Side

```typescript
const MIN_AMOUNT = 100; // Naira

if (amount < MIN_AMOUNT) {
  showError(`Minimum amount is ₦${MIN_AMOUNT}`);
  return;
}
```

### 4. Format Currency Properly

```typescript
const formatNaira = (amount: number) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
  }).format(amount);
};

// formatNaira(5000) → "₦5,000.00"
```

### 5. Poll for Transaction Status

For withdrawals that may take time:

```typescript
const pollTransactionStatus = async (transactionId: string, maxAttempts = 10) => {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await api.get(`/transactions/${transactionId}`);
    const { status } = response.data.data;
    
    if (status === 'COMPLETED' || status === 'FAILED') {
      return status;
    }
    
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3s
  }
  
  return 'TIMEOUT';
};
```

### 6. Store Wallet ID

After fetching the user's wallet, store the `walletId` for subsequent calls:

```typescript
// On login or app load
const wallet = await api.get(`/wallets/user/${userId}`);
localStorage.setItem('walletId', wallet.data.id);
```

---

## Need Help?

- **Swagger Docs**: `http://localhost:3000/api`
- **Backend Docs**: See `docs/PAYMENT_GATEWAY.md`
- **Paystack Docs**: [https://paystack.com/docs](https://paystack.com/docs)

---

*Happy Coding! 🚀*
