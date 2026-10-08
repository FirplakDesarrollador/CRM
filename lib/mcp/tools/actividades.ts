/**
 * Herramientas MCP para el Dominio de Actividades (Tareas, Eventos y Agenda)
 */
import { McpSessionContext, McpToolResult, CompactActivity } from '../types';
import { CrmDatabaseAdapter, CLASIFICACIONES_ACTIVIDAD } from '../database';
import { canAccessActivity } from '../permissions';

export async function crmAgendaDiaria(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter
): Promise<McpToolResult> {
  const memory = db.getMemory();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const allActs = Array.from(memory.activities.values());
  const myActs = allActs.filter((act) => {
    if (act.is_deleted) return false;
    if (!canAccessActivity(ctx, act)) return false;
    return true;
  });

  const pendientesHoy = myActs.filter((a) => {
    if (a.is_completed) return false;
    const fecha = String(a.fecha_inicio || '').split('T')[0];
    return fecha <= todayStr;
  });

  const completadasHoy = myActs.filter((a) => {
    if (!a.is_completed) return false;
    const fecha = String(a.updated_at || a.fecha_inicio || '').split('T')[0];
    return fecha === todayStr;
  });

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            fecha_consulta: todayStr,
            usuario_id: ctx.userId,
            resumen: {
              total_pendientes_o_vencidas: pendientesHoy.length,
              total_completadas_hoy: completadasHoy.length,
            },
            pendientes: pendientesHoy.map((a) => ({
              id: a.id,
              asunto: a.asunto,
              tipo: a.tipo_actividad,
              prioridad: a.prioridad || 'Media',
              fecha_inicio: a.fecha_inicio,
              fecha_fin: a.fecha_fin,
              opportunity_id: a.opportunity_id,
              account_id: a.account_id,
            })),
          },
          null,
          2
        ),
      },
    ],
  };
}

export async function crmListarActividades(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: {
    limit?: number;
    offset?: number;
    estado?: string;
    opportunity_id?: string;
    account_id?: string;
    cuenta_id?: string;
    incluir_archivadas?: boolean;
  }
): Promise<McpToolResult> {
  const limit = Math.min(Math.max(1, Number(args.limit || 10)), 30);
  const offset = Math.max(0, Number(args.offset || 0));
  const estadoFilter = args.estado; // 'pendientes' | 'vencidas' | 'completadas'
  const oppId = args.opportunity_id;
  const accId = args.account_id || args.cuenta_id;

  const memory = db.getMemory();
  const allActs = Array.from(memory.activities.values());
  const now = new Date().toISOString();

  const filtered = allActs.filter((act) => {
    if (act.is_deleted && !args.incluir_archivadas) return false;
    if (!canAccessActivity(ctx, act)) return false;
    if (oppId && act.opportunity_id !== oppId) return false;
    if (accId && act.account_id !== accId) return false;

    if (estadoFilter === 'completadas' && !act.is_completed) return false;
    if (estadoFilter === 'pendientes' && act.is_completed) return false;
    if (estadoFilter === 'vencidas') {
      if (act.is_completed) return false;
      if (!act.fecha_fin && !act.fecha_inicio) return false;
      const compareDate = String(act.fecha_fin || act.fecha_inicio || '');
      if (compareDate >= now) return false;
    }

    return true;
  });

  const paged = filtered.slice(offset, offset + limit).map((act): CompactActivity => {
    const clasif = CLASIFICACIONES_ACTIVIDAD.find((c) => c.id === act.clasificacion_id);
    return {
      id: act.id,
      asunto: act.asunto,
      tipo_actividad: act.tipo_actividad,
      prioridad: act.prioridad,
      fecha_inicio: act.fecha_inicio || '',
      fecha_fin: act.fecha_fin || undefined,
      is_completed: Boolean(act.is_completed),
      opportunity_id: act.opportunity_id,
      account_id: act.account_id,
      user_id: (act.user_id || act.assigned_to || act.owner_user_id || '') as string,
      clasificacion_nombre: clasif?.nombre,
    };
  });

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          items: paged,
          total_count: filtered.length,
          limit,
          offset,
          has_more: offset + limit < filtered.length,
        }),
      },
    ],
  };
}

