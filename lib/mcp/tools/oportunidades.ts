/**
 * Herramientas MCP para el Dominio de Oportunidades
 */
import { McpSessionContext, McpToolResult, CompactOpportunity } from '../types';
import { CrmDatabaseAdapter, FASES_POR_CANAL } from '../database';
import { canAccessOpportunity, normalizeRole } from '../permissions';

export async function crmBuscarOportunidades(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: {
    limit?: number;
    offset?: number;
    query?: string;
    canal_id?: string;
    fase_id?: number;
    incluir_archivadas?: boolean;
  }
): Promise<McpToolResult> {
  const limit = Math.min(Math.max(1, Number(args.limit || 10)), 30);
  const offset = Math.max(0, Number(args.offset || 0));
  const query = (args.query || '').toLowerCase();
  const canalFilter = args.canal_id;
  const faseFilter = args.fase_id ? Number(args.fase_id) : undefined;

  const memory = db.getMemory();
  const allOpps = Array.from(memory.opportunities.values());

  const filtered = allOpps.filter((opp) => {
    // Soft delete check
    if (opp.is_deleted && !args.incluir_archivadas) return false;

    // Aislamiento por rol
    if (!canAccessOpportunity(ctx, opp)) return false;

    // Filtros
    if (canalFilter && opp.canal_id !== canalFilter) return false;
    if (faseFilter && opp.fase_id !== faseFilter) return false;
    if (query && !String(opp.nombre || '').toLowerCase().includes(query)) return false;

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

  const newId = `opp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const ownerId =
    normalizeRole(ctx.role) === 'VENDEDOR'
      ? ctx.userId
      : args.owner_user_id || ctx.userId;

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
  const memory = db.getMemory();
  const id = args.id;
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
    id: opp.id, // ID inmutable
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
  const memory = db.getMemory();
  const id = args.id;
  const opp = id ? memory.opportunities.get(id) : undefined;

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

  // Contrato de recuperación determinista
  opp.is_deleted = false;
  opp.estado_id = 1; // Abierta / Activa
  opp.razon_perdida_id = null;
  opp.comentarios_perdida = null;
  opp.updated_at = new Date().toISOString();

  if (id) memory.opportunities.set(id, opp);

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
  const memory = db.getMemory();
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
