import { describe, it, expect } from 'vitest';
import { createCrmMcpServer } from '@/lib/mcp/server';
import { McpSessionContext, getMcpPublicUrl, VERCEL_MCP_PRODUCTION_URL } from '@/lib/mcp/types';

describe('Servidor MCP CRM FIRPLAK', () => {
  const vendedorContext: McpSessionContext = {
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'vendedor@firplak.com',
    role: 'VENDEDOR',
    transport: 'stdio',
  };

  const coordinadorContext: McpSessionContext = {
    userId: '22222222-2222-2222-2222-222222222222',
    email: 'coordinador@firplak.com',
    role: 'COORDINADOR',
    transport: 'stdio',
  };

  const adminContext: McpSessionContext = {
    userId: '33333333-3333-3333-3333-333333333333',
    email: 'admin@firplak.com',
    role: 'ADMIN',
    transport: 'stdio',
  };

  describe('1. Política Estricta Cero Borrado (No-Delete)', () => {
    it('no debe exponer ninguna herramienta de borrado para ningún rol', async () => {
      const roles = [vendedorContext, coordinadorContext, adminContext];
      for (const ctx of roles) {
        const server = createCrmMcpServer(ctx);
        const tools = await server.listTools();
        const toolNames = tools.map((t) => t.name.toLowerCase());

        // Ninguna tool debe contener delete, eliminar, borrar o drop
        const deleteTools = toolNames.filter(
          (n) => n.includes('delete') || n.includes('eliminar') || n.includes('borrar')
        );
        expect(deleteTools).toEqual([]);

        // Comprobación semántica en descripciones
        for (const tool of tools) {
          expect(tool.description.toLowerCase()).not.toContain('eliminar permanentemente');
          expect(tool.description.toLowerCase()).not.toContain('borrado físico');
        }
      }
    });

    it('debe rechazar explícitamente cualquier intento de ejecución de borrado', async () => {
      const server = createCrmMcpServer(adminContext);
      const res = await server.executeRawTool('crm_eliminar_oportunidad', { id: 'any-id' });
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toMatch(/no permitida.*no admite borrado/i);
    });
  });

  describe('2. Filtrado Dinámico de Catálogo por Rol', () => {
    it('vendedor solo ve herramientas comerciales propias, no de reasignación ni administración', async () => {
      const server = createCrmMcpServer(vendedorContext);
      const tools = await server.listTools();
      const names = tools.map((t) => t.name);

      // Debe incluir herramientas operativas de venta
      expect(names).toContain('crm_buscar_oportunidades');
      expect(names).toContain('crm_consultar_oportunidad');
      expect(names).toContain('crm_crear_oportunidad');
      expect(names).toContain('crm_actualizar_oportunidad');
      expect(names).toContain('crm_agenda_diaria');
      expect(names).toContain('crm_buscar_cuentas');

      // NO debe incluir reasignación de equipo ni configuración
      expect(names).not.toContain('crm_reasignar_oportunidad');
      expect(names).not.toContain('crm_reasignar_cuenta_cascada');
      expect(names).not.toContain('crm_gestionar_configuracion');
    });

    it('coordinador puede reasignar oportunidades y cuentas pero no gestionar configuración de sistema', async () => {
      const server = createCrmMcpServer(coordinadorContext);
      const tools = await server.listTools();
      const names = tools.map((t) => t.name);

      expect(names).toContain('crm_reasignar_oportunidad');
      expect(names).toContain('crm_reasignar_cuenta_cascada');
      expect(names).toContain('crm_gestionar_clasificacion');
      expect(names).not.toContain('crm_gestionar_configuracion');
    });

    it('administrador tiene acceso a herramientas de configuración avanzada', async () => {
      const server = createCrmMcpServer(adminContext);
      const tools = await server.listTools();
      const names = tools.map((t) => t.name);

      expect(names).toContain('crm_gestionar_configuracion');
      expect(names).toContain('crm_reasignar_oportunidad');
    });
  });

  describe('3. Aislamiento de Identidad (Vendedor)', () => {
    it('un vendedor no puede consultar ni editar oportunidades que no le pertenecen', async () => {
      const server = createCrmMcpServer(vendedorContext);

      // Simular intento de consultar oportunidad de otro vendedor
      const res = await server.callTool('crm_consultar_oportunidad', {
        id: 'opp-otro-vendedor',
      });
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toMatch(/no autorizado|no encontrada/i);
    });
  });

  describe('4. Contrato de Recuperación Determinista', () => {
    it('recuperar oportunidad reactiva la oportunidad y limpia razon_perdida', async () => {
      const server = createCrmMcpServer(vendedorContext);
      const res = await server.callTool('crm_recuperar_oportunidad', {
        id: 'opp-archivada-1',
      });
      expect(res.isError).toBe(false);
      expect(res.content[0].text).toMatch(/recuperada exitosamente/i);
    });
  });

  describe('5. Paginación y Protección de Contexto', () => {
    it('la búsqueda de cuentas y oportunidades restringe el límite a un máximo seguro', async () => {
      const server = createCrmMcpServer(vendedorContext);
      const res = await server.callTool('crm_buscar_cuentas', {
        query: 'test',
        limit: 100, // solicitando más de lo permitido
      });
      expect(res.isError).toBe(false);
      const data = JSON.parse(res.content[0].text);
      expect(data.limit).toBeLessThanOrEqual(30);
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('total_count');
    });
  });

  describe('6. Idempotencia', () => {
    it('evita crear registros duplicados si se envía la misma idempotency_key', async () => {
      const server = createCrmMcpServer(vendedorContext);
      const payload = {
        nombre: 'Oportunidad Obra Norte',
        cuenta_id: 'acc-uuid-1',
        canal_id: 'OBRAS_NAC',
        fase_id: 1,
        idempotency_key: 'idem-deal-777',
      };

      const res1 = await server.callTool('crm_crear_oportunidad', payload);
      const res2 = await server.callTool('crm_crear_oportunidad', payload);

      expect(res1.isError).toBe(false);
      expect(res2.isError).toBe(false);
      const data1 = JSON.parse(res1.content[0].text);
      const data2 = JSON.parse(res2.content[0].text);
      expect(data1.id).toBe(data2.id);
      expect(data2.idempotent_replay).toBe(true);
    });
  });

  describe('7. Errores Auto-Correctivos (Self-Healing)', () => {
    it('indica las fases válidas del canal cuando se proporciona una fase incompatible', async () => {
      const server = createCrmMcpServer(vendedorContext);
      const res = await server.callTool('crm_crear_oportunidad', {
        nombre: 'Negocio Inválido',
        cuenta_id: 'acc-uuid-1',
        canal_id: 'DIST_NAC',
        fase_id: 9999, // Fase inexistente
      });

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toMatch(/fase.*inv[aá]lida/i);
      expect(res.content[0].text).toMatch(/fases disponibles/i);
    });
  });

  describe('8. Recursos Nativos MCP (Resources)', () => {
    it('expone los canales y clasificaciones como recursos URI legibles', async () => {
      const server = createCrmMcpServer(vendedorContext);
      const resources = await server.listResources();
      const uris = resources.map((r) => r.uri);

      expect(uris).toContain('crm://canales');
      expect(uris).toContain('crm://clasificaciones-actividad');
      expect(uris).toContain('crm://motivos-perdida');

      const canalesRes = await server.readResource('crm://canales');
      const canalesData = JSON.parse(canalesRes.contents[0].text);
      expect(canalesData.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('9. Dominio de Cuentas (Creación, NIT provisional y Reasignación)', () => {
    it('genera NIT provisional automático si no se suministra y exige canal_id', async () => {
      const server = createCrmMcpServer(vendedorContext);

      // Intento sin canal_id falla
      const errRes = await server.callTool('crm_crear_cuenta', {
        nombre: 'Constructora Sin Canal',
      });
      expect(errRes.isError).toBe(true);
      expect(errRes.content[0].text).toMatch(/canal_id.*obligatorio/i);

      // Con canal_id crea cuenta y genera NIT provisional
      const okRes = await server.callTool('crm_crear_cuenta', {
        nombre: 'Constructora Prov',
        canal_id: 'OBRAS_NAC',
      });
      expect(okRes.isError).toBe(false);
      const data = JSON.parse(okRes.content[0].text);
      expect(data.nit).toMatch(/^PROV-[A-F0-9]{8}$/);
    });

    it('coordinador puede reasignar cuenta y oportunidades en cascada', async () => {
      const server = createCrmMcpServer(coordinadorContext);
      const res = await server.callTool('crm_reasignar_cuenta_cascada', {
        id: 'acc-uuid-1',
        nuevo_propietario_id: 'new-owner-uuid-888',
      });

      expect(res.isError).toBe(false);
      const data = JSON.parse(res.content[0].text);
      expect(data.nuevo_propietario_id).toBe('new-owner-uuid-888');
      expect(data.oportunidades_reasignadas).toBeGreaterThanOrEqual(1);
    });
  });

  describe('10. Dominio de Contactos (Creación, Consulta y Recuperación)', () => {
    it('crea contacto vinculado a cuenta y permite recuperarlo', async () => {
      const server = createCrmMcpServer(vendedorContext);
      const createRes = await server.callTool('crm_crear_contacto', {
        cuenta_id: 'acc-uuid-1',
        nombre: 'Laura',
        apellido: 'Martínez',
        cargo: 'Arquitecta de Diseños',
        email: 'laura@constructora.com',
      });

      expect(createRes.isError).toBe(false);
      const data = JSON.parse(createRes.content[0].text);
      expect(data.id).toBeDefined();

      // Recuperar contacto
      const recRes = await server.callTool('crm_recuperar_contacto', {
        id: data.id,
      });
      expect(recRes.isError).toBe(false);
      expect(recRes.content[0].text).toMatch(/recuperado exitosamente/i);
    });
  });

  describe('11. Dominio de Actividades y Agenda Diaria', () => {
    it('programa actividad con autogeneración de asunto y permite recuperarla', async () => {
      const server = createCrmMcpServer(vendedorContext);

      // Crear actividad sin asunto para verificar autogeneración
      const createRes = await server.callTool('crm_crear_actividad', {
        account_id: 'acc-uuid-1',
        clasificacion_id: 1, // Llamada Comercial
        tipo_actividad: 'TAREA',
        prioridad: 'Alta',
      });

      expect(createRes.isError).toBe(false);
      const actData = JSON.parse(createRes.content[0].text);
      expect(actData.asunto).toContain('Llamada Comercial');

      // Consultar agenda diaria
      const agendaRes = await server.callTool('crm_agenda_diaria', {});
      expect(agendaRes.isError).toBe(false);
      const agendaData = JSON.parse(agendaRes.content[0].text);
      expect(agendaData).toHaveProperty('resumen');

      // Recuperar / reabrir actividad
      const recRes = await server.callTool('crm_recuperar_actividad', {
        id: actData.id,
      });
      expect(recRes.isError).toBe(false);
      expect(recRes.content[0].text).toMatch(/reabierta.*restaurada/i);
    });
  });

  describe('12. Dominio de Parámetros y Configuración', () => {
    it('coordinador puede crear clasificaciones y orígenes', async () => {
      const server = createCrmMcpServer(coordinadorContext);
      const res = await server.callTool('crm_gestionar_clasificacion', {
        nombre: 'Visita Técnica de Instalación',
        tipo_actividad: 'EVENTO',
      });

      expect(res.isError).toBe(false);
      expect(res.content[0].text).toMatch(/registrada exitosamente/i);
    });

    it('administrador puede modificar parámetros de configuración global', async () => {
      const server = createCrmMcpServer(adminContext);
      const res = await server.callTool('crm_gestionar_configuracion', {
        key: 'min_premium_order_value',
        value: 20000000,
      });

      expect(res.isError).toBe(false);
      const data = JSON.parse(res.content[0].text);
      expect(data.value).toBe(20000000);
    });
  });

  describe('13. Resolución de URL Pública de Vercel (Localhost Override)', () => {
    it('debe retornar la URL de Vercel aun cuando el origen sea localhost o 127.0.0.1', () => {
      expect(VERCEL_MCP_PRODUCTION_URL).toBe('https://crm-64yu.vercel.app');
      expect(getMcpPublicUrl('http://localhost:3000')).toBe('https://crm-64yu.vercel.app/api/mcp');
      expect(getMcpPublicUrl('http://127.0.0.1:3000')).toBe('https://crm-64yu.vercel.app/api/mcp');
      expect(getMcpPublicUrl('http://localhost:8080')).toBe('https://crm-64yu.vercel.app/api/mcp');
      expect(getMcpPublicUrl(undefined)).toBe('https://crm-64yu.vercel.app/api/mcp');
    });

    it('debe respetar el origen si ya es producción o un dominio personalizado', () => {
      expect(getMcpPublicUrl('https://crm-64yu.vercel.app')).toBe('https://crm-64yu.vercel.app/api/mcp');
      expect(getMcpPublicUrl('https://crm.firplak.com')).toBe('https://crm.firplak.com/api/mcp');
    });
  });
});
