# SpewPay Backend (NestJS + TypeORM + Postgres/Neon) — Milestones & Schema Draft

This README is a milestone checklist to take the backend from zero → production launch for:
- Normal finance: deposit, withdrawal, transfer
- Org/Group “digital corporate account”: invites, roles/permissions, sub-allocations, spending rules, hierarchical membership

---

## 0) Foundations (Day 0–2)

### Repo & Tooling
- [x] NestJS project structure: `apps/api` (optional), `src/modules/*`
- [x] Config module (`@nestjs/config`) with env validation (zod/joi)
- [ ] Global pipes/filters/interceptors (validation, exception mapping)
- [x] Logging (pino/winston) + request id correlation
- [x] Swagger (`@nestjs/swagger`) + versioned API prefix (`/v1`)
- [x] Dockerfile + docker-compose for local Postgres (even if prod is Neon)
- [ ] Lint/format (eslint, prettier) + husky pre-commit
- [ ] Health checks `/health` (db ping)

### Database (Neon Postgres)
- [ ] TypeORM datasource configured for Neon (SSL on in prod)
- [ ] Migrations enabled (NO `synchronize: true` in prod)
- [ ] BaseEntity columns: `id`, `createdAt`, `updatedAt`, `deletedAt` (soft delete)
- [ ] DB naming strategy (snake_case)

---

## 1) Auth & Identity (Day 2–5)

### Auth Core
- [x] User registration/login (email/phone + password or OTP)
- [x] Password hashing (argon2/bcrypt) + password rules
- [x] JWT access token + refresh token (rotation)
- [ ] Session table for refresh tokens (revoke, device info)
- [ ] RBAC guard base (role/permission checks)
- [ ] Rate limiting for auth endpoints
- [x] Email/phone verification (optional but recommended)

### Security Baselines
- [ ] Helmet, CORS, CSRF strategy (if cookies)
- [ ] Input validation everywhere (DTOs)
- [ ] Audit logging for sensitive actions
- [ ] “Admin only” endpoints protected

Deliverable:
- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- `GET /me`

---

## 2) Core Wallet Model + Ledger (Critical) (Day 5–10)

> Treat all money movement as **ledger entries**. Your “balance” is derived (or cached) from the ledger.

### Wallets / Accounts
- [ ] Personal wallet per user (default)
- [ ] Org wallet per org/group
- [ ] Sub-wallets / budgets / allocations per org unit (department / member allocation)
- [ ] Multi-currency support decision:
  - Option A: single currency MVP
  - Option B: currency column everywhere

### Ledger Design
- [ ] Double-entry ledger (recommended):
  - every transaction creates 2+ entries (debit/credit)
- [ ] Idempotency keys for all money-changing requests
- [ ] Transaction states: `PENDING`, `COMPLETED`, `FAILED`, `REVERSED`
- [ ] Balance caching (optional) with consistent updates + locking strategy

Deliverable:
- Internal service for `postTransaction()` that creates ledger entries safely (db transaction + locking)

---

## 3) Deposits / Withdrawals / Transfers (Day 10–16)

### Transfers (Internal)
- [ ] User → User transfer
- [ ] User → Org wallet funding
- [ ] Org → User payouts (if allowed)

### Deposits/Withdrawals (External integration ready)
- [ ] Deposit initiation + webhook handler
- [ ] Withdrawal request + processing pipeline
- [ ] Provider abstraction (Paystack/Flutterwave/etc) even if stubbed for MVP

### Safety
- [ ] Daily limits / per-transaction limits
- [ ] KYC hooks (if required later)
- [ ] Fraud/basic checks (velocity, unusual transfers)

Deliverable:
- `POST /transfers`
- `POST /deposits/initiate` + `POST /webhooks/provider`
- `POST /withdrawals`

---

## 4) Orgs/Groups (Digital Corporate Account) (Day 16–24)

### Org Core
- [ ] Create org/group
- [ ] Invite system (email/phone/in-app)
- [ ] Accept/decline invite
- [ ] Membership states: `INVITED`, `ACTIVE`, `SUSPENDED`, `REMOVED`

### Hierarchy & Delegation
- [ ] Roles: Owner, Admin, Manager, Member (MVP)
- [ ] Permission matrix (fine-grained later)
- [ ] Org units (departments/teams) optional:
  - VC creates org → creates “Departments” → assigns HODs

