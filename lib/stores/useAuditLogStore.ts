import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuditLogItem {
    id: string;
    user_email: string;
    entity_type: string;
    entity_id: string;
    entity_name: string;
    action_type: 'CREATE' | 'UPDATE' | 'DELETE';
    timestamp: number;
    details: string;
}

interface AuditLogState {
    logs: AuditLogItem[];
    addLog: (log: Omit<AuditLogItem, 'id' | 'timestamp'>) => void;
    clearLogs: () => void;
}

export const useAuditLogStore = create<AuditLogState>()(
    persist(
        (set) => ({
            logs: [],
            addLog: (newLog) => set((state) => {
                const item: AuditLogItem = {
                    ...newLog,
                    id: typeof window !== 'undefined' && window.crypto?.randomUUID 
                        ? window.crypto.randomUUID() 
                        : Math.random().toString(36).substring(2, 15),
                    timestamp: Date.now()
                };
                const updatedLogs = [item, ...state.logs];
                // Limitamos a los últimos 50 registros
                return { logs: updatedLogs.slice(0, 50) };
            }),
            clearLogs: () => set({ logs: [] })
        }),
        {
            name: 'crm-audit-logs',
        }
    )
);
