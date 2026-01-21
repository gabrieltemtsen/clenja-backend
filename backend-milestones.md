# SpewPay Backend MVP – Milestones

This document defines **clear, checkable milestones** for building the SpewPay backend MVP using **NestJS + PostgreSQL (Docker) + TypeORM**.

The goal is to avoid over‑engineering while ensuring a solid, extensible foundation.

---

## Milestone 0 — Infrastructure & Environment

**Goal:** The app boots, connects to Postgres via Docker, and stays alive.

### Deliverables

- Dockerized PostgreSQL
- Environment variables configured
- NestJS connects to DB successfully
- Health check endpoint

### Checklist

- [ ] `docker-compose.yml` with Postgres
- [ ] `.env` file (DB creds)
- [ ] TypeORM config wired
- [ ] `/health` endpoint returns `OK`

---

## Milestone 1 — Users & Authentication

**Goal:** Identify users securely.

### Core Entity

- **User**
  - id
  - email (unique)
  - password (hashed)
  - status
  - createdAt

### Features

- Register
- Login
- JWT authentication
- Protected routes

### Checklist

- [ ] User entity
- [ ] Auth module
- [ ] JWT guard
- [ ] Password hashing

---

## Milestone 2 — Orgs (Containers)

**Goal:** Create shared spaces without money logic.

### Core Entities

- **Org**
- **OrgMember** (user ↔ org)

### Features

- Create org
- Invite member
- Accept invite
- Role enforcement (ADMIN / MEMBER)

### Checklist

- [ ] Org entity
- [ ] OrgMember entity
- [ ] Role-based guards

---

## Milestone 3 — Ledger (Money Tracking)

**Goal:** Track money immutably.

### Core Entities

- **LedgerAccount**
- **LedgerEntry**

### Rules

- Balance = sum(entries)
- No balance mutation without ledger entry

### Checklist

- [ ] Credit account
- [ ] Debit account
- [ ] Transaction safety
- [ ] Ledger history

---

## Milestone 4 — Allocations (Core Feature)

**Goal:** Allocate money without transferring ownership.

### Core Entities

- **SubAccount**
- **Allocation**

### Rules

- Parent balance ≥ total allocations
- Sub-accounts can only spend allocated funds

### Checklist

- [ ] Create sub-account
- [ ] Allocate fixed amount
- [ ] Enforce spending limits

---

## Milestone 5 — Permissions

**Goal:** Enforce authority boundaries.

### Roles

- Admin
- Member

### Rules

- Admin: full access
- Member: limited spending

### Checklist

- [ ] Permission middleware
- [ ] Overspend prevention
- [ ] Admin overrides

---

## Milestone 6 — Audit & Visibility

**Goal:** Build trust through transparency.

### Features

- Transaction logs
- Allocation history
- Actor tracking

### Checklist

- [ ] Audit trail
- [ ] Filters by org/sub-account

---

## Milestone 7 — Hardening & Readiness

**Goal:** Make the MVP stable and demo-ready.

### Checklist

- [ ] Input validation
- [ ] Error handling
- [ ] DB indexes
- [ ] Seed data
- [ ] Updated README

---

## Notes

- Avoid percentages and approval flows in MVP
- Fixed allocations + simple roles only
- Ledger must remain immutable

**Ship fast. Iterate safely.**
