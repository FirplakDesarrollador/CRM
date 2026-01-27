import { useLiveQuery } from 'dexie-react-hooks';
import { db, LocalActivity } from '../db';
import { syncEngine } from '../sync';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabase';

export { type LocalActivity };

export function useActivities(opportunityId?: string) {
    const activities = useLiveQuery(
        () => opportunityId
            ? db.activities.where('opportunity_id').equals(opportunityId).toArray()
            : db.activities.toArray(),
        [opportunityId]
    );

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
            fecha_inicio: data.fecha_inicio || new Date().toISOString(),
            fecha_fin: data.fecha_fin || undefined,
            is_completed: !!data.is_completed,
            opportunity_id: data.opportunity_id || undefined,
            updated_at: new Date().toISOString()
        };

        // Ensure we don't have undefined fields that become null in JSON
        const cleanActivity = Object.fromEntries(
            Object.entries(newActivity).filter(([_, v]) => v !== undefined)
        );

        await db.activities.add(cleanActivity as LocalActivity);
        await syncEngine.queueMutation('CRM_Actividades', id, cleanActivity);
        return id;
    };

    const updateActivity = async (id: string, data: Partial<LocalActivity>) => {
        const updated_at = new Date().toISOString();
        const changes = { ...data, updated_at };

        await db.activities.update(id, changes);
        await syncEngine.queueMutation('CRM_Actividades', id, changes);
    };

    const toggleComplete = async (id: string, isCompleted: boolean) => {
        const updated_at = new Date().toISOString();
        await db.activities.update(id, { is_completed: isCompleted, updated_at });
        await syncEngine.queueMutation('CRM_Actividades', id, { is_completed: isCompleted, updated_at });
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
