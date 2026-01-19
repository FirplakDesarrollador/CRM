"use client";

import { ReactNode } from 'react';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { hasPermission, hasAnyPermission, Permission } from '@/lib/permissions';

interface PermissionGuardProps {
    /** Single permission or array of permissions required */
    permission?: Permission | Permission[];
    /** If true, user needs ALL permissions. If false, user needs ANY permission */
    requireAll?: boolean;
    /** Content to show when user has permission */
    children: ReactNode;
    /** Optional fallback content when user doesn't have permission */
    fallback?: ReactNode;
}

/**
 * Component to conditionally render content based on user permissions
 * 
 * @example
 * // Single permission
 * <PermissionGuard permission="delete_opportunity">
 *   <DeleteButton />
 * </PermissionGuard>
 * 
 * @example
 * // Multiple permissions (any)
 * <PermissionGuard permission={['edit_own_opportunity', 'edit_all_opportunities']}>
 *   <EditButton />
 * </PermissionGuard>
 * 
 * @example
 * // Multiple permissions (all required)
 * <PermissionGuard 
 *   permission={['view_reports', 'export_reports']} 
 *   requireAll
 * >
 *   <ExportButton />
 * </PermissionGuard>
 * 
 * @example
 * // With fallback
 * <PermissionGuard 
 *   permission="manage_users"
 *   fallback={<p>No tienes permisos para ver esto</p>}
 * >
 *   <UserManagementPanel />
 * </PermissionGuard>
 */
export function PermissionGuard({
    permission,
    requireAll = false,
    children,
    fallback = null
}: PermissionGuardProps) {
    const { role, isLoading } = useCurrentUser();

    // While loading, don't show anything
    if (isLoading) {
        return null;
    }

    // If no permission specified, always show children
    if (!permission) {
        return <>{children}</>;
    }

    // Check permissions
    let hasAccess = false;

    if (Array.isArray(permission)) {
        if (requireAll) {
            // User needs ALL permissions
            hasAccess = permission.every(p => hasPermission(role, p));
        } else {
            // User needs ANY permission
            hasAccess = hasAnyPermission(role, permission);
        }
    } else {
        // Single permission
        hasAccess = hasPermission(role, permission);
    }

    return hasAccess ? <>{children}</> : <>{fallback}</>;
}
