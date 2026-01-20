import { TransactionType } from '../enums';

/**
 * Generates a human-readable, sortable transaction reference.
 * Format: TXN-{YYYYMMDD}-{TYPE}-{RANDOM}
 * Example: TXN-20260120-DEP-A3F8K9
 */
export function generateTransactionReference(type: TransactionType): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    const typeCode = getTypeCode(type);
    const random = generateRandomCode(6);

    return `TXN-${dateStr}-${typeCode}-${random}`;
}

/**
 * Generates a unique idempotency key.
 * Uses UUID v4 format for uniqueness.
 */
export function generateIdempotencyKey(): string {
    return crypto.randomUUID();
}

/**
 * Maps transaction type to short code.
 */
function getTypeCode(type: TransactionType): string {
    const codes: Record<TransactionType, string> = {
        [TransactionType.DEPOSIT]: 'DEP',
        [TransactionType.WITHDRAWAL]: 'WTH',
        [TransactionType.TRANSFER]: 'TRF',
        [TransactionType.REVERSAL]: 'REV',
        [TransactionType.ALLOCATION_TOPUP]: 'ALC',
    };
    return codes[type];
}

/**
 * Generates a random alphanumeric code.
 */
function generateRandomCode(length: number): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0, O, 1, I)
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Converts Naira to Kobo.
 */
export function nairaToKobo(naira: number): number {
    return Math.round(naira * 100);
}

/**
 * Converts Kobo to Naira.
 */
export function koboToNaira(kobo: number | string): number {
    const koboNum = typeof kobo === 'string' ? parseInt(kobo, 10) : kobo;
    return koboNum / 100;
}

/**
 * Formats kobo amount as Naira currency string.
 */
export function formatNaira(kobo: number | string): string {
    const naira = koboToNaira(kobo);
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
    }).format(naira);
}
