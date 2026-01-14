import { useMemo } from 'react';
import { useActivities } from './useActivities';
import { useOpportunities } from './useOpportunities';
import { useAccounts } from './useAccounts';
import { useConfig } from './useConfig';

export type NotificationType =
    | 'ACTIVITY_OVERDUE'
    | 'ACTIVITY_TODAY'
    | 'OPPORTUNITY_EXPIRED'
    | 'OPPORTUNITY_EXPIRING'
    | 'CLIENT_INACTIVE';

export interface NotificationItem {
    id: string;
    type: NotificationType;
    title: string;
    subtitle?: string;
    date?: string;
    entityId?: string; // ID of the Activity, Opportunity, or Account
    link?: string; // internal route to navigate to
}

export function useNotifications() {
    const { activities } = useActivities();
    const { opportunities } = useOpportunities();
    const { accounts } = useAccounts();
    const { config } = useConfig();

    const notifications = useMemo(() => {
        const items: NotificationItem[] = [];
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // Get configured days or default to 90 (3 months)
        const inactiveDaysDetails = parseInt(config.inactive_account_days || '90');
        const inactiveThresholdDate = new Date();
        inactiveThresholdDate.setDate(inactiveThresholdDate.getDate() - inactiveDaysDetails);

        // 1. Activities
        if (activities) {
            activities.forEach(act => {
                if (act.is_completed) return;

                const actDate = new Date(act.fecha_inicio);
                const actDateStr = actDate.toISOString().split('T')[0];

                // Overdue
                if (actDate < now && actDateStr !== todayStr) {
                    items.push({
                        id: `act-overdue-${act.id}`,
                        type: 'ACTIVITY_OVERDUE',
                        title: 'Actividad Vencida',
                        subtitle: act.asunto,
                        date: act.fecha_inicio,
                        entityId: act.id,
                        link: `/actividades?id=${act.id}`
                    });
                }
                // Today
                else if (actDateStr === todayStr) {
                    items.push({
                        id: `act-today-${act.id}`,
                        type: 'ACTIVITY_TODAY',
                        title: 'Para hoy',
                        subtitle: act.asunto,
                        date: act.fecha_inicio,
                        entityId: act.id,
                        link: `/actividades?id=${act.id}`
                    });
                }
            });
        }

        // 2. Opportunities
        if (opportunities) {
            opportunities.forEach(opp => {
                if (opp.status === 'WON' || opp.status === 'LOST' || opp.is_deleted) return;
                if (!opp.fecha_cierre_estimada) return;

                const closeDate = new Date(opp.fecha_cierre_estimada);
                const closeDateStr = closeDate.toISOString().split('T')[0];

                // Expired
                if (closeDate < now && closeDateStr !== todayStr) {
                    items.push({
                        id: `opp-expired-${opp.id}`,
                        type: 'OPPORTUNITY_EXPIRED',
                        title: 'Oportunidad Vencida',
                        subtitle: opp.nombre,
                        date: opp.fecha_cierre_estimada,
                        entityId: opp.id,
                        link: `/oportunidades/${opp.id}`
                    });
                }
                // Expiring Today
                else if (closeDateStr === todayStr) {
                    items.push({
                        id: `opp-expiring-${opp.id}`,
                        type: 'OPPORTUNITY_EXPIRING',
                        title: 'Vence hoy',
                        subtitle: opp.nombre,
                        date: opp.fecha_cierre_estimada,
                        entityId: opp.id,
                        link: `/oportunidades/${opp.id}`
                    });
                }
            });
        }

        // 3. Inactive Clients (Dynamic threshold)
        if (accounts && activities && opportunities) {
            accounts.forEach(acc => {
                // Find latest interaction date
                let lastInteraction = new Date(acc.created_at || '2000-01-01'); // Fallback to creation date

                // Check activities for this account (via opportunities or direct link if exists)
                // Note: Activities are usually linked to Opportunities, so we check opps first

                // Check Opportunities updates
                const accountOpps = opportunities.filter(o => o.account_id === acc.id);
                accountOpps.forEach(o => {
                    const oppDate = new Date(o.updated_at || o.created_at || '2000-01-01');
                    if (oppDate > lastInteraction) lastInteraction = oppDate;
                });

                const accountOppIds = accountOpps.map(o => o.id);
                const accountActivities = activities.filter(a => a.opportunity_id && accountOppIds.includes(a.opportunity_id));

                accountActivities.forEach(a => {
                    const actDate = new Date(a.fecha_inicio);
                    if (actDate > lastInteraction) lastInteraction = actDate;
                });

                if (lastInteraction < inactiveThresholdDate) {
                    items.push({
                        id: `acc-inactive-${acc.id}`,
                        type: 'CLIENT_INACTIVE',
                        title: 'Cliente Inactivo',
                        subtitle: `${acc.nombre} (Sin actividad > ${inactiveDaysDetails} días)`,
                        date: lastInteraction.toISOString(),
                        entityId: acc.id,
                        link: `/cuentas?id=${acc.id}` // Or specific account detail if available
                    });
                }
            });
        }

        // Sort by date (descending? priority?)
        // Let's sort by date ascending (oldest first for overdue) or priority.
        // For now, simple sort:
        return items.sort((a, b) => {
            // prioritize overdue
            if (a.type.includes('OVERDUE') && !b.type.includes('OVERDUE')) return -1;
            if (!a.type.includes('OVERDUE') && b.type.includes('OVERDUE')) return 1;
            return 0;
        });

    }, [activities, opportunities, accounts, config]);

    return { notifications, count: notifications.length };
}
