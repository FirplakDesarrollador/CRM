# Servidor MCP (Model Context Protocol)

El servidor MCP oficial de Firplak expone las operaciones del CRM a modelos de inteligencia artificial (Claude, ChatGPT, Antigravity, Cursor) mediante una interfaz estandarizada y segura. Opera con control estricto de roles y una política categórica de **cero borrado (no-delete)**.

## Arquitectura y Protocolo

- **Transporte Dual:**
  - **`stdio` (Local):** Ejecutable CLI en `bin/crm-mcp.ts` (con wrapper `bin/crm-mcp.mjs`), usado por clientes de escritorio (Claude Desktop, Cursor, Antigravity IDE).
  - **`HTTP/SSE` (Remoto):** Endpoint en `/api/mcp` (`https://crm-64yu.vercel.app/api/mcp`, implementado en `app/api/mcp/route.ts`) para integraciones remotas y ChatGPT Custom Actions. El acceso durable usa un token personal MCP no expirante; el JWT de Supabase solo sirve como acceso temporal y para gestionar ese token. La UI de configuración (`components/config/McpIntegrationCard.tsx`) permite generarlo, copiarlo y regenerarlo mediante `lib/mcp/token.ts`.
- **SDK Oficial:** Construido sobre `@modelcontextprotocol/sdk`.

## Política Estricta de Cero Borrado

El servidor no expone ninguna herramienta de borrado (`delete`, `eliminar`, `borrar`). Cualquier solicitud destructiva es rechazada a nivel de controlador. El ciclo de vida de los registros se gestiona exclusivamente mediante:
1. **Actualización de estado:** Para descartar una oportunidad se marca en estado `Perdida` con su `razon_perdida_id`. Para cuentas y contactos se marcan inactivos.
2. **Recuperación determinista (`crm_recuperar_*`):** Reactiva registros desarchivando (`is_deleted = false`), restaurando estados operativos y limpiando motivos de pérdida.

## Conexión de Datos Fail-Closed

En Production y Preview el MCP exige `SUPABASE_SERVICE_ROLE_KEY` para operar sobre Supabase. La clave pública `anon` no se usa como sustituto para consultas administrativas. Si falta la configuración o Supabase devuelve un error, la herramienta informa que la base no está disponible; los registros sembrados de memoria solo se habilitan durante pruebas o mediante `MCP_ALLOW_MEMORY_FALLBACK=true` de forma explícita.

Las respuestas de agenda y búsquedas están paginadas con un máximo de 30 filas para evitar saturar el contexto del agente.

## Token Personal Permanente

La UI de Configuración genera un token MCP personal con prefijo `mcp_pat_`. No tiene fecha de expiración y está vinculado al usuario autenticado. Supabase Auth conserva únicamente el hash SHA-256 en `app_metadata`; el valor original se muestra una sola vez al generarlo. Al regenerar o revocar el token, el anterior deja de autenticar inmediatamente. Los JWT de sesión continúan disponibles solo como acceso temporal y como autorización para gestionar el token personal.

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
- `lib/mcp/token.ts` (extracción y formateo de tokens de sesión para autenticación remota)
- `lib/mcp/tools/` (controladores de oportunidades, cuentas, contactos, actividades y parámetros)
- `bin/crm-mcp.ts` y `bin/crm-mcp.mjs` (entrypoints CLI stdio)
- `app/api/mcp/route.ts` (endpoint HTTP/SSE para ChatGPT y web)
- `components/config/McpIntegrationCard.tsx` (tarjeta y modal de configuración con generador/copiado de token)
- `docs/mcp/INSTALACION_Y_USO.md` (manual de configuración)
- `tests/crm-mcp.test.ts` (suite de pruebas QA)
- `tests/mcp-token.test.ts` (pruebas unitarias de tokens y autorización Bearer)
