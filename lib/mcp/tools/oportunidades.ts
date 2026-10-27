/**
 * Herramientas MCP para el Dominio de Oportunidades
 * Conexión en vivo con Supabase (CRM_Oportunidades) y fallback en memoria para tests.
 */
import { McpSessionContext, McpToolResult, CompactOpportunity } from '../types';
import { CrmDatabaseAdapter, FASES_POR_CANAL } from '../database';
import { canAccessOpportunity, normalizeRole } from '../permissions';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

export async function crmBuscarOportunidades(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: {
    limit?: number;
    offset?: number;
    query?: string;
    canal_id?: string;
    fase_id?: number;
    estado_id?: number;
    ordenar_por?: 'valor_desc' | 'valor_asc' | 'recientes' | 'antiguos';
    incluir_archivadas?: boolean;
  }
): Promise<McpToolResult> {
  const limit = Math.min(Math.max(1, Number(args.limit || 10)), 30);
  const offset = Math.max(0, Number(args.offset || 0));
  const query = (args.query || '').trim();
  const canalFilter = args.canal_id;
  const faseFilter = args.fase_id !== undefined ? Number(args.fase_id) : undefined;
  const estadoFilter = args.estado_id !== undefined ? Number(args.estado_id) : undefined;
  const ordenarPor = args.ordenar_por || 'valor_desc';

  const supabase = db.getSupabase();
  if (supabase) {
    try {
      let q = supabase
        .from('CRM_Oportunidades')
        .select(`
          id,
          nombre,
          amount,
          currency_id,
          fase_id,
          estado_id,
          fecha_cierre_estimada,
          probability,
          owner_user_id,
          origen_oportunidad,
          account_id,
          is_deleted,
          created_at,
          cuenta:CRM_Cuentas!account_id(id, nombre, nit, canal_id),
          fase:CRM_FasesOportunidad!fase_id(id, nombre, canal_id),
          estado:CRM_EstadosOportunidad!estado_id(id, nombre),
          vendedor:CRM_Usuarios!owner_user_id(id, full_name, email)
        `, { count: 'exact' });

      // Archivadas / Soft-deleted
      if (!args.incluir_archivadas) {
        q = q.or('is_deleted.is.null,is_deleted.eq.false');
      }

      // Aislamiento por rol
      const role = normalizeRole(ctx.role);
      if (role === 'VENDEDOR' && isUuid(ctx.userId)) {
        q = q.eq('owner_user_id', ctx.userId);
      }

      // Filtro por estado
      if (estadoFilter !== undefined && !isNaN(estadoFilter)) {
        q = q.eq('estado_id', estadoFilter);
      }

      // Filtro por fase
      if (faseFilter !== undefined && !isNaN(faseFilter)) {
        q = q.eq('fase_id', faseFilter);
      }

      // Búsqueda por texto (en nombre de oportunidad)
      if (query) {
        q = q.ilike('nombre', `%${query}%`);
      }

      // Ordenamiento
      if (ordenarPor === 'valor_desc') {
        q = q.order('amount', { ascending: false, nullsFirst: false });
      } else if (ordenarPor === 'valor_asc') {
        q = q.order('amount', { ascending: true, nullsFirst: false });
      } else if (ordenarPor === 'antiguos') {
        q = q.order('created_at', { ascending: true, nullsFirst: false });
      } else {
        q = q.order('created_at', { ascending: false, nullsFirst: false });
      }

      // Paginación
      q = q.range(offset, offset + limit - 1);

      const { data, count, error } = await q;

      if (!error && data) {
        let rows = data as any[];
        if (canalFilter) {
          rows = rows.filter((r) => {
            const rowCanal = r.cuenta?.canal_id || r.fase?.canal_id;
            return rowCanal === canalFilter;
          });
        }

        const items: CompactOpportunity[] = rows.map((opp) => ({
          id: String(opp.id),
          nombre: String(opp.nombre || 'Sin nombre'),
          cuenta_id: String(opp.account_id || ''),
          cuenta_nombre: opp.cuenta?.nombre || 'Desconocida',
          canal_id: opp.cuenta?.canal_id || opp.fase?.canal_id || 'OBRAS_NAC',
          fase_id: Number(opp.fase_id || 0),
          fase_nombre: opp.fase?.nombre || undefined,
          estado_id: Number(opp.estado_id || 1),
          estado_nombre: opp.estado?.nombre || undefined,
          valor: Number(opp.amount || 0),
          fecha_cierre: opp.fecha_cierre_estimada || undefined,
          owner_user_id: opp.owner_user_id ? String(opp.owner_user_id) : undefined,
          owner_nombre: opp.vendedor?.full_name || opp.vendedor?.email || undefined,
          probability: opp.probability !== undefined && opp.probability !== null ? Number(opp.probability) : undefined,
          origen_oportunidad: opp.origen_oportunidad ? String(opp.origen_oportunidad) : null,
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
      } else if (error) {
        console.warn('[CRM-MCP] Error en Supabase crmBuscarOportunidades:', error);
      }
    } catch (err) {
      console.warn('[CRM-MCP] Falló consulta Supabase crmBuscarOportunidades:', err);
    }
  }

  // Fallback a almacenamiento en memoria
  const memory = db.getMemory();
  const allOpps = Array.from(memory.opportunities.values());

  const filtered = allOpps.filter((opp) => {
    if (opp.is_deleted && !args.incluir_archivadas) return false;
    if (!canAccessOpportunity(ctx, opp)) return false;
    if (canalFilter && opp.canal_id !== canalFilter) return false;
    if (faseFilter && opp.fase_id !== faseFilter) return false;
    if (estadoFilter !== undefined && opp.estado_id !== estadoFilter) return false;
    if (query && !String(opp.nombre || '').toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const paged = filtered.slice(offset, offset + limit).map((opp): CompactOpportunity => ({
    id: String(opp.id),
    nombre: String(opp.nombre),
    cuenta_id: String(opp.account_id),
    canal_id: String(opp.canal_id),
    fase_id: Number(opp.fase_id),
    valor: Number(opp.valor || 0),
    fecha_cierre: opp.fecha_cierre ? String(opp.fecha_cierre) : undefined,
    owner_user_id: opp.owner_user_id ? String(opp.owner_user_id) : undefined,
    probability: opp.probability ? Number(opp.probability) : undefined,
    origen_oportunidad: opp.origen_oportunidad ? String(opp.origen_oportunidad) : null,
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

export async function crmConsultarOportunidad(
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
      const { data, error } = await supabase
        .from('CRM_Oportunidades')
        .select(`
          *,
          cuenta:CRM_Cuentas!account_id(id, nombre, nit, canal_id, telefono, email, direccion, ciudad),
          fase:CRM_FasesOportunidad!fase_id(id, nombre, canal_id),
          estado:CRM_EstadosOportunidad!estado_id(id, nombre),
          vendedor:CRM_Usuarios!owner_user_id(id, full_name, email)
        `)
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        if (!canAccessOpportunity(ctx, { owner_user_id: data.owner_user_id })) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Acceso no autorizado: No tienes permisos para ver esta oportunidad.' }],
          };
        }

        return {
          isError: false,
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: data.id,
                  nombre: data.nombre,
                  valor: Number(data.amount || 0),
                  monto: Number(data.amount || 0),
                  currency: data.currency_id || 'COP',
                  estado_id: data.estado_id,
                  estado_nombre: data.estado?.nombre,
                  fase_id: data.fase_id,
                  fase_nombre: data.fase?.nombre,
                  canal_id: data.cuenta?.canal_id || data.fase?.canal_id,
                  account_id: data.account_id,
                  cuenta_nombre: data.cuenta?.nombre || 'Desconocida',
                  nit_cuenta: data.cuenta?.nit,
                  owner_user_id: data.owner_user_id,
                  owner_nombre: data.vendedor?.full_name || data.vendedor?.email,
                  probability: data.probability,
                  fecha_cierre: data.fecha_cierre_estimada,
                  origen_oportunidad: data.origen_oportunidad,
                  categoria_oportunidad: data.categoria_oportunidad,
                  clientes_atendidos: data.clientes_atendidos,
                  razon_perdida_id: data.razon_perdida_id,
                  razon_perdida: data.razon_perdida,
                  comentarios_perdida: data.comentarios_perdida,
                  comentarios: data.comentarios,
                  is_deleted: data.is_deleted || false,
                  created_at: data.created_at,
                  updated_at: data.updated_at,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmConsultarOportunidad:', err);
    }
  }

  // Fallback a memoria
  const memory = db.getMemory();
  const opp = memory.opportunities.get(id);

  if (!opp) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Oportunidad no encontrada con ID: ${id}` }],
    };
  }

  if (!canAccessOpportunity(ctx, opp)) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Acceso no autorizado: No tienes permisos para ver esta oportunidad.' }],
    };
  }

  const account = opp.account_id ? memory.accounts.get(String(opp.account_id)) : undefined;

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            ...opp,
            cuenta_nombre: account?.nombre || 'Desconocida',
            nit_cuenta: account?.nit,
          },
          null,
          2
        ),
      },
    ],
  };
}

export async function crmCrearOportunidad(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: {
    nombre?: string;
    cuenta_id?: string;
    canal_id?: string;
    fase_id?: number | string;
    valor?: number;
    monto?: number;
    probability?: number;
    fecha_cierre?: string;
    owner_user_id?: string;
    categoria_oportunidad?: string;
    contactos_ids?: string[];
    clientes_atendidos?: number;
    origen_oportunidad?: string;
    comentarios?: string;
    idempotency_key?: string;
  }
): Promise<McpToolResult> {
  const memory = db.getMemory();

  // Control de idempotencia
  if (args.idempotency_key) {
    const existing = memory.idempotency.get(args.idempotency_key);
    if (existing) {
      return {
        isError: false,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...existing,
              idempotent_replay: true,
              mensaje: 'Oportunidad devuelta por clave de idempotencia previa.',
            }),
          },
        ],
      };
    }
  }

  const canalId = args.canal_id || 'OBRAS_NAC';
  const fasesValidas = FASES_POR_CANAL[canalId] || [];

  // Validación auto-correctiva de fase
  const faseEncontrada = fasesValidas.find((f) => f.id === Number(args.fase_id));
  if (!faseEncontrada) {
    const fasesDisponiblesMsg = fasesValidas.map((f) => `ID ${f.id} (${f.nombre})`).join(', ');
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error: La fase ID ${args.fase_id} es inválida para el canal ${canalId}. Fases disponibles para este canal: [${fasesDisponiblesMsg}]. Por favor seleccione una fase válida.`,
        },
      ],
    };
  }

  const ownerId =
    normalizeRole(ctx.role) === 'VENDEDOR'
      ? ctx.userId
      : args.owner_user_id || ctx.userId;

  const supabase = db.getSupabase();
  if (supabase && isUuid(args.cuenta_id)) {
    try {
      const newRecord = {
        nombre: args.nombre || 'Nueva Oportunidad',
        account_id: args.cuenta_id,
        fase_id: faseEncontrada.id,
        estado_id: 1, // Abierta
        amount: Number(args.valor || args.monto || 0),
        currency_id: 'COP',
        probability: args.probability !== undefined ? Number(args.probability) : faseEncontrada.probability,
        fecha_cierre_estimada: args.fecha_cierre || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        owner_user_id: isUuid(ownerId) ? ownerId : (isUuid(ctx.userId) ? ctx.userId : undefined),
        created_by: isUuid(ctx.userId) ? ctx.userId : undefined,
        categoria_oportunidad: args.categoria_oportunidad || null,
        contactos_ids: args.contactos_ids || [],
        clientes_atendidos: args.clientes_atendidos || 1,
        origen_oportunidad: args.origen_oportunidad || 'Prospección Directa (Outbound)',
        comentarios: args.comentarios || '',
        is_deleted: false,
      };

      const { data, error } = await supabase
        .from('CRM_Oportunidades')
        .insert(newRecord)
        .select()
        .single();

      if (!error && data) {
        if (args.idempotency_key) {
          memory.idempotency.set(args.idempotency_key, data);
        }
        return {
          isError: false,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                mensaje: 'Oportunidad creada exitosamente en Supabase',
                ...data,
              }),
            },
          ],
        };
      } else if (error) {
        console.warn('[CRM-MCP] Error insertando oportunidad en Supabase:', error);
      }
    } catch (err) {
      console.warn('[CRM-MCP] Falló insert Supabase crmCrearOportunidad:', err);
    }
  }

  // Fallback en memoria
  const newId = `opp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newOpp = {
    id: newId,
    nombre: args.nombre || 'Nueva Oportunidad',
    account_id: args.cuenta_id,
    canal_id: canalId,
    fase_id: faseEncontrada.id,
    estado_id: 1, // Abierta
    valor: Number(args.valor || args.monto || 0),
    probability: args.probability !== undefined ? Number(args.probability) : faseEncontrada.probability,
    fecha_cierre: args.fecha_cierre || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    owner_user_id: ownerId,
    categoria_oportunidad: args.categoria_oportunidad || null,
    contactos_ids: args.contactos_ids || [],
    clientes_atendidos: args.clientes_atendidos || 1,
    origen_oportunidad: args.origen_oportunidad || 'Prospección Directa (Outbound)',
    comentarios: args.comentarios || '',
    is_deleted: false,
    created_at: new Date().toISOString(),
  };

  memory.opportunities.set(newId, newOpp);

  if (args.idempotency_key) {
    memory.idempotency.set(args.idempotency_key, newOpp);
  }

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: 'Oportunidad creada exitosamente',
          ...newOpp,
        }),
      },
    ],
  };
}

export async function crmActualizarOportunidad(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: { id: string; estado_id?: number; razon_perdida_id?: number; [key: string]: unknown }
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
      const { data: existing, error: getErr } = await supabase
        .from('CRM_Oportunidades')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!getErr && existing) {
        if (!canAccessOpportunity(ctx, { owner_user_id: existing.owner_user_id })) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Acceso no autorizado: No puedes editar esta oportunidad.' }],
          };
        }

        // Validación de cierre perdido
        if (args.estado_id === 2 && !args.razon_perdida_id && !existing.razon_perdida_id) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: 'Error de validación: Para marcar una oportunidad como Perdida se requiere obligatoriamente "razon_perdida_id" y comentarios explicativos.',
              },
            ],
          };
        }

        const updatePayload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (args.nombre !== undefined) updatePayload.nombre = args.nombre;
        if (args.valor !== undefined || args.monto !== undefined) {
          updatePayload.amount = Number(args.valor !== undefined ? args.valor : args.monto);
        }
        if (args.fase_id !== undefined) updatePayload.fase_id = Number(args.fase_id);
        if (args.estado_id !== undefined) updatePayload.estado_id = Number(args.estado_id);
        if (args.razon_perdida_id !== undefined) updatePayload.razon_perdida_id = Number(args.razon_perdida_id);
        if (args.comentarios_perdida !== undefined) updatePayload.comentarios_perdida = args.comentarios_perdida;
        if (args.fecha_cierre !== undefined) updatePayload.fecha_cierre_estimada = args.fecha_cierre;
        if (args.comentarios !== undefined) updatePayload.comentarios = args.comentarios;

        const { data: updated, error: updErr } = await supabase
          .from('CRM_Oportunidades')
          .update(updatePayload)
          .eq('id', id)
          .select()
          .single();

        if (!updErr && updated) {
          return {
            isError: false,
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  mensaje: 'Oportunidad actualizada exitosamente en Supabase',
                  ...updated,
                }),
              },
            ],
          };
        }
      }
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmActualizarOportunidad:', err);
    }
  }

  // Fallback memoria
  const memory = db.getMemory();
  const opp = memory.opportunities.get(id);

  if (!opp) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Oportunidad no encontrada con ID: ${id}` }],
    };
  }

  if (!canAccessOpportunity(ctx, opp)) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Acceso no autorizado: No puedes editar esta oportunidad.' }],
    };
  }

  // Validación de cierre perdido
  if (args.estado_id === 2 && !args.razon_perdida_id && !opp.razon_perdida_id) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Error de validación: Para marcar una oportunidad como Perdida se requiere obligatoriamente "razon_perdida_id" y comentarios explicativos.',
        },
      ],
    };
  }

  const updated = {
    ...opp,
    ...args,
    id: opp.id,
    updated_at: new Date().toISOString(),
  };

  memory.opportunities.set(id, updated);

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: 'Oportunidad actualizada exitosamente',
          ...updated,
        }),
      },
    ],
  };
}

