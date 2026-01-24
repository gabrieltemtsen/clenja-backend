# Organizations & Allocations API Guide

## Overview

SpewPay supports **Organizations** (digital corporate accounts) with:
- Member management (invite, roles, permissions)
- **Allocations** (budget buckets with their own wallets)
- **Spending rules** (limits, time locks, whitelists)

---

## Base URL
```
https://api.spewpay.com/api/v1
```

> **Note**: All endpoints currently require `userId` as a query parameter. This will be replaced with JWT auth.

---

## Organizations

### Create Organization
```http
POST /orgs?userId={userId}
```

**Request:**
```json
{
  "name": "Acme Corporation",
  "type": "COMPANY"
}
```

**Types:** `COMPANY`, `UNIVERSITY`, `FAMILY`, `COUPLE`, `GROUP`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Acme Corporation",
    "walletId": "uuid",
    "createdAt": "2026-01-24T12:00:00Z"
  }
}
```

---

### Get My Organizations
```http
GET /orgs/my?userId={userId}
```

---

### Get Organization Details
```http
GET /orgs/{orgId}
```

**Response includes:** `id`, `name`, `type`, `walletId`, `balance`

---

## Invitations

### Invite Member
```http
POST /orgs/{orgId}/invites?userId={inviterId}
```

**Request:**
```json
{
  "email": "john@example.com",
  "role": "MEMBER",
  "message": "Welcome to our team!"
}
```

**Roles:** `OWNER`, `ADMIN`, `MANAGER`, `MEMBER`

---

### Accept Invite
```http
POST /invites/{inviteId}/accept
```

**Request:**
```json
{
  "userId": "uuid-of-accepting-user"
}
```

---

### Get Pending Invites (for user)
```http
GET /orgs/invites/my?userId={userId}&email={userEmail}
```

---

### Get Org Members
```http
GET /orgs/{orgId}/members
```

---

## Allocations (Budget Buckets)

### Create Allocation
```http
POST /orgs/{orgId}/allocations?userId={userId}
```

**Request:**
```json
{
  "name": "Marketing Budget Q1",
  "description": "Budget for marketing campaigns",
  "managerMemberId": "uuid-of-member-who-manages"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Marketing Budget Q1",
    "walletId": "uuid",
    "status": "ACTIVE"
  }
}
```

---

### Get Org Allocations
```http
GET /orgs/{orgId}/allocations
```

Returns all allocations with their current balances.

---

### Get Allocation Details
```http
GET /allocations/{allocationId}
```

---

### Fund Allocation (from Org Wallet)
```http
POST /allocations/{allocationId}/fund?userId={userId}
```

**Request:**
```json
{
  "amount": 500000,
  "description": "Initial Q1 funding"
}
```

> **Note:** Amount is in **kobo** (smallest unit). 500000 kobo = ₦5,000

---

### Fund from Parent Allocation
```http
POST /allocations/{allocationId}/fund-from-parent?userId={userId}
```

For hierarchical budgets (e.g., HOD → Secretary).

---

## Spending Rules

### Add Rule
```http
POST /allocations/{allocationId}/rules?userId={userId}
```

**Request Examples:**

**Transaction Limit:**
```json
{
  "ruleType": "TXN_LIMIT",
  "config": { "maxAmount": 50000 },
  "description": "Max ₦500 per transaction"
}
```

**Daily Limit:**
```json
{
  "ruleType": "DAILY_LIMIT",
  "config": { "maxAmount": 200000 }
}
```

**Time Lock (office hours only):**
```json
{
  "ruleType": "TIME_LOCK",
  "config": { "startHour": 9, "endHour": 17, "days": [1,2,3,4,5] }
}
```

**Whitelist Recipients:**
```json
{
  "ruleType": "WHITELIST_RECIPIENTS",
  "config": { "userIds": ["uuid1", "uuid2"] }
}
```

---

### Get Rules
```http
GET /allocations/{allocationId}/rules
```

---

### Update Rule
```http
PATCH /rules/{ruleId}?userId={userId}
```

**Request:**
```json
{
  "enabled": false
}
```

---

### Delete Rule
```http
DELETE /rules/{ruleId}?userId={userId}
```

---

## Flow Example

1. **Create org** → Wallet auto-created
2. **Invite members** → They accept
3. **Fund org wallet** → Use `/payments/deposits/initialize`
4. **Create allocation** → E.g., "Marketing Budget"
5. **Fund allocation** → From org wallet
6. **Add rules** → Set spending limits
7. **Manager spends** → From allocation (coming soon: rule enforcement)

---

## Error Responses

```json
{
  "statusCode": 403,
  "message": "Insufficient permissions"
}
```

```json
{
  "statusCode": 404,
  "message": "Organization not found"
}
```

```json
{
  "statusCode": 400,
  "message": "Pending invite already exists"
}
```