Deliverable:
- `POST /orgs`
- `POST /orgs/:orgId/invites`
- `POST /orgs/invites/:inviteId/accept`
- `GET /orgs/:orgId/members`

---

## 5) Allocations (Budgets) + Spending Rules (Day 24–34)

### Allocations
- [ ] Allocate funds from Org wallet → Allocation bucket (department/member)
- [ ] Reallocate / top-up / revoke
- [ ] Parent-child allocations (HOD → secretary)

### Rules Engine (MVP rules)
Implement simple rules first:
- [ ] Spend limit (per txn / daily / monthly)
- [ ] Category locks (if you support merchant categories later)
- [ ] Approval required threshold
- [ ] Time locks (cannot spend before date / after date)
- [ ] Allowed recipients list (whitelist transfers)

### Enforcement
- [ ] Every spend attempt checks:
  - membership + permissions
  - allocation available amount
  - rule constraints
- [ ] Rule evaluation logs (why approved/denied)

Deliverable:
- `POST /orgs/:orgId/allocations`
- `POST /allocations/:allocationId/rules`
- `POST /allocations/:allocationId/spend` (or reuse transfer endpoint with context)

---

## 6) Approvals / Requests (Optional but powerful) (Day 34–42)

For bigger org use-cases:
- [ ] Request to spend (purchase request)
- [ ] Multi-approver workflow (Owner/Admin)
- [ ] Statuses: `REQUESTED`, `APPROVED`, `REJECTED`, `CANCELLED`, `PAID`

Deliverable:
- `POST /requests`
- `POST /requests/:id/approve`

---

## 7) Reporting, Statements, Audit (Day 42–48)

- [ ] Transaction history (filters by wallet/org/allocation)
- [ ] Statements export (CSV/PDF later)
- [ ] Audit log browsing (admin)
- [ ] Webhook/event log viewer (internal)

Deliverable:
- `GET /wallets/:id/transactions`
- `GET /orgs/:orgId/ledger`
- `GET /audit`

---

## 8) Production Readiness (Day 48–Launch)

### Testing
- [ ] Unit tests for services (ledger/rules)
- [ ] Integration tests for endpoints
- [ ] Seed scripts for dev
- [ ] Test containers / local postgres pipeline

### Reliability
- [ ] Proper DB indexes + query optimization
- [ ] Background jobs (BullMQ) for async processing:
  - webhooks, payouts, emails
- [ ] Retry strategy + DLQ
- [ ] Monitoring: Sentry + metrics (Prometheus optional)

### Deployment
- [ ] CI pipeline (build, test, migrate)
- [ ] Prod env config (Neon connection pooling)
- [ ] Run migrations on deploy
- [ ] Backups strategy (Neon)
- [ ] Secrets management

Launch Checklist
- [ ] All money-moving endpoints are idempotent
- [ ] Ledger reconciliation script exists
- [ ] Webhook signature verification enforced
- [ ] Rate limits enabled
- [ ] Admin emergency switch (pause withdrawals/transfers)

---

# Suggested Entity Schema (TypeORM / Postgres)

Below is a practical MVP schema. You can start here and evolve.

## 1) Users & Auth

### `users`
- id (uuid)
- email (unique, nullable)
- phone (unique, nullable)
- passwordHash
- status: `ACTIVE | SUSPENDED | DELETED`
- kycLevel (int, default 0)
- profile: displayName, avatarUrl
- createdAt, updatedAt

### `sessions`
- id (uuid)
- userId (fk)
- refreshTokenHash
- userAgent, ip
- revokedAt (nullable)
- expiresAt
- createdAt

---

## 2) Orgs / Membership / Invites

### `orgs`
- id (uuid)
- name
- type: `COMPANY | FAMILY | COUPLE | GROUP`
- ownerUserId (fk users)
- metadata (jsonb)
- createdAt, updatedAt

### `org_invites`
- id (uuid)
- orgId (fk)
- invitedByUserId (fk)
- inviteeEmail/phone (nullable)
- inviteeUserId (nullable, if already exists)
- role (string)  // “ADMIN”, “MANAGER”, “MEMBER”
- status: `PENDING | ACCEPTED | EXPIRED | REVOKED`
- expiresAt
- createdAt

