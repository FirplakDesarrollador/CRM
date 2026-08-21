import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserRole } from './useCurrentUser';

export interface User {
    id: string;
    email: string;
    full_name: string | null;
    role: UserRole;
    is_active: boolean;
    allowed_modules?: string[] | null;
    coordinadores?: string[] | null;
    pais?: string | null;
    departamento?: string | null;
    paises?: string[] | null;
    departamentos?: string[] | null;
    canales?: string[] | null;
    created_at: string;
    updated_at: string;
}

export interface CreateUserData {
    email: string;
    password: string;
    full_name: string;
    role: UserRole;
    allowed_modules?: string[];
    coordinadores?: string[];
    pais?: string | null;
    departamento?: string | null;
    paises?: string[];
    departamentos?: string[];
    canales?: string[];
}

export interface UpdateUserData {
    full_name?: string;
    role?: UserRole;
    is_active?: boolean;
    allowed_modules?: string[] | null;
    coordinadores?: string[] | null;
    pais?: string | null;
    departamento?: string | null;
    paises?: string[] | null;
    departamentos?: string[] | null;
    canales?: string[] | null;
}

/**
 * Hook to manage users in the CRM system
 * Only accessible by ADMIN users
 */
export function useUsers() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch all users
    const fetchUsers = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('CRM_Usuarios')
                .select('*')
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;

            setUsers(data || []);
        } catch (err: any) {
            console.error('[useUsers] Error fetching users:', err);
            setError(err.message || 'Error al cargar usuarios');
        } finally {
            setIsLoading(false);
        }
    };

    // Create new user
    const createUser = async (userData: CreateUserData): Promise<{ success: boolean; error?: string }> => {
        try {
            // Create user in Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: userData.email,
                password: userData.password,
                email_confirm: true,
                user_metadata: {
                    full_name: userData.full_name,
                },
            });

            if (authError) throw authError;

            if (!authData.user) {
                throw new Error('No se pudo crear el usuario');
            }

            // The trigger handle_new_user will automatically create the CRM_Usuarios record
            // But we need to update the role, allowed_modules AND coordinadores
            // We'll prepare the update object
            const updates: any = { full_name: userData.full_name };
            if (userData.role) updates.role = userData.role;
            if (userData.allowed_modules) updates.allowed_modules = userData.allowed_modules;
            if (userData.coordinadores) updates.coordinadores = userData.coordinadores;
            if (userData.pais !== undefined) updates.pais = userData.pais;
            if (userData.departamento !== undefined) updates.departamento = userData.departamento;
            if (userData.paises !== undefined) updates.paises = userData.paises;
            if (userData.departamentos !== undefined) updates.departamentos = userData.departamentos;
            if (userData.canales !== undefined) updates.canales = userData.canales;

            // Only update if there are extra fields beyond the basic trigger defaults
            if (Object.keys(updates).length > 1 || updates.role !== 'VENDEDOR') {
                let { error: updateError } = await supabase
                    .from('CRM_Usuarios')
                    .update(updates)
                    .eq('id', authData.user.id);

                if (updateError && (updateError.message.includes('canales') || updateError.message.includes('departamento') || updateError.message.includes('pais') || updateError.message.includes('schema cache'))) {
                    console.warn('[useUsers] Columnas adicionales no encontradas en la DB remota durante createUser, reintentando sin campos extendidos...');
                    delete updates.canales;
                    delete updates.pais;
                    delete updates.departamento;
                    delete updates.paises;
                    delete updates.departamentos;

                    const retryRes = await supabase
                        .from('CRM_Usuarios')
                        .update(updates)
                        .eq('id', authData.user.id);
                    
                    updateError = retryRes.error;
                }

                if (updateError) throw updateError;
            }

            // Refresh users list
            await fetchUsers();

            return { success: true };
        } catch (err: any) {
            console.error('[useUsers] Error creating user:', err);
            return { success: false, error: err.message || 'Error al crear usuario' };
        }
    };

    // Update user
    const updateUser = async (userId: string, updates: UpdateUserData): Promise<{ success: boolean; error?: string }> => {
        try {
            const payload: any = {
                ...updates,
                updated_at: new Date().toISOString(),
            };

            let { error: updateError } = await supabase
                .from('CRM_Usuarios')
                .update(payload)
                .eq('id', userId);

            if (updateError && (updateError.message.includes('canales') || updateError.message.includes('departamento') || updateError.message.includes('pais') || updateError.message.includes('schema cache'))) {
                console.warn('[useUsers] Columnas adicionales no encontradas en la DB remota, reintentando sin campos extendidos...');
                delete payload.canales;
                delete payload.pais;
                delete payload.departamento;
                delete payload.paises;
                delete payload.departamentos;

                const retryRes = await supabase
                    .from('CRM_Usuarios')
                    .update(payload)
                    .eq('id', userId);
                
                updateError = retryRes.error;
            }

            if (updateError) throw updateError;

            // Refresh users list
            await fetchUsers();

            return { success: true };
        } catch (err: any) {
            console.error('[useUsers] Error updating user:', err);
            return { success: false, error: err.message || 'Error al actualizar usuario' };
        }
    };

    // Update user role
    const updateUserRole = async (userId: string, newRole: UserRole): Promise<{ success: boolean; error?: string }> => {
        return updateUser(userId, { role: newRole });
    };

    // Toggle user active status
    const toggleUserStatus = async (userId: string, isActive: boolean): Promise<{ success: boolean; error?: string }> => {
        return updateUser(userId, { is_active: isActive });
    };

    // Delete user (soft delete by deactivating)
    const deleteUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
        return toggleUserStatus(userId, false);
    };

    // Load users on mount
    useEffect(() => {
        fetchUsers();
    }, []);

    return {
        users,
        isLoading,
        error,
        fetchUsers,
        createUser,
        updateUser,
        updateUserRole,
        toggleUserStatus,
        deleteUser,
    };
}
