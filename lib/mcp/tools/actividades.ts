/**
 * Herramientas MCP para el Dominio de Actividades (Tareas, Eventos y Agenda)
 * Conexión en vivo con Supabase (CRM_Actividades) y fallback en memoria para tests.
 */
import { McpSessionContext, McpToolResult, CompactActivity } from '../types';
import { CrmDatabaseAdapter, CLASIFICACIONES_ACTIVIDAD } from '../database';
import { canAccessActivity, normalizeRole } from '../permissions';

interface ActivityRow {
  id: string;
  user_id?: string | null;
  opportunity_id?: string | null;
  account_id?: string | null;
  tipo_actividad?: 'TAREA' | 'EVENTO' | string | null;
  asunto?: string | null;
  descripcion?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  is_completed?: boolean | null;
  is_deleted?: boolean | null;
  prioridad?: 'Alta' | 'Media' | 'Baja' | string | null;
  clasificacion_id?: number | null;
  updated_at?: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

export async function crmAgendaDiaria(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: { limit?: number; offset?: number } = {}
): Promise<McpToolResult> {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const limit = Math.min(Math.max(1, Number(args.limit || 10)), 30);
  const offset = Math.max(0, Number(args.offset || 0));

  const supabase = db.getSupabase();
  if (supabase) {
    try {
      let q = supabase
        .from('CRM_Actividades')
        .select('id, user_id, opportunity_id, account_id, tipo_actividad, asunto, descripcion, fecha_inicio, fecha_fin, is_completed, is_deleted, prioridad, clasificacion_id')
        .or('is_deleted.is.null,is_deleted.eq.false');

      const role = normalizeRole(ctx.role);
      if (role === 'VENDEDOR' && isUuid(ctx.userId)) {
        q = q.eq('user_id', ctx.userId);
      }

      const { data, error } = await q;

      if (!error && data) {
        const pendientesHoy = (data as unknown as ActivityRow[]).filter((a) => {
          if (a.is_completed) return false;
          const fecha = String(a.fecha_inicio || '').split('T')[0];
          return fecha <= todayStr;
        });

        const completadasHoy = (data as unknown as ActivityRow[]).filter((a) => {
          if (!a.is_completed) return false;
          const fecha = String(a.updated_at || a.fecha_inicio || '').split('T')[0];
          return fecha === todayStr;
        });
        const totalCount = pendientesHoy.length;
        const pendientesPaginadas = pendientesHoy.slice(offset, offset + limit);

        return {
          isError: false,
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  fecha_consulta: todayStr,
                  usuario_id: ctx.userId,
                  origen: 'Supabase Live',
                  resumen: {
                    total_pendientes_o_vencidas: pendientesHoy.length,
                    total_completadas_hoy: completadasHoy.length,
                  },
                  total_count: totalCount,
                  limit,
                  offset,
                  has_more: offset + limit < totalCount,
                  pendientes: pendientesPaginadas.map((a: ActivityRow) => ({
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
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmAgendaDiaria:', err);
    }
  }

  // Fallback memoria
  const memory = db.getMemory();
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
  const totalCount = pendientesHoy.length;
  const pendientesPaginadas = pendientesHoy.slice(offset, offset + limit);

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
            total_count: totalCount,
            limit,
            offset,
            has_more: offset + limit < totalCount,
            pendientes: pendientesPaginadas.map((a) => ({
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
    oportunidad_id?: string;
    cuenta_id?: string;
    pendientes_solo?: boolean;
    incluir_archivadas?: boolean;
  }
): Promise<McpToolResult> {
  const limit = Math.min(Math.max(1, Number(args.limit || 10)), 30);
  const offset = Math.max(0, Number(args.offset || 0));

  const supabase = db.getSupabase();
  if (supabase) {
    try {
      let q = supabase
        .from('CRM_Actividades')
        .select('id, user_id, opportunity_id, account_id, tipo_actividad, asunto, descripcion, fecha_inicio, fecha_fin, is_completed, is_deleted, prioridad', { count: 'exact' });

      if (!args.incluir_archivadas) {
        q = q.or('is_deleted.is.null,is_deleted.eq.false');
      }

      if (args.pendientes_solo) {
        q = q.eq('is_completed', false);
      }

      if (args.oportunidad_id && isUuid(args.oportunidad_id)) {
        q = q.eq('opportunity_id', args.oportunidad_id);
      }

      if (args.cuenta_id && isUuid(args.cuenta_id)) {
        q = q.eq('account_id', args.cuenta_id);
      }

      const role = normalizeRole(ctx.role);
      if (role === 'VENDEDOR' && isUuid(ctx.userId)) {
        q = q.eq('user_id', ctx.userId);
      }

      q = q.order('fecha_inicio', { ascending: false, nullsFirst: false }).order('id', { ascending: false });
      q = q.range(offset, offset + limit - 1);

      const { data, count, error } = await q;

      if (!error && data) {
        const items: CompactActivity[] = (data as unknown as ActivityRow[]).map((act) => ({
          id: String(act.id),
          asunto: String(act.asunto || 'Sin asunto'),
          tipo_actividad: (act.tipo_actividad === 'EVENTO' ? 'EVENTO' : 'TAREA'),
          is_completed: Boolean(act.is_completed),
          fecha_inicio: String(act.fecha_inicio || ''),
          fecha_fin: act.fecha_fin ? String(act.fecha_fin) : undefined,
          prioridad: (act.prioridad as 'Alta' | 'Media' | 'Baja') || 'Media',
          user_id: act.user_id ? String(act.user_id) : undefined,
          opportunity_id: act.opportunity_id || undefined,
          account_id: act.account_id || undefined,
        }));

        const totalCount = count !== null ? count : items.length;

        return {
          isError: false,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                items,
                total_count: totalCount,
                limit,
                offset,
                has_more: offset + limit < totalCount,
              }),
            },
          ],
        };
      }
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmListarActividades:', err);
    }
  }

  // Fallback memoria
  const memory = db.getMemory();
  const allActs = Array.from(memory.activities.values());

  const filtered = allActs.filter((act) => {
    if (act.is_deleted && !args.incluir_archivadas) return false;
    if (!canAccessActivity(ctx, act)) return false;
    if (args.oportunidad_id && act.opportunity_id !== args.oportunidad_id) return false;
    if (args.cuenta_id && act.account_id !== args.cuenta_id) return false;
    if (args.pendientes_solo && act.is_completed) return false;
    return true;
  });

  const paged = filtered.slice(offset, offset + limit).map((act): CompactActivity => ({
    id: act.id,
    asunto: act.asunto,
    tipo_actividad: act.tipo_actividad || 'TAREA',
    is_completed: Boolean(act.is_completed),
    fecha_inicio: String(act.fecha_inicio || ''),
    fecha_fin: act.fecha_fin ? String(act.fecha_fin) : undefined,
    prioridad: act.prioridad,
    user_id: act.user_id,
    opportunity_id: act.opportunity_id,
    account_id: act.account_id,
  }));

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

  const supabase = db.getSupabase();
  if (supabase && isUuid(id)) {
    try {
      const { data: act, error } = await supabase
        .from('CRM_Actividades')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && act) {
        if (!canAccessActivity(ctx, { user_id: act.user_id })) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Acceso no autorizado: Esta actividad pertenece a otro usuario.' }],
          };
        }

        return {
          isError: false,
          content: [{ type: 'text', text: JSON.stringify(act, null, 2) }],
        };
      }
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmConsultarActividad:', err);
    }
  }

  // Fallback memoria
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
      content: [{ type: 'text', text: 'Acceso no autorizado: Esta actividad pertenece a otro usuario.' }],
    };
  }

  return {
    isError: false,
    content: [{ type: 'text', text: JSON.stringify(act, null, 2) }],
  };
}

