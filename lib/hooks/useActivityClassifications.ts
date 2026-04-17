import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface ActivityClassification {
    id: number;
    nombre: string;
    tipo_actividad: 'EVENTO' | 'TAREA';
    created_at?: string;
    is_deleted?: boolean;
}

export interface ActivitySubclassification {
    id: number;
    nombre: string;
    clasificacion_id: number;
    created_at?: string;
    is_deleted?: boolean;
}

export function useActivityClassifications() {
    const [classifications, setClassifications] = useState<ActivityClassification[]>([]);
    const [subclassifications, setSubclassifications] = useState<ActivitySubclassification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [clsRes, subRes] = await Promise.all([
                supabase.from('CRM_Activity_Clasificacion').select('*').eq('is_deleted', false).order('nombre'),
                supabase.from('CRM_Activity_Subclasificacion').select('*').eq('is_deleted', false).order('nombre')
            ]);

            if (clsRes.error) throw clsRes.error;
            if (subRes.error) throw subRes.error;

            setClassifications(clsRes.data || []);
            setSubclassifications(subRes.data || []);
        } catch (err: any) {
            console.error('Error fetching activity classifications:', err);
            setError(err.message || 'Error al cargar clasificaciones');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const createClassification = async (nombre: string, tipo_actividad: 'EVENTO' | 'TAREA') => {
        try {
            const { data, error } = await supabase
                .from('CRM_Activity_Clasificacion')
                .insert([{ nombre, tipo_actividad }])
                .select()
                .single();

            if (error) throw error;
            setClassifications(prev => [...prev, data]);
            return { data, error: null };
        } catch (err: any) {
            return { data: null, error: err.message };
        }
    };

    const deleteClassification = async (id: number) => {
        try {
            // Mark classification as deleted
            const clsRes = await supabase
                .from('CRM_Activity_Clasificacion')
                .update({ is_deleted: true })
                .eq('id', id);

            if (clsRes.error) throw clsRes.error;

            // Mark all related subclassifications as deleted too
            const subRes = await supabase
                .from('CRM_Activity_Subclasificacion')
                .update({ is_deleted: true })
                .eq('clasificacion_id', id);

            if (subRes.error) {
                console.warn('[useActivityClassifications] Error marking subclassifications as deleted:', subRes.error);
            }

            setClassifications(prev => prev.filter(c => c.id !== id));
            setSubclassifications(prev => prev.filter(s => s.clasificacion_id !== id));
            return { error: null };
        } catch (err: any) {
            return { error: err.message };
        }
    };

    const createSubclassification = async (nombre: string, clasificacion_id: number) => {
        try {
            const { data, error } = await supabase
                .from('CRM_Activity_Subclasificacion')
                .insert([{ nombre, clasificacion_id }])
                .select()
                .single();

            if (error) throw error;
            setSubclassifications(prev => [...prev, data]);
            return { data, error: null };
        } catch (err: any) {
            return { data: null, error: err.message };
        }
    };

    const deleteSubclassification = async (id: number) => {
        try {
            const { error } = await supabase
                .from('CRM_Activity_Subclasificacion')
                .update({ is_deleted: true })
                .eq('id', id);

            if (error) throw error;
            setSubclassifications(prev => prev.filter(s => s.id !== id));
            return { error: null };
        } catch (err: any) {
            return { error: err.message };
        }
    };

    return {
        classifications,
        subclassifications,
        loading,
        error,
        refresh: fetchData,
        createClassification,
        deleteClassification,
        createSubclassification,
        deleteSubclassification
    };
}
