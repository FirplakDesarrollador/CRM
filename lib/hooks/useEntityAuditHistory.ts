import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface AuditLogEntry {
    id: string;
    entity_type: 'OPORTUNIDAD' | 'CUENTA' | 'CONTACTO';
    entity_id: string;
    field_name: string;
    field_label: string;
    old_value: string | null;
    new_value: string | null;
    changed_by: string | null;
    changed_by_name: string | null;
    changed_at: string;
}

interface UseEntityAuditHistoryOptions {
    entityType: 'OPORTUNIDAD' | 'CUENTA' | 'CONTACTO';
    entityId?: string | null;
    limit?: number;
    enabled?: boolean;
}

export function useEntityAuditHistory({
    entityType,
    entityId,
    limit = 50,
    enabled = true
}: UseEntityAuditHistoryOptions) {
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = useCallback(async () => {
        if (!entityId || !enabled) {
            setEntries([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data, error: queryError } = await supabase
                .from('CRM_HistorialModificaciones')
                .select('*')
                .eq('entity_type', entityType)
                .eq('entity_id', entityId)
                .order('changed_at', { ascending: false })
                .limit(limit);

            if (queryError) {
                console.error('[useEntityAuditHistory] Error fetching audit history:', queryError);
                setError(queryError.message);
                return;
            }

            setEntries(data || []);
        } catch (err: any) {
            console.error('[useEntityAuditHistory] Unexpected error:', err);
            setError(err?.message || 'Error al cargar el historial de cambios');
        } finally {
            setIsLoading(false);
        }
    }, [entityType, entityId, limit, enabled]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    return {
        entries,
        isLoading,
        error,
        refetch: fetchHistory
    };
}
