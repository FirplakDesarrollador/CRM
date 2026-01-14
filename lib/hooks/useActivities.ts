import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { syncEngine } from '../sync';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabase';

export interface LocalActivity {
    id: string;
    opportunity_id?: string;
    user_id: string;
    tipo_actividad_id: number;
    asunto: string;
    descripcion?: string;
    fecha_inicio: string;
    fecha_fin: string;
    is_completed: boolean;
    updated_at: string;
}

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
            tipo_actividad_id: 1, // Default to a type
            asunto: '',
            fecha_inicio: new Date().toISOString(),
            fecha_fin: new Date(Date.now() + 3600000).toISOString(),
            is_completed: false,
            updated_at: new Date().toISOString(),
            ...data
        };

        await db.activities.add(newActivity);
        await syncEngine.queueMutation('CRM_Actividades', id, newActivity);
        return id;
    };

    const toggleComplete = async (id: string, isCompleted: boolean) => {
        const updated_at = new Date().toISOString();
        await db.activities.update(id, { is_completed: isCompleted, updated_at });
        await syncEngine.queueMutation('CRM_Actividades', id, { is_completed: isCompleted, updated_at });
    };

    return {
        activities,
        createActivity,
        toggleComplete
    };
}