export async function crmCrearActividad(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: {
    asunto?: string;
    tipo_actividad?: 'TAREA' | 'EVENTO' | string;
    clasificacion_id?: number;
    fecha_inicio?: string;
    fecha_fin?: string;
    opportunity_id?: string;
    account_id?: string;
    descripcion?: string;
    prioridad?: 'Alta' | 'Media' | 'Baja';
  }
): Promise<McpToolResult> {
  const clasificacion = CLASIFICACIONES_ACTIVIDAD.find(
    (c) => c.id === Number(args.clasificacion_id)
  );

  const asuntoFinal =
    args.asunto ||
    (clasificacion ? `${clasificacion.nombre} - Seguimiento` : 'Actividad comercial');

  const tipo =
    args.tipo_actividad ||
    clasificacion?.tipo ||
    'TAREA';

  const supabase = db.getSupabase();
  if (supabase) {
    try {
      const newRecord = {
        asunto: asuntoFinal,
        tipo_actividad: (tipo === 'EVENTO' ? 'EVENTO' : 'TAREA') as 'TAREA' | 'EVENTO',
        clasificacion_id: clasificacion ? clasificacion.id : null,
        user_id: isUuid(ctx.userId) ? ctx.userId : undefined,
        opportunity_id: isUuid(args.opportunity_id) ? args.opportunity_id : null,
        account_id: isUuid(args.account_id) ? args.account_id : null,
        descripcion: args.descripcion || '',
        prioridad: args.prioridad || 'Media',
        fecha_inicio: args.fecha_inicio || new Date().toISOString(),
        fecha_fin: args.fecha_fin || null,
        is_completed: false,
        is_deleted: false,
      };

      const { data: created, error } = await supabase
        .from('CRM_Actividades')
        .insert(newRecord)
        .select()
        .single();

      if (!error && created) {
        return {
          isError: false,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                mensaje: 'Actividad registrada exitosamente en Supabase',
                ...created,
              }),
            },
          ],
        };
      }
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmCrearActividad:', err);
    }
  }

  // Fallback memoria
  const memory = db.getMemory();
  const newId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newActivity = {
    id: newId,
    asunto: asuntoFinal,
    tipo_actividad: (tipo === 'EVENTO' ? 'EVENTO' : 'TAREA') as 'TAREA' | 'EVENTO',
    clasificacion_id: clasificacion ? clasificacion.id : undefined,
    user_id: ctx.userId,
    opportunity_id: args.opportunity_id,
    account_id: args.account_id,
    descripcion: args.descripcion || '',
    prioridad: args.prioridad || 'Media',
    fecha_inicio: args.fecha_inicio || new Date().toISOString(),
    fecha_fin: args.fecha_fin,
    is_completed: false,
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
          mensaje: 'Actividad registrada exitosamente',
          ...newActivity,
        }),
      },
    ],
  };
}

