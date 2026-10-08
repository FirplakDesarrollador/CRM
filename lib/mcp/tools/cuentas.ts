/**
 * Herramientas MCP para el Dominio de Cuentas (Clientes / Empresas)
 */
import { McpSessionContext, McpToolResult, CompactAccount } from '../types';
import { CrmDatabaseAdapter, CANALES_REFERENCIA } from '../database';

function generarNitProvisional(): string {
  const chars = '0123456789ABCDEF';
  let rand = '';
  for (let i = 0; i < 8; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return `PROV-${rand}`;
}

export async function crmBuscarCuentas(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: {
    limit?: number;
    offset?: number;
    query?: string;
    canal_id?: string;
    incluir_archivadas?: boolean;
  }
): Promise<McpToolResult> {
  const limit = Math.min(Math.max(1, Number(args.limit || 10)), 30);
  const offset = Math.max(0, Number(args.offset || 0));
  const query = (args.query || '').toLowerCase();
  const canalFilter = args.canal_id;

  const memory = db.getMemory();
  const allAccounts = Array.from(memory.accounts.values());

  const filtered = allAccounts.filter((acc) => {
    if (acc.is_deleted && !args.incluir_archivadas) return false;
    if (canalFilter && acc.canal_id !== canalFilter) return false;
    if (query) {
      const nombreAcc = String(acc.nombre || '').toLowerCase();
      const nitAcc = String(acc.nit || '').toLowerCase();
      if (!nombreAcc.includes(query) && !nitAcc.includes(query)) {
        return false;
      }
    }
    return true;
  });

  const paged = filtered.slice(offset, offset + limit).map((acc): CompactAccount => ({
    id: acc.id,
    nombre: acc.nombre,
    nit: acc.nit || '',
    canal_id: acc.canal_id || '',
    ciudad: acc.ciudad,
    nivel_premium: acc.nivel_premium,
    owner_user_id: acc.owner_user_id,
    telefono: acc.telefono,
    email: acc.email,
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

export async function crmConsultarCuenta(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: { id?: string; nit?: string }
): Promise<McpToolResult> {
  const id = args.id;
  const nit = args.nit;

  const memory = db.getMemory();
  let account: Record<string, unknown> | undefined = undefined;

  if (id) {
    account = memory.accounts.get(id);
  } else if (nit) {
    account = Array.from(memory.accounts.values()).find((a) => a.nit === nit);
  }

  if (!account) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Cuenta no encontrada con identificador proporcionado.` }],
    };
  }

  // Obtener contactos y oportunidades vinculadas
  const contacts = Array.from(memory.contacts.values()).filter(
    (c) => c.account_id === account?.id && !c.is_deleted
  );
  const opportunities = Array.from(memory.opportunities.values()).filter(
    (o) => o.account_id === account?.id && !o.is_deleted
  );

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            ...account,
            contactos_asociados: contacts.map((c) => ({
              id: c.id,
              nombre: `${c.nombre} ${c.apellido || ''}`.trim(),
              cargo: c.cargo,
              telefono: c.telefono,
              email: c.email,
              es_principal: c.es_principal,
            })),
            oportunidades_activas: opportunities.map((o) => ({
              id: o.id,
              nombre: o.nombre,
              fase_id: o.fase_id,
              valor: o.valor,
              probability: o.probability,
            })),
          },
          null,
          2
        ),
      },
    ],
  };
}

export async function crmCrearCuenta(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: {
    nombre?: string;
    canal_id?: string;
    nit?: string;
    ciudad?: string;
    direccion?: string;
    telefono?: string;
    email?: string;
    nivel_premium?: 'PREMIUM' | 'DESTACADO' | 'ACTIVO' | null;
    origen_cuenta?: string;
    owner_user_id?: string;
    comentarios?: string;
  }
): Promise<McpToolResult> {
  const memory = db.getMemory();

  if (!args.nombre) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: El nombre de la cuenta es obligatorio.' }],
    };
  }

  // Canal obligatorio
  const canalId = args.canal_id;
  if (!canalId) {
    const canalesList = CANALES_REFERENCIA.map((c) => c.id).join(', ');
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error de validación: "canal_id" es obligatorio para crear una cuenta. Canales válidos: [${canalesList}].`,
        },
      ],
    };
  }

  // Nit o provisorio
  const nitFinal = args.nit ? String(args.nit).trim() : generarNitProvisional();

  // Validación de duplicados por NIT
  const existe = Array.from(memory.accounts.values()).find(
    (a) => a.nit === nitFinal && !a.is_deleted
  );
  if (existe) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error: Ya existe una cuenta registrada con el NIT ${nitFinal}: "${existe.nombre}" (ID: ${existe.id}).`,
        },
      ],
    };
  }

  const newId = `acc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newAccount = {
    id: newId,
    nombre: args.nombre,
    nit: nitFinal,
    canal_id: canalId,
    ciudad: args.ciudad || 'No especificada',
    direccion: args.direccion || '',
    telefono: args.telefono || '',
    email: args.email || '',
    nivel_premium: args.nivel_premium || null,
    origen_cuenta: args.origen_cuenta || 'MCP Agent',
    owner_user_id: args.owner_user_id || ctx.userId,
    comentarios: args.comentarios || '',
    is_deleted: false,
    activo: true,
    created_at: new Date().toISOString(),
  };

  memory.accounts.set(newId, newAccount);

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: 'Cuenta creada exitosamente',
          ...newAccount,
        }),
      },
    ],
  };
}

