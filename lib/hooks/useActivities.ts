import { useLiveQuery } from 'dexie-react-hooks';
import { db, LocalActivity } from '../db';
import { syncEngine } from '../sync';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabase';

/**
 * Converts a date input value to a proper ISO string.
 * For date-only inputs (YYYY-MM-DD from type="date"), treats the date as local time
 * to prevent timezone shift issues (e.g. selecting Jan 27 but saving Jan 26).
 */
function toISODateString(dateInput: string | Date | undefined | null): string {
    if (!dateInput) return new Date().toISOString();

    if (dateInput instanceof Date) {
        return dateInput.toISOString();
    }

    // If it's a date-only string (YYYY-MM-DD), parse as local time to avoid UTC shift
    if (typeof dateInput === 'string' && dateInput.length === 10 && dateInput.includes('-')) {
        const [year, month, day] = dateInput.split('-').map(Number);
        // Create date at local midnight, then convert to ISO
        const localDate = new Date(year, month - 1, day, 12, 0, 0); // Use noon to avoid any DST issues
        return localDate.toISOString();
    }

    // For datetime-local values (YYYY-MM-DDTHH:mm) or full ISO strings
    const date = new Date(dateInput);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export { type LocalActivity };

export function useActivities(opportunityId?: string) {
    const activities = useLiveQuery(
        () => opportunityId
            ? db.activities.where('opportunity_id').equals(opportunityId).toArray()
            : db.activities.toArray(),
        [opportunityId]
    );

    // Allowlist of columns that actually exist in CRM_Actividades on Supabase.
    // See migration: 20260218_add_activities_ms_columns.sql for the full schema.
    const DB_COLUMNS = new Set([
        'id', 'user_id', 'opportunity_id', 'tipo_actividad_id', 'asunto', 'descripcion',
        'fecha_inicio', 'fecha_fin', 'ms_planner_id', 'ms_event_id', 'created_at', 'updated_at',
        'is_completed', '_sync_metadata', 'created_by', 'updated_by', 'is_deleted',
        'tipo_actividad', 'clasificacion_id', 'subclasificacion_id', 'Tarea_planner',
        'teams_meeting_url', 'microsoft_attendees'
    ]);

    const createActivity = async (data: Partial<LocalActivity>) => {
        let userId: string | null = null;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            userId = user?.id || null;
        } catch {
            // Offline - try to get cached user ID from localStorage
            const cachedUser = localStorage.getItem('cachedUserId');
            if (cachedUser) userId = cachedUser;
        }

        if (!userId) throw new Error("No authenticated user (even offline)");
        const id = uuidv4();
        const newActivity: LocalActivity = {
            id,
            user_id: userId,
            tipo_actividad: data.tipo_actividad || 'EVENTO',
            asunto: (data.asunto || 'Nueva Actividad').trim(),
            fecha_inicio: toISODateString(data.fecha_inicio),
            fecha_fin: data.fecha_fin ? toISODateString(data.fecha_fin) : undefined,
            is_completed: !!data.is_completed,
            opportunity_id: data.opportunity_id || undefined,
            clasificacion_id: data.clasificacion_id || null,
            subclasificacion_id: data.subclasificacion_id || null,
            updated_at: new Date().toISOString()
        };

        // Ensure we don't have undefined fields that become null in JSON
        const cleanActivity = Object.fromEntries(
            Object.entries(newActivity).filter(([_, v]) => v !== undefined)
        );

        console.log("[useActivities] Creating Activity in Dexie:", cleanActivity);
        await db.activities.add(cleanActivity as LocalActivity);

        console.log("[useActivities] Queueing Mutation for Sync:", id);
        await syncEngine.queueMutation('CRM_Actividades', id, cleanActivity);
        return id;
    };

    const updateActivity = async (id: string, data: Partial<LocalActivity>) => {
        console.log("[useActivities] Updating Activity:", id, "with data:", data);
        const updated_at = new Date().toISOString();

        // Process dates to handle timezone correctly
        const rawChanges = {
            ...data,
            updated_at,
            ...(data.fecha_inicio && { fecha_inicio: toISODateString(data.fecha_inicio) }),
            ...(data.fecha_fin && { fecha_fin: toISODateString(data.fecha_fin) })
        };

        // Strip any fields that don't exist in CRM_Actividades (e.g. microsoft_attendees)
        // to prevent sync errors when Supabase rejects unknown columns.
        const changes = Object.fromEntries(
            Object.entries(rawChanges).filter(([key]) => DB_COLUMNS.has(key))
        );

        console.log("[useActivities] Sanitized changes for sync:", changes);

        await db.activities.update(id, changes);
        await syncEngine.queueMutation('CRM_Actividades', id, changes);
    };

    const toggleComplete = async (id: string, isCompleted: boolean) => {
        const updated_at = new Date().toISOString();
        await db.activities.update(id, { is_completed: isCompleted, updated_at });
        await syncEngine.queueMutation('CRM_Actividades', id, { is_completed: isCompleted, updated_at });

        // If completed, also mark related notifications as read in the background
        if (isCompleted) {
            supabase
                .from('CRM_Notifications')
                .update({ is_read: true })
                .eq('entity_id', id)
                .eq('type', 'ACTIVITY_OVERDUE')
                .then(({ error }) => {
                    if (error) console.error("[useActivities] Error marking notifications as read:", error);
                });
        }
    };

    const deleteActivity = async (id: string) => {
        const current = await db.activities.get(id);
        if (!current) return;

        await db.activities.delete(id);
        await syncEngine.queueMutation('CRM_Actividades', id, { ...current, is_deleted: true });
    };

    return {
        activities,
        createActivity,
        updateActivity,
        toggleComplete,
        deleteActivity
    };
}