export async function crmActualizarActividad(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: { id: string; is_completed?: boolean; [key: string]: unknown }
): Promise<McpToolResult> {
  const id = args.id;
  if (!id) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: El parámetro "id" es obligatorio.' }],
    };
  }

  const supabase = db.getSupabase();
  if (supabase && isUuid(id)) {
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (args.asunto !== undefined) updateData.asunto = args.asunto;
      if (args.is_completed !== undefined) updateData.is_completed = args.is_completed;
      if (args.descripcion !== undefined) updateData.descripcion = args.descripcion;
      if (args.prioridad !== undefined) updateData.prioridad = args.prioridad;
      if (args.fecha_inicio !== undefined) updateData.fecha_inicio = args.fecha_inicio;
      if (args.fecha_fin !== undefined) updateData.fecha_fin = args.fecha_fin;

      const { data: updated, error } = await supabase
        .from('CRM_Actividades')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (!error && updated) {
        return {
          isError: false,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                mensaje: 'Actividad actualizada exitosamente en Supabase',
                ...updated,
              }),
            },
          ],
        };
      }
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmActualizarActividad:', err);
    }
  }

  // Fallback memoria
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
      content: [{ type: 'text', text: 'Acceso no autorizado: No puedes editar esta actividad.' }],
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
  const id = args.id;
  if (!id) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: El parámetro "id" es obligatorio.' }],
    };
  }

  const supabase = db.getSupabase();
  if (supabase && isUuid(id)) {
    try {
      const { data: updated, error } = await supabase
        .from('CRM_Actividades')
        .update({
          is_deleted: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id, asunto')
        .single();

      if (!error && updated) {
        return {
          isError: false,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                mensaje: `Actividad "${updated.asunto}" reabierta y restaurada exitosamente en Supabase.`,
                id: updated.id,
                is_deleted: false,
              }),
            },
          ],
        };
      }
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmRecuperarActividad:', err);
    }
  }

  // Fallback memoria
  const memory = db.getMemory();
  const act = id ? memory.activities.get(id) : undefined;

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

  act.is_deleted = false;
  act.updated_at = new Date().toISOString();
  if (id) memory.activities.set(id, act);

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: `Actividad "${act.asunto}" reabierta y restaurada exitosamente.`,
          id: act.id,
          is_deleted: false,
        }),
      },
    ],
  };
}
