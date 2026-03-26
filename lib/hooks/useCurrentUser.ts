import { useUserStore, UserRole, CurrentUser } from '@/lib/stores/useUserStore';

// Re-export types for backward compatibility
export type { UserRole, CurrentUser };

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
    const { user: realUser, isLoading, error, viewMode, setViewMode } = useUserStore();

    // Determine the effective role
    // If viewMode is set, it overrides the real role
    const effectiveRole = viewMode || realUser?.role || null;

    // Create a patched user object if viewMode is active, so consuming components
    // that check user.role directly will see the simulated role.
    const user = realUser ? { ...realUser, role: effectiveRole as UserRole } : null;

    return {
        user,
        role: effectiveRole,
        // Expose the real role for the config page to allow toggling back
        realRole: realUser?.role || null,
        viewMode,
        setViewMode,
        isLoading,
        error,
        // Convenience flags based on EFFECTIVE role (so the whole app "thinks" we are that role)
        isVendedor: effectiveRole === 'VENDEDOR',
        isCoordinador: effectiveRole === 'COORDINADOR',
        isAdmin: effectiveRole === 'ADMIN',
        // Check if user has at least coordinator permissions
        hasCoordinatorAccess: effectiveRole === 'COORDINADOR' || effectiveRole === 'ADMIN',
        // Check if user is active
        isActive: user?.is_active || false,
    };
}
