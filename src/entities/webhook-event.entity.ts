import { Entity, Column, Index, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';
import { WebhookProvider } from '../common/enums';

/**
 * Audit trail for all incoming webhooks.
 * Used for debugging, replay, and compliance.
 */
@Entity('webhook_events')
@Index(['provider', 'eventId'], { unique: true })
@Index(['eventType', 'createdAt'])
@Index(['isProcessed'])
export class WebhookEvent {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /**
     * Payment provider (e.g., 'paystack').
     */
    @Column({
        type: 'enum',
        enum: WebhookProvider,
    })
    provider: WebhookProvider;

    /**
     * Event type (e.g., 'charge.success', 'transfer.success').
     */
    @Column()
    eventType: string;

    /**
     * Provider's event ID for deduplication.
     */
    @Column()
    eventId: string;

    /**
     * Full webhook payload.
     */
    @Column({ type: 'jsonb' })
    payload: Record<string, any>;

    /**
     * Signature header for verification audit.
     */
    @Column({ type: 'varchar', nullable: true })
    signature?: string | null;

    /**
     * Whether this event has been processed.
     */
    @Column({ default: false })
    isProcessed: boolean;

    /**
     * When the event was processed.
     */
    @Column({ type: 'timestamp', nullable: true })
    processedAt?: Date | null;

    /**
     * Error message if processing failed.
     */
    @Column({ type: 'text', nullable: true })
    error?: string | null;

    @CreateDateColumn()
    createdAt: Date;
}
