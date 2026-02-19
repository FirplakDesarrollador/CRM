import { useMemo, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Notification as PersistedNotification } from '@/lib/types/notifications';
import { useCurrentUser } from './useCurrentUser';

export type NotificationType =
    | 'INACTIVE_CLIENT'
    | 'NEW_ACCOUNT'
    | 'NEW_OPPORTUNITY'
    | 'BUDGET_MISS'
    | 'ACTIVITY_OVERDUE';

export interface NotificationItem {
    id: string;
    type: NotificationType | string;
    title: string;
    subtitle?: string;
    date?: string;
    entityId?: string;
    link?: string;
    isRead?: boolean;
}

export function useNotifications() {
    const { user } = useCurrentUser();
    const [persistedNotifications, setPersistedNotifications] = useState<PersistedNotification[]>([]);

    // Fetch activities from local DB to check completion status
    const activities = useLiveQuery(() => db.activities.toArray());

    // Fetch & Subscribe to Persisted Notifications
    useEffect(() => {
        if (!user) return;

        const fetchNotifications = async () => {
            const { data } = await supabase
                .from('CRM_Notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);
            if (data) setPersistedNotifications(data as any);
        };

        fetchNotifications();

        const subscription = supabase
            .channel('my-notifications')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'CRM_Notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    fetchNotifications();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [user]);

    const notifications = useMemo(() => {
        const items: NotificationItem[] = [];

        // Only show persisted notifications from database
        persistedNotifications.forEach(n => {
            let link = '#';
            if (n.entity_type === 'ACCOUNT') link = `/cuentas?id=${n.entity_id}`;
            if (n.entity_type === 'OPPORTUNITY') link = `/oportunidades/${n.entity_id}`;
            if (n.entity_type === 'ACTIVITY') link = `/actividades?id=${n.entity_id}`;

            items.push({
                id: n.id,
                type: n.type,
                title: n.title,
                subtitle: n.message,
                date: n.created_at,
                entityId: n.entity_id,
                link,
                isRead: n.is_read
            });
        });

        // Filter out activity notifications if the activity is already completed
        return items
            .filter(n => {
                if (n.type === 'ACTIVITY_OVERDUE' && n.entityId) {
                    const activity = activities?.find(a => a.id === n.entityId);
                    if (activity?.is_completed) return false;
                }
                return true;
            })
            // Sort: unread first, then by date (newest first)
            .sort((a, b) => {
                if (a.isRead === false && b.isRead !== false) return -1;
                if (a.isRead !== false && b.isRead === false) return 1;

                const dateA = new Date(a.date || 0).getTime();
                const dateB = new Date(b.date || 0).getTime();
                return dateB - dateA;
            });
    }, [persistedNotifications, activities]);

    const markAsRead = async (id: string) => {
        if (persistedNotifications.find(n => n.id === id)) {
            await supabase.from('CRM_Notifications').update({ is_read: true }).eq('id', id);
            // Optimistic update
            setPersistedNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        }
    };

    return { notifications, count: notifications.filter(n => !n.isRead).length, markAsRead };
}

