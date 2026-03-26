"use client";

import { ReactNode } from 'react';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { hasPermission, hasAnyPermission, Permission } from '@/lib/permissions';

interface PermissionGuardProps {
    /** Single permission or array of permissions required */
    permission?: Permission | Permission[];
    /** Module path to check against allowed_modules override */
    modulePath?: string;
    /** If true, user needs ALL permissions. If false, user needs ANY permission */
    requireAll?: boolean;
    /** Content to show when user has permission */
    children: ReactNode;
    /** Optional fallback content when user doesn't have permission */
    fallback?: ReactNode;
}

/**
 * Component to conditionally render content based on user permissions.
 * Uses useCurrentUser() to respect viewMode simulation.
 */
export function PermissionGuard({
    permission,
    modulePath,
    requireAll = false,
    children,
    fallback = null
}: PermissionGuardProps) {
    const { user, role } = useCurrentUser();

    // 1. Check if allowed_modules explicitly grants access to this module
    if (modulePath && user?.allowed_modules?.includes(modulePath)) {
        return <>{children}</>;
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
