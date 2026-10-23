/**
 * Herramientas MCP para el Dominio de Contactos
 */
import { McpSessionContext, McpToolResult, CompactContact } from '../types';
import { CrmDatabaseAdapter } from '../database';

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
  const query = (args.query || '').toLowerCase();

  const memory = db.getMemory();
  const allContacts = Array.from(memory.contacts.values());

  const filtered = allContacts.filter((con) => {
    if (con.is_deleted && !args.incluir_archivados) return false;
    if (accountId && con.account_id !== accountId) return false;
    if (query) {
      const nombreCon = String(con.nombre || '').toLowerCase();
      const emailCon = String(con.email || '').toLowerCase();
      const telCon = String(con.telefono || '');
      if (!nombreCon.includes(query) && !emailCon.includes(query) && !telCon.includes(query)) {
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

  const memory = db.getMemory();
  const contact = memory.contacts.get(id);

  if (!contact) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Contacto no encontrado con ID: ${id}` }],
    };
  }

  const acc = contact.account_id ? memory.accounts.get(contact.account_id) : undefined;

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            ...contact,
            cuenta_nombre: acc?.nombre || 'Desconocida',
            nit_cuenta: acc?.nit,
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
  const memory = db.getMemory();
  const accountId = args.cuenta_id || args.account_id;

  if (!accountId) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: "cuenta_id" es obligatorio para crear un contacto.' }],
    };
  }

  if (!args.nombre) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: El "nombre" del contacto es obligatorio.' }],
    };
  }

  const account = memory.accounts.get(accountId);
  if (!account) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error: La cuenta con ID ${accountId} no existe.` }],
    };
  }

  const newId = `con-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newContact = {
    id: newId,
    account_id: accountId,
    nombre: args.nombre,
    apellido: args.apellido || '',
    cargo: args.cargo || 'Contacto Comercial',
    email: args.email || '',
    telefono: args.telefono || '',
    es_principal: Boolean(args.es_principal),
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
  const memory = db.getMemory();
  const id = args.id;
  const contact = memory.contacts.get(id);

  if (!contact) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Contacto no encontrado con ID: ${id}` }],
    };
  }

  const updated = {
    ...contact,
    ...args,
    id: contact.id,
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
  const memory = db.getMemory();
  const id = args.id;
  if (!id) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: El parámetro "id" es obligatorio.' }],
    };
  }
  const contact = memory.contacts.get(id);

  if (!contact) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Contacto no encontrado con ID: ${id}` }],
    };
  }

  contact.is_deleted = false;
  contact.updated_at = new Date().toISOString();
  memory.contacts.set(id, contact);

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          mensaje: `Contacto "${contact.nombre}" recuperado exitosamente.`,
          id: contact.id,
          is_deleted: false,
        }),
      },
    ],
  };
}
