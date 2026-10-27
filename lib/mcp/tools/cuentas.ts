/**
 * Herramientas MCP para el Dominio de Cuentas (Clientes / Empresas)
 * Conexión en vivo con Supabase (CRM_Cuentas) y fallback en memoria para tests.
 */
import { McpSessionContext, McpToolResult, CompactAccount } from '../types';
import { CrmDatabaseAdapter, CANALES_REFERENCIA } from '../database';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

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
  const query = (args.query || '').trim();
  const canalFilter = args.canal_id;

  const supabase = db.getSupabase();
  if (supabase) {
    try {
      let q = supabase
        .from('CRM_Cuentas')
        .select('id, nombre, nit, nit_base, canal_id, ciudad, direccion, telefono, email, nivel_premium, owner_user_id, is_deleted', { count: 'exact' });

      if (!args.incluir_archivadas) {
        q = q.or('is_deleted.is.null,is_deleted.eq.false');
      }

      if (canalFilter) {
        q = q.eq('canal_id', canalFilter);
      }

      if (query) {
        q = q.or(`nombre.ilike.%${query}%,nit_base.ilike.%${query}%`);
      }

      q = q.order('nombre', { ascending: true });
      q = q.range(offset, offset + limit - 1);

      const { data, count, error } = await q;

      if (!error && data) {
        const items: CompactAccount[] = data.map((acc: any) => ({
          id: String(acc.id),
          nombre: String(acc.nombre || 'Sin nombre'),
          nit: acc.nit_base || (acc.nit !== null && acc.nit !== undefined ? String(acc.nit) : ''),
          canal_id: acc.canal_id || '',
          ciudad: acc.ciudad || undefined,
          nivel_premium: acc.nivel_premium || undefined,
          owner_user_id: acc.owner_user_id ? String(acc.owner_user_id) : undefined,
          telefono: acc.telefono || undefined,
          email: acc.email || undefined,
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
        console.warn('[CRM-MCP] Error en Supabase crmBuscarCuentas:', error);
      }
    } catch (err) {
      console.warn('[CRM-MCP] Falló consulta Supabase crmBuscarCuentas:', err);
    }
  }

  // Fallback memoria
  const memory = db.getMemory();
  const allAccounts = Array.from(memory.accounts.values());

  const filtered = allAccounts.filter((acc) => {
    if (acc.is_deleted && !args.incluir_archivadas) return false;
    if (canalFilter && acc.canal_id !== canalFilter) return false;
    if (query) {
      const nombreAcc = String(acc.nombre || '').toLowerCase();
      const nitAcc = String(acc.nit || '').toLowerCase();
      if (!nombreAcc.includes(query.toLowerCase()) && !nitAcc.includes(query.toLowerCase())) {
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

  const supabase = db.getSupabase();
  if (supabase && ((id && isUuid(id)) || nit)) {
    try {
      let q = supabase.from('CRM_Cuentas').select('*');
      if (id && isUuid(id)) {
        q = q.eq('id', id);
      } else if (nit) {
        q = q.or(`nit_base.eq.${nit},nit.eq.${nit}`);
      }

      const { data: account, error } = await q.maybeSingle();

      if (!error && account) {
        const { data: contacts } = await supabase
          .from('CRM_Contactos')
          .select('id, nombre, cargo, telefono, email, es_principal')
          .eq('account_id', account.id)
          .or('is_deleted.is.null,is_deleted.eq.false');

        const { data: opportunities } = await supabase
          .from('CRM_Oportunidades')
          .select('id, nombre, fase_id, amount, probability')
          .eq('account_id', account.id)
          .or('is_deleted.is.null,is_deleted.eq.false');

        return {
          isError: false,
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: account.id,
                  nombre: account.nombre,
                  nit: account.nit_base || (account.nit ? String(account.nit) : ''),
                  canal_id: account.canal_id,
                  ciudad: account.ciudad,
                  direccion: account.direccion,
                  telefono: account.telefono,
                  email: account.email,
                  nivel_premium: account.nivel_premium,
                  origen_cuenta: account.origen_cuenta,
                  owner_user_id: account.owner_user_id,
                  comentarios: account.comentarios,
                  is_deleted: account.is_deleted || false,
                  created_at: account.created_at,
                  contactos_asociados: (contacts || []).map((c: any) => ({
                    id: c.id,
                    nombre: c.nombre,
                    cargo: c.cargo,
                    telefono: c.telefono,
                    email: c.email,
                    es_principal: c.es_principal,
                  })),
                  oportunidades_activas: (opportunities || []).map((o: any) => ({
                    id: o.id,
                    nombre: o.nombre,
                    fase_id: o.fase_id,
                    valor: Number(o.amount || 0),
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
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmConsultarCuenta:', err);
    }
  }

  // Fallback memoria
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
      content: [{ type: 'text', text: 'Cuenta no encontrada con identificador proporcionado.' }],
    };
  }

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

  const nitFinal = args.nit ? String(args.nit).trim() : generarNitProvisional();

  const supabase = db.getSupabase();
  if (supabase) {
    try {
      const { data: existe } = await supabase
        .from('CRM_Cuentas')
        .select('id, nombre, nit_base')
        .or(`nit_base.eq.${nitFinal},nombre.ilike.${args.nombre}`)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .maybeSingle();

      if (existe) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error: Ya existe una cuenta registrada con identificación similar: "${existe.nombre}" (ID: ${existe.id}).`,
            },
          ],
        };
      }

      const newAccountRecord = {
        nombre: args.nombre,
        nit_base: nitFinal,
        canal_id: canalId,
        ciudad: args.ciudad || 'No especificada',
        direccion: args.direccion || '',
        telefono: args.telefono || '',
        email: args.email || '',
        nivel_premium: args.nivel_premium || null,
        origen_cuenta: args.origen_cuenta || 'MCP Agent',
        owner_user_id: isUuid(args.owner_user_id) ? args.owner_user_id : (isUuid(ctx.userId) ? ctx.userId : undefined),
        comentarios: args.comentarios || '',
        is_deleted: false,
      };

      const { data: created, error } = await supabase
        .from('CRM_Cuentas')
        .insert(newAccountRecord)
        .select()
        .single();

      if (!error && created) {
        return {
          isError: false,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                mensaje: 'Cuenta creada exitosamente en Supabase',
                ...created,
              }),
            },
          ],
        };
      }
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmCrearCuenta:', err);
    }
  }

  // Fallback memoria
  const existeMem = Array.from(memory.accounts.values()).find(
    (a) => a.nit === nitFinal && !a.is_deleted
  );
  if (existeMem) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error: Ya existe una cuenta registrada con el NIT ${nitFinal}: "${existeMem.nombre}" (ID: ${existeMem.id}).`,
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
      if (args.nombre !== undefined) updateData.nombre = args.nombre;
      if (args.canal_id !== undefined) updateData.canal_id = args.canal_id;
      if (args.ciudad !== undefined) updateData.ciudad = args.ciudad;
      if (args.direccion !== undefined) updateData.direccion = args.direccion;
      if (args.telefono !== undefined) updateData.telefono = args.telefono;
      if (args.email !== undefined) updateData.email = args.email;
      if (args.comentarios !== undefined) updateData.comentarios = args.comentarios;
      if (args.nivel_premium !== undefined) updateData.nivel_premium = args.nivel_premium;

      const { data: updated, error } = await supabase
        .from('CRM_Cuentas')
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
                mensaje: 'Cuenta actualizada exitosamente en Supabase',
                ...updated,
              }),
            },
          ],
        };
      }
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmActualizarCuenta:', err);
    }
  }

  // Fallback memoria
  const memory = db.getMemory();
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
        .from('CRM_Cuentas')
        .update({
          is_deleted: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id, nombre')
        .single();

      if (!error && updated) {
        return {
          isError: false,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                mensaje: `Cuenta "${updated.nombre}" recuperada y reactivada exitosamente en Supabase.`,
                id: updated.id,
                is_deleted: false,
              }),
            },
          ],
        };
      }
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmRecuperarCuenta:', err);
    }
  }

  // Fallback memoria
  const memory = db.getMemory();
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

  const supabase = db.getSupabase();
  if (supabase && isUuid(id) && isUuid(nuevoOwnerId)) {
    try {
      // 1. Reasignar cuenta
      const { data: account, error: accErr } = await supabase
        .from('CRM_Cuentas')
        .update({
          owner_user_id: nuevoOwnerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id, nombre')
        .single();

      if (!accErr && account) {
        // 2. Reasignar oportunidades vinculadas en cascada
        const { data: oppsUpdated } = await supabase
          .from('CRM_Oportunidades')
          .update({
            owner_user_id: nuevoOwnerId,
            updated_at: new Date().toISOString(),
          })
          .eq('account_id', id)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .select('id');

        const reasigCount = oppsUpdated?.length || 0;

        return {
          isError: false,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                mensaje: `Cuenta "${account.nombre}" y ${reasigCount} oportunidades vinculadas reasignadas en Supabase al usuario ${nuevoOwnerId}.`,
                cuenta_id: account.id,
                nuevo_propietario_id: nuevoOwnerId,
                oportunidades_reasignadas: reasigCount,
              }),
            },
          ],
        };
      }
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmReasignarCuentaCascada:', err);
    }
  }

  // Fallback memoria
  const memory = db.getMemory();
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