export async function crmConsultarActividad(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: { id?: string }
): Promise<McpToolResult> {
  const id = args.id;
  if (!id) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: El parámetro "id" es obligatorio.' }],
    };
  }

  const memory = db.getMemory();
  const act = memory.activities.get(id);

  if (!act) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Actividad no encontrada con ID: ${id}` }],
    };
  }

  if (!canAccessActivity(ctx, act)) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Acceso no autorizado a esta actividad.' }],
    };
  }

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify(act, null, 2),
      },
    ],
  };
}

export async function crmCrearActividad(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: {
    clasificacion_id?: number | string;
    asunto?: string;
    opportunity_id?: string;
    account_id?: string;
    descripcion?: string;
    tipo_actividad?: 'TAREA' | 'EVENTO';
    prioridad?: 'Alta' | 'Media' | 'Baja';
    subclasificacion_id?: number | string;
    fecha_inicio?: string;
    fecha_fin?: string;
    user_id?: string;
  }
): Promise<McpToolResult> {
  const memory = db.getMemory();

  const clasificacionId = args.clasificacion_id ? Number(args.clasificacion_id) : 1;
  const clasifObj = CLASIFICACIONES_ACTIVIDAD.find((c) => c.id === clasificacionId);

  // Autogeneración de asunto si se omite
  let asuntoFinal = args.asunto;
  if (!asuntoFinal || !asuntoFinal.trim()) {
    const oppObj = args.opportunity_id ? memory.opportunities.get(args.opportunity_id) : undefined;
    const accObj = args.account_id ? memory.accounts.get(args.account_id) : undefined;
    const contextName = oppObj
      ? String(oppObj.nombre || 'Oportunidad')
      : accObj
      ? String(accObj.nombre || 'Cuenta')
      : 'Seguimiento Comercial';
    asuntoFinal = `${clasifObj?.nombre || 'Actividad'} - ${contextName}`;
  }

  const newId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newActivity = {
    id: newId,
    asunto: asuntoFinal,
    descripcion: args.descripcion || '',
    tipo_actividad: (args.tipo_actividad || clasifObj?.tipo || 'TAREA') as 'TAREA' | 'EVENTO',
    prioridad: args.prioridad || 'Media',
    clasificacion_id: clasificacionId,
    subclasificacion_id: args.subclasificacion_id ? Number(args.subclasificacion_id) : null,
    fecha_inicio: args.fecha_inicio || new Date().toISOString(),
    fecha_fin: args.fecha_fin || undefined,
    is_completed: false,
    opportunity_id: args.opportunity_id || undefined,
    account_id: args.account_id || undefined,
    user_id: args.user_id || ctx.userId,
    is_deleted: false,
    created_at: new Date().toISOString(),
  };

  memory.activities.set(newId, newActivity);

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: 'Actividad programada exitosamente',
          ...newActivity,
        }),
      },
    ],
  };
}

export async function crmActualizarActividad(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: { id: string; [key: string]: unknown }
): Promise<McpToolResult> {
  const memory = db.getMemory();
  const id = args.id;
  const act = memory.activities.get(id);

  if (!act) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Actividad no encontrada con ID: ${id}` }],
    };
  }

  if (!canAccessActivity(ctx, act)) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Acceso no autorizado para editar esta actividad.' }],
    };
  }

  const updated = {
    ...act,
    ...args,
    id: act.id,
    updated_at: new Date().toISOString(),
  };

  memory.activities.set(id, updated);

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: 'Actividad actualizada exitosamente',
          ...updated,
        }),
      },
    ],
  };
}

export async function crmRecuperarActividad(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: { id?: string }
): Promise<McpToolResult> {
  const memory = db.getMemory();
  const id = args.id;
  if (!id) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: El parámetro "id" es obligatorio.' }],
    };
  }
  const act = memory.activities.get(id);

  if (!act) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Actividad no encontrada con ID: ${id}` }],
    };
  }

  if (!canAccessActivity(ctx, act)) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Acceso no autorizado para recuperar esta actividad.' }],
    };
  }

  // Contrato de reapertura / desarchivado
  act.is_deleted = false;
  act.is_completed = false;
  act.updated_at = new Date().toISOString();
  memory.activities.set(id, act);

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: `Actividad "${act.asunto}" reabierta y restaurada a la agenda activa.`,
          id: act.id,
          is_completed: false,
          is_deleted: false,
        }),
      },
    ],
  };
}
