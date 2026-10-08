/**
 * Herramientas MCP para el Dominio de Parámetros y Configuración
 */
import { McpSessionContext, McpToolResult } from '../types';
import { CrmDatabaseAdapter, CLASIFICACIONES_ACTIVIDAD, ORIGENES_OPORTUNIDAD } from '../database';

export async function crmGestionarClasificacion(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: { nombre?: string; tipo_actividad?: string }
): Promise<McpToolResult> {
  const nombre = args.nombre;
  const tipo = args.tipo_actividad || 'TAREA';

  if (!nombre) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: El "nombre" de la clasificación es obligatorio.' }],
    };
  }

  const newId = CLASIFICACIONES_ACTIVIDAD.length + 1;
  const newItem = { id: newId, nombre, tipo };
  CLASIFICACIONES_ACTIVIDAD.push(newItem);

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: `Clasificación "${nombre}" registrada exitosamente.`,
          clasificacion: newItem,
        }),
      },
    ],
  };
}

export async function crmGestionarOrigen(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: { nombre?: string }
): Promise<McpToolResult> {
  const nombre = args.nombre;
  if (!nombre) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: El "nombre" del origen es obligatorio.' }],
    };
  }

  const newId = ORIGENES_OPORTUNIDAD.length + 1;
  const newItem = { id: newId, nombre };
  ORIGENES_OPORTUNIDAD.push(newItem);

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: `Origen de oportunidad "${nombre}" creado exitosamente.`,
          origen: newItem,
        }),
      },
    ],
  };
}

export async function crmGestionarConfiguracion(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: { key?: string; value?: unknown }
): Promise<McpToolResult> {
  const key = args.key;
  const value = args.value;

  if (!key) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: Se requiere "key" para actualizar configuración.' }],
    };
  }

  const memory = db.getMemory();
  memory.config.set(key, value);

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: `Parámetro de configuración "${key}" actualizado exitosamente.`,
          key,
          value,
        }),
      },
    ],
  };
}
