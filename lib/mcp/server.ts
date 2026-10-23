/**
 * Servidor MCP Central para CRM FIRPLAK
 * Integra @modelcontextprotocol/sdk con control dinámico de roles, recursos nativos y política de cero borrado.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { McpSessionContext, McpToolResult } from './types';
import { canExecuteTool, isForbiddenDeleteTool } from './permissions';
import { CrmDatabaseAdapter } from './database';
import { listCrmResources, readCrmResource } from './resources';

// Importar controladores de herramientas
import {
  crmBuscarOportunidades,
  crmConsultarOportunidad,
  crmCrearOportunidad,
  crmActualizarOportunidad,
  crmRecuperarOportunidad,
  crmReasignarOportunidad,
} from './tools/oportunidades';

import {
  crmBuscarCuentas,
  crmConsultarCuenta,
  crmCrearCuenta,
  crmActualizarCuenta,
  crmRecuperarCuenta,
  crmReasignarCuentaCascada,
} from './tools/cuentas';

import {
  crmListarContactos,
  crmConsultarContacto,
  crmCrearContacto,
  crmActualizarContacto,
  crmRecuperarContacto,
} from './tools/contactos';

import {
  crmAgendaDiaria,
  crmListarActividades,
  crmConsultarActividad,
  crmCrearActividad,
  crmActualizarActividad,
  crmRecuperarActividad,
} from './tools/actividades';

import {
  crmGestionarClasificacion,
  crmGestionarOrigen,
  crmGestionarConfiguracion,
} from './tools/parametros';

export interface CrmMcpInstance {
  context: McpSessionContext;
  db: CrmDatabaseAdapter;
  mcpServer: McpServer;
  listTools(): Promise<Array<{ name: string; description: string; inputSchema: unknown }>>;
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult>;
  listResources(): Promise<Array<{ uri: string; name: string; description: string; mimeType: string }>>;
  readResource(uri: string): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }>;
  executeRawTool(name: string, args: Record<string, unknown>): Promise<McpToolResult>;
  connectStdio(): Promise<void>;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  schema: Record<string, z.ZodTypeAny>;
  handler: (args: Record<string, unknown>) => Promise<McpToolResult>;
}

export function createCrmMcpServer(context: McpSessionContext): CrmMcpInstance {
  const db = new CrmDatabaseAdapter();

  const mcpServer = new McpServer({
    name: 'crm-firplak-mcp',
    version: '1.2.0',
  });

  // Catálogo completo de herramientas del CRM
  const allToolDefinitions: McpToolDefinition[] = [
    // OPORTUNIDADES
    {
      name: 'crm_buscar_oportunidades',
      description:
        'Busca y lista oportunidades de venta con filtros y paginación acotada. No se admiten eliminaciones; para cerrar una oportunidad fallida actualice su estado a Perdida con razon_perdida_id.',
      schema: {
        query: z.string().optional().describe('Texto de búsqueda en nombre de la oportunidad'),
        canal_id: z.string().optional().describe('Filtro por canal comercial (OBRAS_NAC, DIST_NAC, PROPIO, etc.)'),
        fase_id: z.number().optional().describe('Filtro por ID de fase comercial'),
        limit: z.number().min(1).max(30).optional().describe('Límite de registros (máx 30, default 10)'),
        offset: z.number().min(0).optional().describe('Desplazamiento para paginación'),
        incluir_archivadas: z.boolean().optional().describe('Incluir oportunidades en papelera o soft-deleted'),
      },
      handler: (args) => crmBuscarOportunidades(context, db, args as unknown as Parameters<typeof crmBuscarOportunidades>[2]),
    },
    {
      name: 'crm_consultar_oportunidad',
      description: 'Consulta el detalle completo de una oportunidad comercial específica por ID.',
      schema: {
        id: z.string().describe('ID único de la oportunidad'),
      },
      handler: (args) => crmConsultarOportunidad(context, db, args as unknown as Parameters<typeof crmConsultarOportunidad>[2]),
    },
    {
      name: 'crm_crear_oportunidad',
      description:
        'Crea una nueva oportunidad comercial validando cuenta, canal y fase inicial correspondiente con cálculo de probabilidad.',
      schema: {
        nombre: z.string().describe('Nombre descriptivo del negocio o proyecto'),
        cuenta_id: z.string().describe('ID de la cuenta/cliente asociada'),
        canal_id: z.string().describe('Canal de venta (OBRAS_NAC, DIST_NAC, PROPIO, OBRAS_INT, DIST_INT)'),
        fase_id: z.number().describe('ID de la fase inicial correspondiente al canal'),
        valor: z.number().optional().describe('Monto estimado del negocio en COP'),
        monto: z.number().optional().describe('Alias de valor'),
        probability: z.number().min(0).max(100).optional().describe('Probabilidad estimada de éxito'),
        fecha_cierre: z.string().optional().describe('Fecha estimada de cierre (AAAA-MM-DD)'),
        owner_user_id: z.string().optional().describe('ID del asesor responsable (solo Coordinador/Admin)'),
        categoria_oportunidad: z.string().optional().describe('Categorías de producto (ej. Baños, Cocinas)'),
        contactos_ids: z.array(z.string()).optional().describe('IDs de contactos vinculados'),
        clientes_atendidos: z.number().optional().describe('Número de personas atendidas'),
        origen_oportunidad: z.string().optional().describe('Origen del lead'),
        comentarios: z.string().optional().describe('Notas iniciales'),
        idempotency_key: z.string().optional().describe('Clave única para evitar duplicados en reintentos'),
      },
      handler: (args) => crmCrearOportunidad(context, db, args as unknown as Parameters<typeof crmCrearOportunidad>[2]),
    },
    {
      name: 'crm_actualizar_oportunidad',
      description:
        'Actualiza importe, fase, fechas o estado de una oportunidad. Si se marca como Perdida, requiere razon_perdida_id.',
      schema: {
        id: z.string().describe('ID de la oportunidad a actualizar'),
        nombre: z.string().optional().describe('Nuevo nombre de la oportunidad'),
        valor: z.number().optional().describe('Nuevo valor estimado en COP'),
        fase_id: z.number().optional().describe('Nueva fase de la oportunidad'),
        estado_id: z.number().optional().describe('Estado: 1=Abierta, 2=Perdida, 3=Ganada'),
        razon_perdida_id: z.number().optional().describe('Obligatorio si estado_id es 2 (Perdida)'),
        comentarios_perdida: z.string().optional().describe('Motivo explicativo de la pérdida'),
        fecha_cierre: z.string().optional().describe('Nueva fecha estimada de cierre'),
        comentarios: z.string().optional().describe('Notas o comentarios de seguimiento'),
      },
      handler: (args) => crmActualizarOportunidad(context, db, args as unknown as Parameters<typeof crmActualizarOportunidad>[2]),
    },
    {
      name: 'crm_recuperar_oportunidad',
      description:
        'Recupera y reactiva una oportunidad archivada o marcada como perdida, restaurándola al estado activo.',
      schema: {
        id: z.string().describe('ID de la oportunidad a recuperar'),
      },
      handler: (args) => crmRecuperarOportunidad(context, db, args as unknown as Parameters<typeof crmRecuperarOportunidad>[2]),
    },
    {
      name: 'crm_reasignar_oportunidad',
      description:
        'Reasigna la titularidad de una oportunidad a otro asesor comercial (Exclusivo Coordinador / Administrador).',
      schema: {
        id: z.string().describe('ID de la oportunidad'),
        nuevo_propietario_id: z.string().describe('UUID del nuevo usuario asesor asignado'),
      },
      handler: (args) => crmReasignarOportunidad(context, db, args as unknown as Parameters<typeof crmReasignarOportunidad>[2]),
    },

    // CUENTAS
    {
      name: 'crm_buscar_cuentas',
      description:
        'Busca cuentas (empresas/clientes) por nombre, NIT o canal de forma paginada y compacta.',
      schema: {
        query: z.string().optional().describe('Búsqueda por texto en razón social o NIT'),
        canal_id: z.string().optional().describe('Filtro por canal'),
        limit: z.number().min(1).max(30).optional().describe('Límite de registros (máx 30, default 10)'),
        offset: z.number().min(0).optional().describe('Desplazamiento para paginación'),
        incluir_archivadas: z.boolean().optional().describe('Incluir cuentas inactivas o deshabilitadas'),
      },
      handler: (args) => crmBuscarCuentas(context, db, args as unknown as Parameters<typeof crmBuscarCuentas>[2]),
    },
    {
      name: 'crm_consultar_cuenta',
      description:
        'Consulta el detalle completo de una cuenta por ID o NIT, incluyendo contactos y oportunidades vinculadas.',
      schema: {
        id: z.string().optional().describe('ID único de la cuenta'),
        nit: z.string().optional().describe('NIT de la empresa (si no se tiene el ID)'),
      },
      handler: (args) => crmConsultarCuenta(context, db, args as unknown as Parameters<typeof crmConsultarCuenta>[2]),
    },
    {
      name: 'crm_crear_cuenta',
      description:
        'Crea una cuenta/cliente con canal obligatorio y autogeneración de NIT provisional si no tiene.',
      schema: {
        nombre: z.string().describe('Razón social o nombre comercial de la empresa'),
        canal_id: z.string().describe('Canal de venta obligatorio (OBRAS_NAC, DIST_NAC, PROPIO, etc.)'),
        nit: z.string().optional().describe('NIT con dígito de verificación (si se omite, se genera PROV-XXXXXXXX)'),
        ciudad: z.string().optional().describe('Ciudad de ubicación'),
        direccion: z.string().optional().describe('Dirección física'),
        telefono: z.string().optional().describe('Teléfono corporativo'),
        email: z.string().optional().describe('Correo electrónico'),
        nivel_premium: z.enum(['PREMIUM', 'DESTACADO', 'ACTIVO']).optional().describe('Nivel de cliente'),
        origen_cuenta: z.string().optional().describe('Procedencia de la cuenta'),
        owner_user_id: z.string().optional().describe('ID del comercial asignado'),
      },
      handler: (args) => crmCrearCuenta(context, db, args as unknown as Parameters<typeof crmCrearCuenta>[2]),
    },
    {
      name: 'crm_actualizar_cuenta',
      description: 'Actualiza datos de contacto, comerciales o de ubicación de una cuenta.',
      schema: {
        id: z.string().describe('ID de la cuenta'),
        nombre: z.string().optional().describe('Razón social'),
        telefono: z.string().optional().describe('Teléfono'),
        email: z.string().optional().describe('Correo'),
        direccion: z.string().optional().describe('Dirección'),
        ciudad: z.string().optional().describe('Ciudad'),
        nivel_premium: z.enum(['PREMIUM', 'DESTACADO', 'ACTIVO']).optional(),
        comentarios: z.string().optional(),
      },
      handler: (args) => crmActualizarCuenta(context, db, args as unknown as Parameters<typeof crmActualizarCuenta>[2]),
    },
    {
      name: 'crm_recuperar_cuenta',
      description: 'Rehabilita y reactiva una cuenta inactiva o desarchivada.',
      schema: {
        id: z.string().describe('ID de la cuenta a reactivar'),
      },
      handler: (args) => crmRecuperarCuenta(context, db, args as unknown as Parameters<typeof crmRecuperarCuenta>[2]),
    },
    {
      name: 'crm_reasignar_cuenta_cascada',
      description:
        'Reasigna una cuenta y todas sus oportunidades vinculadas a un nuevo comercial en un solo paso (Coordinador / Admin).',
      schema: {
        id: z.string().describe('ID de la cuenta matriz a reasignar'),
        nuevo_propietario_id: z.string().describe('UUID del nuevo comercial responsable'),
      },
      handler: (args) => crmReasignarCuentaCascada(context, db, args as unknown as Parameters<typeof crmReasignarCuentaCascada>[2]),
    },

    // CONTACTOS
    {
      name: 'crm_listar_contactos',
      description: 'Lista contactos asociados a una cuenta o realiza búsquedas por nombre, teléfono o email.',
      schema: {
        cuenta_id: z.string().optional().describe('ID de la cuenta para listar sus personas de contacto'),
        account_id: z.string().optional().describe('Alias de cuenta_id'),
        query: z.string().optional().describe('Texto de búsqueda'),
        limit: z.number().min(1).max(30).optional(),
        offset: z.number().min(0).optional(),
      },
      handler: (args) => crmListarContactos(context, db, args as unknown as Parameters<typeof crmListarContactos>[2]),
    },
    {
      name: 'crm_consultar_contacto',
      description: 'Consulta los datos detallados de una persona de contacto por su ID.',
      schema: {
        id: z.string().describe('ID del contacto'),
      },
      handler: (args) => crmConsultarContacto(context, db, args as unknown as Parameters<typeof crmConsultarContacto>[2]),
    },
    {
      name: 'crm_crear_contacto',
      description: 'Registra un nuevo contacto vinculado obligatoriamente a una cuenta.',
      schema: {
        cuenta_id: z.string().describe('ID de la cuenta a la que pertenece'),
        nombre: z.string().describe('Nombre del contacto'),
        apellido: z.string().optional().describe('Apellido del contacto'),
        cargo: z.string().optional().describe('Cargo (ej. Director de Compras, Arquitecto)'),
        email: z.string().optional().describe('Correo electrónico'),
        telefono: z.string().optional().describe('Teléfono o WhatsApp'),
        es_principal: z.boolean().optional().describe('Si es el contacto comercial principal'),
      },
      handler: (args) => crmCrearContacto(context, db, args as unknown as Parameters<typeof crmCrearContacto>[2]),
    },
    {
      name: 'crm_actualizar_contacto',
      description: 'Actualiza los datos personales, de contacto o cargo de una persona.',
      schema: {
        id: z.string().describe('ID del contacto'),
        nombre: z.string().optional(),
        apellido: z.string().optional(),
        cargo: z.string().optional(),
        email: z.string().optional(),
        telefono: z.string().optional(),
        es_principal: z.boolean().optional(),
      },
      handler: (args) => crmActualizarContacto(context, db, args as unknown as Parameters<typeof crmActualizarContacto>[2]),
    },
    {
      name: 'crm_recuperar_contacto',
      description: 'Rehabilita un contacto archivado o desactivado.',
      schema: {
        id: z.string().describe('ID del contacto a recuperar'),
      },
      handler: (args) => crmRecuperarContacto(context, db, args as unknown as Parameters<typeof crmRecuperarContacto>[2]),
    },

    // ACTIVIDADES Y AGENDA
    {
      name: 'crm_agenda_diaria',
      description:
        'Consulta rápida y sintetizada de la agenda del día para el asesor comercial (tareas y eventos pendientes hoy).',
      schema: {},
      handler: () => crmAgendaDiaria(context, db),
    },
    {
      name: 'crm_listar_actividades',
      description:
        'Lista tareas y eventos con filtros por estado (pendientes, vencidas, completadas), cuenta u oportunidad.',
      schema: {
        estado: z.enum(['pendientes', 'vencidas', 'completadas']).optional().describe('Filtro de estado'),
        opportunity_id: z.string().optional().describe('Filtrar por oportunidad'),
        account_id: z.string().optional().describe('Filtrar por cuenta'),
        limit: z.number().min(1).max(30).optional(),
        offset: z.number().min(0).optional(),
      },
      handler: (args) => crmListarActividades(context, db, args as unknown as Parameters<typeof crmListarActividades>[2]),
    },
    {
      name: 'crm_consultar_actividad',
      description: 'Consulta el detalle de una tarea o evento por ID.',
      schema: {
        id: z.string().describe('ID de la actividad'),
      },
      handler: (args) => crmConsultarActividad(context, db, args as unknown as Parameters<typeof crmConsultarActividad>[2]),
    },
    {
      name: 'crm_crear_actividad',
      description:
        'Programa una tarea o evento comercial con autogeneración de asunto si se omite.',
      schema: {
        asunto: z.string().optional().describe('Asunto de la actividad (si se omite, se autogenera)'),
        descripcion: z.string().optional().describe('Detalle o notas de la actividad'),
        tipo_actividad: z.enum(['TAREA', 'EVENTO']).optional().describe('Tipo de actividad'),
        prioridad: z.enum(['Alta', 'Media', 'Baja']).optional().describe('Prioridad'),
        clasificacion_id: z.number().optional().describe('ID de clasificación (ej. 1: Llamada, 2: Visita)'),
        fecha_inicio: z.string().optional().describe('Fecha y hora de inicio (ISO 8601)'),
        fecha_fin: z.string().optional().describe('Fecha y hora de finalización'),
        opportunity_id: z.string().optional().describe('ID de oportunidad asociada'),
        account_id: z.string().optional().describe('ID de cuenta asociada'),
      },
      handler: (args) => crmCrearActividad(context, db, args as unknown as Parameters<typeof crmCrearActividad>[2]),
    },
    {
      name: 'crm_actualizar_actividad',
      description: 'Marca una actividad como completada o reprograma fechas y notas de seguimiento.',
      schema: {
        id: z.string().describe('ID de la actividad'),
        is_completed: z.boolean().optional().describe('Marcar como completada (true/false)'),
        fecha_inicio: z.string().optional().describe('Reprogramar fecha de inicio'),
        fecha_fin: z.string().optional().describe('Reprogramar fecha fin'),
        prioridad: z.enum(['Alta', 'Media', 'Baja']).optional(),
        descripcion: z.string().optional().describe('Notas de seguimiento'),
      },
      handler: (args) => crmActualizarActividad(context, db, args as unknown as Parameters<typeof crmActualizarActividad>[2]),
    },
    {
      name: 'crm_recuperar_actividad',
      description: 'Reabre una tarea o evento completado o archivado devolviéndolo a la agenda activa.',
      schema: {
        id: z.string().describe('ID de la actividad a reabrir'),
      },
      handler: (args) => crmRecuperarActividad(context, db, args as unknown as Parameters<typeof crmRecuperarActividad>[2]),
    },

    // PARÁMETROS Y CONFIGURACIÓN
    {
      name: 'crm_gestionar_clasificacion',
      description:
        'Crea una nueva clasificación o tipo de actividad comercial (Coordinador / Administrador).',
      schema: {
        nombre: z.string().describe('Nombre de la clasificación comercial'),
        tipo_actividad: z.enum(['TAREA', 'EVENTO']).optional(),
      },
      handler: (args) => crmGestionarClasificacion(context, db, args as unknown as Parameters<typeof crmGestionarClasificacion>[2]),
    },
    {
      name: 'crm_gestionar_origen',
      description:
        'Registra una nueva procedencia u origen de oportunidades (Coordinador / Administrador).',
      schema: {
        nombre: z.string().describe('Nombre del origen de oportunidad'),
      },
      handler: (args) => crmGestionarOrigen(context, db, args as unknown as Parameters<typeof crmGestionarOrigen>[2]),
    },
    {
      name: 'crm_gestionar_configuracion',
      description: 'Actualiza parámetros operativos globales del CRM (Exclusivo Administrador).',
      schema: {
        key: z.string().describe('Clave del parámetro'),
        value: z.unknown().describe('Valor del parámetro'),
      },
      handler: (args) => crmGestionarConfiguracion(context, db, args as unknown as Parameters<typeof crmGestionarConfiguracion>[2]),
    },
  ];

  // Filtrar dinámicamente las herramientas según el rol activo
  const activeTools = allToolDefinitions.filter((tool) => canExecuteTool(context, tool.name));

  // Registrar las herramientas en la instancia de McpServer
  const dynamicServer = mcpServer as unknown as {
    tool: (
      name: string,
      description: string,
      schema: Record<string, z.ZodTypeAny>,
      handler: (args: Record<string, unknown>) => Promise<McpToolResult>
    ) => void;
  };
  for (const t of activeTools) {
    dynamicServer.tool(t.name, t.description, t.schema, async (args: Record<string, unknown>) => {
      const result = await t.handler(args);
      return result;
    });
  }

  // Objeto interfaz para tests, CLI y endpoints
  return {
    context,
    db,
    mcpServer,
    async listTools() {
      return activeTools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.schema,
      }));
    },
    async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
      if (isForbiddenDeleteTool(name)) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: 'Operación no permitida: El protocolo MCP del CRM FIRPLAK no admite borrado físico por política de seguridad y auditoría. Debe utilizar actualización de estado o recuperación.',
            },
          ],
        };
      }

      const found = activeTools.find((t) => t.name === name);
      if (!found) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Herramienta "${name}" no disponible o no autorizada para el rol ${context.role}.`,
            },
          ],
        };
      }

      return await found.handler(args);
    },
    async executeRawTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
      if (isForbiddenDeleteTool(name)) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: 'Operación no permitida: El protocolo MCP del CRM FIRPLAK no admite borrado físico por política de seguridad y auditoría. Debe utilizar actualización de estado o recuperación.',
            },
          ],
        };
      }
      return this.callTool(name, args);
    },
    async listResources() {
      return listCrmResources();
    },
    async readResource(uri: string) {
      return await readCrmResource(uri, db);
    },
    async connectStdio() {
      const transport = new StdioServerTransport();
      await mcpServer.connect(transport);
    },
  };
}
