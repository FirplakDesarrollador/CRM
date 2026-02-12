export type NotificationType = 'INACTIVE_CLIENT' | 'BUDGET_MISS' | 'NEW_ACCOUNT' | 'NEW_OPPORTUNITY' | 'ACTIVITY_OVERDUE';
export type NotificationChannel = 'APP' | 'EMAIL' | 'TEAMS';
export type NotificationRecipient = 'SELLER' | 'COORDINATOR';

export interface NotificationRule {
    id: string;
    name: string;
    type: NotificationType;
    config: {
        days?: number; // For INACTIVE_CLIENT and ACTIVITY_OVERDUE (days after due date)
        amount?: number; // For BUDGET_MISS
        date?: string; // For BUDGET_MISS
    };
    recipients: NotificationRecipient[];
    channels: NotificationChannel[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
    created_by?: string;
}

export interface Notification {
    id: string;
    user_id: string;
    type: NotificationType | string; // Allow string for legacy/other types
    title: string;
    message?: string; // Detailed message
    entity_id?: string;
    entity_type?: 'ACCOUNT' | 'OPPORTUNITY' | 'ACTIVITY';
    is_read: boolean;
    created_at: string;
}
