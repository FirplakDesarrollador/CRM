import { UserRole } from './hooks/useCurrentUser';

/**
 * Permission definitions for the CRM application
 * This file centralizes all permission logic based on user roles
 */

export type Permission =
    // Oportunidades
    | 'view_all_opportunities'
    | 'view_own_opportunities'
    | 'create_opportunity'
    | 'edit_own_opportunity'
    | 'edit_all_opportunities'
    | 'delete_opportunity'
    | 'transfer_opportunity'

    // Cuentas
    | 'view_accounts'
    | 'create_account'
    | 'edit_account'
    | 'delete_account'

    // Contactos
    | 'view_contacts'
    | 'create_contact'
    | 'edit_contact'
    | 'delete_contact'

    // Actividades
    | 'view_all_activities'
    | 'view_own_activities'
    | 'create_activity'
    | 'edit_own_activity'
    | 'edit_all_activities'
    | 'delete_activity'

    // Cotizaciones
    | 'view_quotes'
    | 'create_quote'
    | 'edit_quote'
    | 'delete_quote'
    | 'approve_quote'

    // Reportes
    | 'view_reports'
    | 'view_team_reports'
    | 'export_reports'

    // Configuración
    | 'manage_users'
    | 'manage_settings'
    | 'view_audit_logs';

/**
 * Role-based permission matrix
 * Defines what each role can do in the system
 * 
 * ROLES:
 * - ADMIN: Acceso completo a todo el sistema
 * - COORDINADOR: Acceso a todo EXCEPTO configuración de usuarios
 * - VENDEDOR: Solo puede ver sus propias oportunidades y actividades, NO puede ver módulo de usuarios
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    VENDEDOR: [
        // Oportunidades - SOLO LAS PROPIAS
        'view_own_opportunities',
        'create_opportunity',
        'edit_own_opportunity',

        // Cuentas - acceso básico
        'view_accounts',
        'create_account',
        'edit_account',

        // Contactos - acceso básico
        'view_contacts',
        'create_contact',
        'edit_contact',

        // Actividades - SOLO LAS PROPIAS
        'view_own_activities',
        'create_activity',
        'edit_own_activity',

        // Cotizaciones - acceso básico
        'view_quotes',
        'create_quote',
        'edit_quote',

        // Reportes - solo propios
        'view_reports',

        // NO TIENE: view_all_opportunities, view_all_activities, manage_users, manage_settings
    ],

    COORDINADOR: [
        // Oportunidades - TODAS (puede ver todo)
        'view_all_opportunities',
        'view_own_opportunities',
        'create_opportunity',
        'edit_own_opportunity',
        'edit_all_opportunities',
        'delete_opportunity',
        'transfer_opportunity',

        // Cuentas - acceso completo
        'view_accounts',
        'create_account',
        'edit_account',
        'delete_account',

        // Contactos - acceso completo
        'view_contacts',
        'create_contact',
        'edit_contact',
        'delete_contact',

        // Actividades - TODAS (puede ver todo)
        'view_all_activities',
        'view_own_activities',
        'create_activity',
        'edit_own_activity',
        'edit_all_activities',
        'delete_activity',

        // Cotizaciones - acceso completo
        'view_quotes',
        'create_quote',
        'edit_quote',
        'delete_quote',
        'approve_quote',

        // Reportes - acceso completo
        'view_reports',
        'view_team_reports',
        'export_reports',

        // Configuración - puede ver logs pero NO gestionar usuarios
        'view_audit_logs',
        'manage_settings',

        // NO TIENE: manage_users (solo ADMIN puede gestionar usuarios)
    ],

    ADMIN: [
        // Oportunidades - TODAS
        'view_all_opportunities',
        'view_own_opportunities',
        'create_opportunity',
        'edit_own_opportunity',
        'edit_all_opportunities',
        'delete_opportunity',
        'transfer_opportunity',

        // Cuentas - acceso completo
        'view_accounts',
        'create_account',
        'edit_account',
        'delete_account',

        // Contactos - acceso completo
        'view_contacts',
        'create_contact',
        'edit_contact',
        'delete_contact',

        // Actividades - TODAS
        'view_all_activities',
        'view_own_activities',
        'create_activity',
        'edit_own_activity',
        'edit_all_activities',
        'delete_activity',

        // Cotizaciones - acceso completo
        'view_quotes',
        'create_quote',
        'edit_quote',
        'delete_quote',
        'approve_quote',

        // Reportes - acceso completo
        'view_reports',
        'view_team_reports',
        'export_reports',

        // Configuración - ACCESO COMPLETO (incluyendo gestión de usuarios)
        'manage_users',
        'manage_settings',
        'view_audit_logs',
    ],
};

/**
 * Check if a user role has a specific permission
 * 
 * @example
 * if (hasPermission('VENDEDOR', 'edit_all_opportunities')) {
 *   // Allow editing
 * }
 */
export function hasPermission(role: UserRole | null, permission: Permission): boolean {
    if (!role) return false;
    return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

/**
 * Check if a user role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole | null, permissions: Permission[]): boolean {
    if (!role) return false;
    return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if a user role has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole | null, permissions: Permission[]): boolean {
    if (!role) return false;
    return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Get all permissions for a specific role
 */
export function getRolePermissions(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
}
