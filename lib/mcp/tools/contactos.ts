/**
 * Herramientas MCP para el Dominio de Contactos
 * Conexión en vivo con Supabase (CRM_Contactos) y fallback en memoria para tests.
 */
import { McpSessionContext, McpToolResult, CompactContact } from '../types';
import { CrmDatabaseAdapter } from '../database';

interface ContactRow {
  id: string;
  account_id?: string | null;
  nombre?: string | null;
  cargo?: string | null;
  email?: string | null;
  telefono?: string | null;
  es_principal?: boolean | null;
  is_deleted?: boolean | null;
  cuenta?: { nombre?: string | null } | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

export async function crmListarContactos(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: {
    limit?: number;
    offset?: number;
    cuenta_id?: string;
    account_id?: string;
    query?: string;
    incluir_archivados?: boolean;
  }
): Promise<McpToolResult> {
  const limit = Math.min(Math.max(1, Number(args.limit || 10)), 30);
  const offset = Math.max(0, Number(args.offset || 0));
  const accountId = args.cuenta_id || args.account_id;
  const query = (args.query || '').trim();

  const supabase = db.getSupabase();
  if (supabase) {
    try {
      let q = supabase
        .from('CRM_Contactos')
        .select('id, account_id, nombre, cargo, email, telefono, es_principal, is_deleted, cuenta:CRM_Cuentas!account_id(nombre)', { count: 'exact' });

      if (!args.incluir_archivados) {
        q = q.or('is_deleted.is.null,is_deleted.eq.false');
      }

      if (accountId && isUuid(accountId)) {
        q = q.eq('account_id', accountId);
      }

      if (query) {
        q = q.or(`nombre.ilike.%${query}%,email.ilike.%${query}%,telefono.ilike.%${query}%`);
      }

      q = q.order('nombre', { ascending: true }).order('id', { ascending: true });
      q = q.range(offset, offset + limit - 1);

      const { data, count, error } = await q;

      if (!error && data) {
        const items: CompactContact[] = (data as unknown as ContactRow[]).map((con) => ({
          id: String(con.id),
          account_id: String(con.account_id || ''),
          cuenta_nombre: con.cuenta?.nombre || undefined,
          nombre: String(con.nombre || 'Sin nombre'),
          cargo: con.cargo || undefined,
          email: con.email || undefined,
          telefono: con.telefono || undefined,
          es_principal: Boolean(con.es_principal),
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
      console.warn('[CRM-MCP] Error en Supabase crmListarContactos:', err);
    }
  }

  // Fallback memoria
  const memory = db.getMemory();
  const allContacts = Array.from(memory.contacts.values());

  const filtered = allContacts.filter((con) => {
    if (con.is_deleted && !args.incluir_archivados) return false;
    if (accountId && con.account_id !== accountId) return false;
    if (query) {
      const nombreCon = String(con.nombre || '').toLowerCase();
      const emailCon = String(con.email || '').toLowerCase();
      const telCon = String(con.telefono || '');
      if (!nombreCon.includes(query.toLowerCase()) && !emailCon.includes(query.toLowerCase()) && !telCon.includes(query)) {
        return false;
      }
    }
    return true;
  });

  const paged = filtered.slice(offset, offset + limit).map((con): CompactContact => {
    const acc = con.account_id ? memory.accounts.get(con.account_id) : undefined;
    return {
      id: con.id,
      account_id: con.account_id || '',
      cuenta_nombre: acc?.nombre,
      nombre: `${con.nombre || ''} ${con.apellido || ''}`.trim(),
      cargo: con.cargo,
      email: con.email,
      telefono: con.telefono,
      es_principal: con.es_principal,
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

export async function crmConsultarContacto(
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
        .from('CRM_Contactos')
        .select('*, cuenta:CRM_Cuentas!account_id(nombre)')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return {
          isError: false,
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: data.id,
                  account_id: data.account_id,
                  cuenta_nombre: data.cuenta?.nombre,
                  nombre: data.nombre,
                  cargo: data.cargo,
                  email: data.email,
                  telefono: data.telefono,
                  es_principal: data.es_principal,
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
      console.warn('[CRM-MCP] Error en Supabase crmConsultarContacto:', err);
    }
  }

  // Fallback memoria
  const memory = db.getMemory();
  const con = memory.contacts.get(id);

  if (!con) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Contacto no encontrado con ID: ${id}` }],
    };
  }

  const acc = con.account_id ? memory.accounts.get(con.account_id) : undefined;

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            ...con,
            cuenta_nombre: acc?.nombre,
          },
          null,
          2
        ),
      },
    ],
  };
}

export async function crmCrearContacto(
  ctx: McpSessionContext,
  db: CrmDatabaseAdapter,
  args: {
    cuenta_id?: string;
    account_id?: string;
    nombre?: string;
    apellido?: string;
    cargo?: string;
    email?: string;
    telefono?: string;
    es_principal?: boolean;
    comentarios?: string;
  }
): Promise<McpToolResult> {
  const accountId = args.cuenta_id || args.account_id;
  if (!accountId) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: El identificador de cuenta asociada ("cuenta_id") es obligatorio.' }],
    };
  }

  const nombreFinal = `${args.nombre || ''} ${args.apellido || ''}`.trim();
  if (!nombreFinal) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: El nombre del contacto es obligatorio.' }],
    };
  }

  const supabase = db.getSupabase();
  if (supabase && isUuid(accountId)) {
    try {
      const newRecord = {
        account_id: accountId,
        nombre: nombreFinal,
        cargo: args.cargo || '',
        email: args.email || '',
        telefono: args.telefono || '',
        es_principal: !!args.es_principal,
        comentarios: args.comentarios || '',
        is_deleted: false,
      };

      const { data: created, error } = await supabase
        .from('CRM_Contactos')
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
                mensaje: 'Contacto creado exitosamente en Supabase',
                ...created,
              }),
            },
          ],
        };
      }
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmCrearContacto:', err);
    }
  }

  // Fallback memoria
  const memory = db.getMemory();
  const newId = `con-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newContact = {
    id: newId,
    account_id: accountId,
    nombre: args.nombre || 'Nuevo Contacto',
    apellido: args.apellido || '',
    cargo: args.cargo || '',
    email: args.email || '',
    telefono: args.telefono || '',
    es_principal: !!args.es_principal,
    comentarios: args.comentarios || '',
    is_deleted: false,
    created_at: new Date().toISOString(),
  };

  memory.contacts.set(newId, newContact);

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: 'Contacto creado exitosamente',
          ...newContact,
        }),
      },
    ],
  };
}

export async function crmActualizarContacto(
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
      if (args.cargo !== undefined) updateData.cargo = args.cargo;
      if (args.email !== undefined) updateData.email = args.email;
      if (args.telefono !== undefined) updateData.telefono = args.telefono;
      if (args.es_principal !== undefined) updateData.es_principal = args.es_principal;
      if (args.comentarios !== undefined) updateData.comentarios = args.comentarios;

      const { data: updated, error } = await supabase
        .from('CRM_Contactos')
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
                mensaje: 'Contacto actualizado exitosamente en Supabase',
                ...updated,
              }),
            },
          ],
        };
      }
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmActualizarContacto:', err);
    }
  }

  // Fallback memoria
  const memory = db.getMemory();
  const con = memory.contacts.get(id);

  if (!con) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Contacto no encontrado con ID: ${id}` }],
    };
  }

  const updated = {
    ...con,
    ...args,
    id: con.id,
    updated_at: new Date().toISOString(),
  };

  memory.contacts.set(id, updated);

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: 'Contacto actualizado exitosamente',
          ...updated,
        }),
      },
    ],
  };
}

export async function crmRecuperarContacto(
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
        .from('CRM_Contactos')
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
                mensaje: `Contacto "${updated.nombre}" recuperado exitosamente en Supabase.`,
                id: updated.id,
                is_deleted: false,
              }),
            },
          ],
        };
      }
    } catch (err) {
      console.warn('[CRM-MCP] Error en Supabase crmRecuperarContacto:', err);
    }
  }

  // Fallback memoria
  const memory = db.getMemory();
  const con = id ? memory.contacts.get(id) : undefined;

  if (!con) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Contacto no encontrado con ID: ${id}` }],
    };
  }

  con.is_deleted = false;
  con.updated_at = new Date().toISOString();
  if (id) memory.contacts.set(id, con);

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: `Contacto "${con.nombre}" recuperado exitosamente.`,
          id: con.id,
          is_deleted: false,
        }),
      },
    ],
  };
}
