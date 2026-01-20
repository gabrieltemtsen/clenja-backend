export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

export enum OrgType {
  COMPANY = 'COMPANY',
  UNIVERSITY = 'UNIVERSITY',
  FAMILY = 'FAMILY',
  COUPLE = 'COUPLE',
  GROUP = 'GROUP',
}

export enum OrgMemberRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  MEMBER = 'MEMBER',
}

export enum OrgMemberStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REMOVED = 'REMOVED',
}

// ============ Payment & Wallet Enums ============

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER = 'TRANSFER',
  REVERSAL = 'REVERSAL',
  ALLOCATION_TOPUP = 'ALLOCATION_TOPUP',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

export enum WalletStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  CLOSED = 'CLOSED',
}

export enum WalletOwnerType {
  USER = 'USER',
  ORG = 'ORG',
  ALLOCATION = 'ALLOCATION',
}

export enum LedgerDirection {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export enum Currency {
  NGN = 'NGN',
}

export enum WebhookProvider {
  PAYSTACK = 'paystack',
}
