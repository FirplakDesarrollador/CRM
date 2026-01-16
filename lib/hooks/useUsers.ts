import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from 'lucide-react';

export type CRMUser = {
    id: string;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    created_at: string;
};

export function useUsers() {
    const [users, setUsers] = useState<CRMUser[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('CRM_Usuarios')
                .select('*')
                .order('full_name', { ascending: true });

            if (error) throw error;
            setUsers(data as CRMUser[]);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateUser = async (id: string, updates: Partial<CRMUser>) => {
        try {
            const { error } = await supabase
                .from('CRM_Usuarios')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            // Optimistic update
            setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    return {
        users,
        loading,
        error,
        fetchUsers,
        updateUser
    };
}