export async function crmRecuperarOportunidad(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: { id?: string; fase_id?: number }
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
      const { data: opp, error } = await supabase
        .from('CRM_Oportunidades')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && opp) {
        if (!canAccessOpportunity(ctx, { owner_user_id: opp.owner_user_id })) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Acceso no autorizado para recuperar esta oportunidad.' }],
          };
        }

        const updateData: Record<string, unknown> = {
          is_deleted: false,
          estado_id: 1, // Abierta / Activa
          razon_perdida_id: null,
          razon_perdida: null,
          comentarios_perdida: null,
          updated_at: new Date().toISOString(),
        };
        if (args.fase_id) updateData.fase_id = Number(args.fase_id);

        const { data: updated, error: updErr } = await supabase
          .from('CRM_Oportunidades')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (!updErr && updated) {
          return {
            isError: false,
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  mensaje: 'Oportunidad recuperada exitosamente y restaurada al pipeline activo en Supabase.',
                  id: updated.id,
                  nombre: updated.nombre,
                  fase_id: updated.fase_id,
                  estado_id: updated.estado_id,
                  is_deleted: false,
                }),
              },
            ],
          };
        }
      }
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmRecuperarOportunidad:', err);
    }
  }

  // Fallback memoria
  const memory = db.getMemory();
  const opp = memory.opportunities.get(id);

  if (!opp) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Oportunidad no encontrada con ID: ${id}` }],
    };
  }

  if (!canAccessOpportunity(ctx, opp)) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Acceso no autorizado para recuperar esta oportunidad.' }],
    };
  }

  opp.is_deleted = false;
  opp.estado_id = 1;
  opp.razon_perdida_id = null;
  opp.comentarios_perdida = null;
  opp.updated_at = new Date().toISOString();
  if (args.fase_id) opp.fase_id = Number(args.fase_id);

  memory.opportunities.set(id, opp);

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: 'Oportunidad recuperada exitosamente y restaurada al pipeline activo.',
          id: opp.id,
          nombre: opp.nombre,
          fase_id: opp.fase_id,
          estado_id: opp.estado_id,
          is_deleted: false,
        }),
      },
    ],
  };
}

export async function crmReasignarOportunidad(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: { id?: string; nuevo_propietario_id?: string }
): Promise<McpToolResult> {
  const id = args.id;
  const nuevoOwnerId = args.nuevo_propietario_id;

  if (!id) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: El parámetro "id" es obligatorio.' }],
    };
  }

  if (!nuevoOwnerId) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: Se requiere "nuevo_propietario_id" para reasignar.' }],
    };
  }

  const supabase = db.getSupabase();
  if (supabase && isUuid(id) && isUuid(nuevoOwnerId)) {
    try {
      const { data, error } = await supabase
        .from('CRM_Oportunidades')
        .update({
          owner_user_id: nuevoOwnerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id, nombre, owner_user_id')
        .maybeSingle();

      if (!error && data) {
        return {
          isError: false,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                mensaje: `Oportunidad ${data.nombre} reasignada exitosamente en Supabase al usuario ${nuevoOwnerId}`,
                id: data.id,
                nuevo_owner_user_id: data.owner_user_id,
              }),
            },
          ],
        };
      }
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmReasignarOportunidad:', err);
    }
  }

  // Fallback memoria
  const memory = db.getMemory();
  const opp = memory.opportunities.get(id);
  if (!opp) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Oportunidad no encontrada con ID: ${id}` }],
    };
  }

  opp.owner_user_id = nuevoOwnerId;
  opp.updated_at = new Date().toISOString();
  memory.opportunities.set(id, opp);

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: `Oportunidad ${opp.nombre} reasignada exitosamente al usuario ${nuevoOwnerId}`,
          id: opp.id,
          nuevo_owner_user_id: nuevoOwnerId,
        }),
      },
    ],
  };
}
