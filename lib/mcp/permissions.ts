/**
 * Reglas de autorización y control de acceso del Servidor MCP
 */
import { McpSessionContext, McpUserRole } from './types';

export function normalizeRole(role: McpUserRole | string): 'VENDEDOR' | 'COORDINADOR' | 'ADMIN' {
  const upper = String(role || 'VENDEDOR').toUpperCase();
  if (upper === 'ADMIN' || upper === 'ADMINISTRADOR') return 'ADMIN';
  if (upper === 'COORDINADOR') return 'COORDINADOR';
  return 'VENDEDOR';
}

/**
 * Verifica si el nombre de una herramienta corresponde a una operación de borrado prohibida
 */
export function isForbiddenDeleteTool(toolName: string): boolean {
  const lower = toolName.toLowerCase();
  return (
    lower.includes('delete') ||
    lower.includes('eliminar') ||
    lower.includes('borrar') ||
    lower.includes('drop') ||
    lower.includes('destroy')
  );
}

/**
 * Valida si un rol tiene permiso para ejecutar una herramienta dada
 */
export function canExecuteTool(ctx: McpSessionContext, toolName: string): boolean {
  if (isForbiddenDeleteTool(toolName)) return false;

  const role = normalizeRole(ctx.role);

  // Herramientas exclusivas de ADMINISTRADOR
  const adminOnlyTools = [
    'crm_gestionar_configuracion',
  ];
  if (adminOnlyTools.includes(toolName)) {
    return role === 'ADMIN';
  }

  // Herramientas de COORDINADOR o ADMINISTRADOR
  const coordinatorTools = [
    'crm_reasignar_oportunidad',
    'crm_reasignar_cuenta_cascada',
    'crm_gestionar_clasificacion',
    'crm_gestionar_origen',
  ];
  if (coordinatorTools.includes(toolName)) {
    return role === 'COORDINADOR' || role === 'ADMIN';
  }

  // Las demás herramientas comerciales están disponibles para todos los roles
  return true;
}

/**
 * Valida si el usuario puede acceder a una oportunidad específica
 */
export function canAccessOpportunity(
  ctx: McpSessionContext,
  opp: { owner_user_id?: string; colaboradores_ids?: string[] }
): boolean {
  const role = normalizeRole(ctx.role);
  if (role === 'ADMIN' || role === 'COORDINADOR') return true;

  // Vendedor solo puede acceder si es el dueño o colaborador
  const isOwner = opp.owner_user_id === ctx.userId;
  const isCollab = opp.colaboradores_ids?.includes(ctx.userId);
  return isOwner || !!isCollab;
}

/**
 * Valida si el usuario puede acceder o editar una actividad específica
 */
export function canAccessActivity(
  ctx: McpSessionContext,
  act: { user_id?: string }
): boolean {
  const role = normalizeRole(ctx.role);
  if (role === 'ADMIN' || role === 'COORDINADOR') return true;
  return act.user_id === ctx.userId;
}