export async function crmActualizarCuenta(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: { id: string; [key: string]: unknown }
): Promise<McpToolResult> {
  const memory = db.getMemory();
  const id = args.id;
  const account = memory.accounts.get(id);

  if (!account) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Cuenta no encontrada con ID: ${id}` }],
    };
  }

  const updated = {
    ...account,
    ...args,
    id: account.id,
    updated_at: new Date().toISOString(),
  };

  memory.accounts.set(id, updated);

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: 'Cuenta actualizada exitosamente',
          ...updated,
        }),
      },
    ],
  };
}

export async function crmRecuperarCuenta(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: { id?: string }
): Promise<McpToolResult> {
  const memory = db.getMemory();
  const id = args.id;
  const account = id ? memory.accounts.get(id) : undefined;

  if (!account) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Cuenta no encontrada con ID: ${id}` }],
    };
  }

  account.is_deleted = false;
  account.activo = true;
  account.updated_at = new Date().toISOString();
  if (id) memory.accounts.set(id, account);

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: `Cuenta "${account.nombre}" recuperada y reactivada exitosamente.`,
          id: account.id,
          activo: true,
          is_deleted: false,
        }),
      },
    ],
  };
}

export async function crmReasignarCuentaCascada(
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
      content: [{ type: 'text', text: 'Error: Se requiere "nuevo_propietario_id" para la reasignación.' }],
    };
  }

  const account = memory.accounts.get(id);
  if (!account) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Cuenta no encontrada con ID: ${id}` }],
    };
  }

  account.owner_user_id = nuevoOwnerId;
  account.updated_at = new Date().toISOString();
  memory.accounts.set(id, account);

  // Reasignación en cascada de sus oportunidades vinculadas
  let oppsReassigned = 0;
  for (const opp of memory.opportunities.values()) {
    if (opp.account_id === id && !opp.is_deleted) {
      opp.owner_user_id = nuevoOwnerId;
      opp.updated_at = new Date().toISOString();
      oppsReassigned++;
    }
  }

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: `Cuenta "${account.nombre}" y ${oppsReassigned} oportunidades vinculadas reasignadas al usuario ${nuevoOwnerId}.`,
          cuenta_id: account.id,
          nuevo_propietario_id: nuevoOwnerId,
          oportunidades_reasignadas: oppsReassigned,
        }),
      },
    ],
  };
}