### `org_members`
- id (uuid)
- orgId (fk)
- userId (fk)
- role: `OWNER | ADMIN | MANAGER | MEMBER`
- status: `ACTIVE | SUSPENDED | REMOVED`
- parentMemberId (nullable) // enables hierarchy (VC->HOD->Secretary)
- createdAt, updatedAt

> If you want richer permissions later, add:
- `permissions` + `role_permissions`

---

## 3) Wallets / Allocations

### `wallets`
- id (uuid)
- ownerType: `USER | ORG | ALLOCATION`
- ownerId (uuid)  // references user/org/allocation by convention
- currency (e.g. "NGN")
- status: `ACTIVE | FROZEN | CLOSED`
- createdAt

### `allocations` (budget buckets inside an org)
- id (uuid)
- orgId (fk)
- walletId (fk wallets)  // each allocation has its own wallet for clean ledgering
- name (e.g. “Chemistry Dept Budget”, “Wife Allowance”)
- managerMemberId (fk org_members) // who controls it
- parentAllocationId (nullable) // allow HOD -> secretary allocations
- status: `ACTIVE | FROZEN | CLOSED`
- createdAt, updatedAt

---

## 4) Rules & Policies

### `allocation_rules`
- id (uuid)
- allocationId (fk)
- ruleType: `TXN_LIMIT | DAILY_LIMIT | TIME_LOCK | WHITELIST_RECIPIENTS | REQUIRES_APPROVAL`
- config (jsonb) // flexible rule configuration
- enabled (boolean)
- createdAt

Example configs:
- TXN_LIMIT: `{ "maxAmount": 50000 }`
- DAILY_LIMIT: `{ "maxAmount": 200000 }`
- TIME_LOCK: `{ "startAt": "...", "endAt": "..." }`
- WHITELIST_RECIPIENTS: `{ "allowedUserIds": ["..."], "allowedWalletIds": ["..."] }`
- REQUIRES_APPROVAL: `{ "threshold": 100000, "approverRoles": ["ADMIN"] }`

---

## 5) Ledger (Core Money Engine)

### `transactions`
- id (uuid)
- reference (unique) // human readable ref
- idempotencyKey (unique per initiator scope)
- type: `DEPOSIT | WITHDRAWAL | TRANSFER | ALLOCATION_TOPUP | REVERSAL`
- status: `PENDING | COMPLETED | FAILED | REVERSED`
- initiatedByUserId (fk)
- metadata (jsonb)
- createdAt, updatedAt

### `ledger_entries`
- id (uuid)
- transactionId (fk)
- walletId (fk wallets)
- direction: `DEBIT | CREDIT`
- amount (bigint) // store smallest units (kobo)
- currency
- balanceAfter (bigint, optional)
- createdAt

> Indexes to add early:
- `(walletId, createdAt)`
- `(transactionId)`
- `(idempotencyKey)`
- `(reference)`

---

## 6) Requests & Approvals (Optional MVP+)

### `spend_requests`
- id (uuid)
- allocationId (fk)
- requestedByMemberId (fk org_members)
- amount
- purpose (text)
- status: `REQUESTED | APPROVED | REJECTED | CANCELLED | PAID`
- createdAt, updatedAt

### `approvals`
- id (uuid)
- requestId (fk spend_requests)
- approvedByMemberId (fk)
- status: `APPROVED | REJECTED`
- note (text)
- createdAt

---

## 7) Audit & Notifications

### `audit_logs`
- id (uuid)
- actorUserId (fk)
- action (string)
- entityType (string)
- entityId (uuid)
- before (jsonb)
- after (jsonb)
- ip, userAgent
- createdAt

### `notifications`
- id (uuid)
- userId (fk)
- type (string)
- payload (jsonb)
- readAt (nullable)
- createdAt

---

# MVP Module Breakdown (NestJS)

- `AuthModule` (JWT, sessions)
- `UsersModule`
- `OrgsModule` (orgs, members, invites)
- `WalletsModule`
- `AllocationsModule`
- `RulesModule`
- `LedgerModule` (transactions, entries, reconciliation)
- `PaymentsModule` (deposit/withdraw provider abstraction + webhooks)
- `AuditModule`
- `NotificationsModule`

---

# Non-Negotiables for Fintech Correctness

- Always use DB transactions for posting ledger entries
- Use idempotency keys for deposit/withdraw/transfer endpoints
- Store money as integer smallest units (kobo), never float
- Enforce row-level locking or safe balance computation to prevent double-spend
- Verify webhook signatures and log every webhook event
