import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type UserRole = 'VENDEDOR' | 'COORDINADOR' | 'ADMIN';

export interface CurrentUser {
    id: string;
    email: string;
    full_name: string | null;
    role: UserRole;
    is_active: boolean;
    allowed_modules?: string[] | null;
}

/**
 * Hook to get the current logged-in user with their role from CRM_Usuarios table
 * This allows you to implement role-based permissions throughout the app
 * 
 * @example
 * const { user, role, isLoading, isAdmin } = useCurrentUser();
 * 
 * if (isAdmin) {
 *   // Show admin-only features
 * }
 */
export function useCurrentUser() {
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCurrentUser = async () => {
            try {
                setIsLoading(true);
                setError(null);

                // Get authenticated user from Supabase Auth
                const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

                console.log('[useCurrentUser] Auth User:', authUser?.id, authUser?.email);

                if (authError) {
                    console.error('[useCurrentUser] Auth Error:', authError);
                    throw authError;
                }

                if (!authUser) {
                    console.log('[useCurrentUser] No auth user found');
                    setUser(null);
                    setIsLoading(false);
                    return;
                }

                // Fetch user details from CRM_Usuarios table
                console.log('[useCurrentUser] Fetching CRM user for ID:', authUser.id);
                const { data: crmUser, error: crmError } = await supabase
                    .from('CRM_Usuarios')
                    .select('id, email, full_name, role, is_active')
                    .eq('id', authUser.id)
                    .single();

                console.log('[useCurrentUser] CRM User Result:', crmUser);
                console.log('[useCurrentUser] CRM Error:', crmError);

                if (crmError) {
                    console.error('[useCurrentUser] Error fetching CRM user:', crmError);
                    throw crmError;
                }

                if (crmUser) {
                    console.log('[useCurrentUser] Setting user:', crmUser);
                    setUser({
                        id: crmUser.id,
                        email: crmUser.email,
                        full_name: crmUser.full_name,
                        role: crmUser.role as UserRole,
                        is_active: crmUser.is_active,
                        allowed_modules: null, // Column missing in DB currently
                    });
                } else {
                    console.warn('[useCurrentUser] CRM user not found for auth ID:', authUser.id);
                }
            } catch (err: any) {
                console.error('[useCurrentUser] Error:', err);
                setError(err.message || 'Error al obtener usuario');
            } finally {
                setIsLoading(false);
            }
        };

        fetchCurrentUser();

        // Subscribe to auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                setUser(null);
            } else {
                fetchCurrentUser();
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return {
        user,
        role: user?.role || null,
        isLoading,
        error,
        // Convenience flags for role checking
        isVendedor: user?.role === 'VENDEDOR',
        isCoordinador: user?.role === 'COORDINADOR',
        isAdmin: user?.role === 'ADMIN',
        // Check if user has at least coordinator permissions
        hasCoordinatorAccess: user?.role === 'COORDINADOR' || user?.role === 'ADMIN',
        // Check if user is active
        isActive: user?.is_active || false,
    };
}
