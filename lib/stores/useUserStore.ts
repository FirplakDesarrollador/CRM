import { create } from 'zustand';
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

interface UserState {
    user: CurrentUser | null;
    isLoading: boolean;
    error: string | null;
    viewMode: UserRole | null;
    initialized: boolean;

    // Actions
    setViewMode: (mode: UserRole | null) => void;
    fetchUser: (force?: boolean) => Promise<void>;
    initialize: () => () => void; // Returns unsubscribe function
}

export const useUserStore = create<UserState>((set, get) => ({
    user: null,
    isLoading: true,
    error: null,
    viewMode: null,
    initialized: false,

    setViewMode: (mode) => {
        set({ viewMode: mode });
        if (mode) {
            localStorage.setItem('crm_view_mode', mode);
        } else {
            localStorage.removeItem('crm_view_mode');
        }
    },

    fetchUser: async (force = false) => {
        const state = get();
        if (!force && state.initialized && state.user) return; // Avoid re-fetching if already loaded

        try {
            set({ isLoading: true, error: null });

            // Restore viewMode from localStorage if not set
            if (!state.viewMode && typeof window !== 'undefined') {
                const savedMode = localStorage.getItem('crm_view_mode') as UserRole | null;
                if (savedMode) {
                    set({ viewMode: savedMode });
                }
            }

            // Get authenticated user from Supabase Auth
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

            if (authError) throw authError;

            if (!authUser) {
                set({ user: null, isLoading: false, initialized: true });
                return;
            }

            // Fetch user details from CRM_Usuarios table
            const { data: crmUser, error: crmError } = await supabase
                .from('CRM_Usuarios')
                .select('id, email, full_name, role, is_active')
                .eq('id', authUser.id)
                .single();

            if (crmError) throw crmError;

            if (crmUser) {
                set({
                    user: {
                        id: crmUser.id,
                        email: crmUser.email,
                        full_name: crmUser.full_name,
                        role: crmUser.role as UserRole,
                        is_active: crmUser.is_active,
                        allowed_modules: null,
                    },
                    initialized: true
                });
            } else {
                console.warn('[useUserStore] CRM user not found for auth ID:', authUser.id);
                set({ user: null, initialized: true });
            }
        } catch (err: any) {
            console.error('[useUserStore] Error:', err);
            set({ error: err.message || 'Error al obtener usuario' });
        } finally {
            set({ isLoading: false });
        }
    },

    initialize: () => {
        // Initial fetch
        get().fetchUser();

        // Subscribe to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                set({ user: null, viewMode: null });
                localStorage.removeItem('crm_view_mode');
            } else {
                // Determine if we need to refetch
                const currentUser = get().user;
                if (!currentUser || currentUser.id !== session.user.id) {
                    get().fetchUser(true); // Force refetch if user changed or not loaded
                }
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }
}));
