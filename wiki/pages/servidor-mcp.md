# Servidor MCP (Model Context Protocol)

El servidor MCP oficial de Firplak expone las operaciones del CRM a modelos de inteligencia artificial (Claude, ChatGPT, Antigravity, Cursor) mediante una interfaz estandarizada y segura. Opera con control estricto de roles y una política categórica de **cero borrado (no-delete)**.

## Arquitectura y Protocolo

- **Transporte Dual:**
  - **`stdio` (Local):** Ejecutable CLI en `bin/crm-mcp.ts` (con wrapper `bin/crm-mcp.mjs`), usado por clientes de escritorio (Claude Desktop, Cursor, Antigravity IDE).
  - **`HTTP/SSE` (Remoto):** Endpoint en `/api/mcp` (`https://crm-64yu.vercel.app/api/mcp`, implementado en `app/api/mcp/route.ts`) para integraciones remotas y ChatGPT Custom Actions, autenticando el usuario y rol vía token JWT de Supabase.
- **SDK Oficial:** Construido sobre `@modelcontextprotocol/sdk`.

## Política Estricta de Cero Borrado

El servidor no expone ninguna herramienta de borrado (`delete`, `eliminar`, `borrar`). Cualquier solicitud destructiva es rechazada a nivel de controlador. El ciclo de vida de los registros se gestiona exclusivamente mediante:
1. **Actualización de estado:** Para descartar una oportunidad se marca en estado `Perdida` con su `razon_perdida_id`. Para cuentas y contactos se marcan inactivos.
2. **Recuperación determinista (`crm_recuperar_*`):** Reactiva registros desarchivando (`is_deleted = false`), restaurando estados operativos y limpiando motivos de pérdida.

## Roles y Filtrado Dinámico de Catálogo

Para prevenir sobrecarga cognitiva y alucinaciones en los LLMs, el método `tools/list` filtra las herramientas dinámicamente según el rol autenticado:
- **`VENDEDOR`:** Herramientas de consulta, creación y edición acotadas a su propia cartera y agenda. No visualiza herramientas administrativas ni de reasignación.
- **`COORDINADOR`:** Acceso a toda la cartera de su equipo, reasignación de oportunidades y cuentas en cascada, y registro de clasificaciones y orígenes.
- **`ADMIN`:** Acceso integral incluyendo parámetros operativos de configuración (`CRM_Configuracion`).

## Recursos Nativos (`crm://`)

El servidor publica catálogos estáticos como recursos URI para que el LLM los consulte sin consumir llamadas a herramientas:
- `crm://canales`: Lista inmutable de los 5 canales de venta.
- `crm://fases/{canal_id}`: Etapas ordenadas con probabilidades por canal.
- `crm://clasificaciones-actividad`: Tipos de tareas y eventos.
- `crm://motivos-perdida`: Causales oficiales de descarte.
- `crm://origenes-oportunidad`: Procedencia de leads.
- `crm://metricas-embudo`: Resumen agregado en tiempo real del pipeline.

## Fuentes

- `lib/mcp/server.ts` (fábrica del servidor y registro de tools)
- `lib/mcp/permissions.ts` (control de acceso y bloqueo de borrado)
- `lib/mcp/database.ts` (catálogos y adaptador Supabase)
- `lib/mcp/resources.ts` (recursos nativos MCP)
- `lib/mcp/tools/` (controladores de oportunidades, cuentas, contactos, actividades y parámetros)
- `bin/crm-mcp.ts` y `bin/crm-mcp.mjs` (entrypoints CLI stdio)
- `app/api/mcp/route.ts` (endpoint HTTP/SSE para ChatGPT y web)
- `docs/mcp/INSTALACION_Y_USO.md` (manual de configuración)
- `tests/crm-mcp.test.ts` (suite de pruebas QA)
