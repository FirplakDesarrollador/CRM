# Guía Oficial de Instalación y Uso: Servidor MCP CRM FIRPLAK

El servidor MCP (**Model Context Protocol**) del CRM FIRPLAK permite a modelos de IA (Claude, ChatGPT, Antigravity, Cursor, etc.) interactuar de forma segura y estructurada con el ecosistema comercial.

---

## 🔒 Garantías de Seguridad y Reglas de Negocio
1. **Política Estricta Cero Borrado (*No-Delete*)**: No existe ninguna herramienta destructiva ni de borrado físico en el protocolo. Todo descarte se realiza actualizando estados (`Perdida`, `Inactiva`) o reactivando vía `recuperar`.
2. **Aislamiento por Rol**:
   - **VENDEDOR**: Solo visualiza y gestiona sus propias oportunidades y tareas; ve catálogos en solo lectura.
   - **COORDINADOR**: Supervisa la cartera de su equipo, reasigna oportunidades/cuentas y gestiona clasificaciones.
   - **ADMINISTRADOR**: Acceso total al catálogo y parámetros operativos (`CRM_Configuracion`).
3. **Presupuesto de Contexto**: Búsquedas paginadas (`limit` máx. 30) y respuestas compactas para no saturar los tokens del modelo.

---

## 🚀 Métodos de Instalación

### 1. Claude Desktop
Edita tu archivo de configuración de Claude Desktop:
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Agrega el servidor dentro de la clave `mcpServers`:

```json
{
  "mcpServers": {
    "crm-firplak": {
      "command": "node",
      "args": [
        "C:\\Users\\isaza\\OneDrive\\Documentos\\CRM FIRPLAK\\CRM\\bin\\crm-mcp.mjs"
      ],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://lnphhmowklqiomownurw.supabase.co",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": "TU_ANON_KEY_AQUI",
        "SUPABASE_SERVICE_ROLE_KEY": "TU_SERVICE_ROLE_KEY_AQUI",
        "CRM_USER_EMAIL": "asesor.comercial@firplak.com",
        "CRM_USER_ROLE": "VENDEDOR"
      }
    }
  }
}
```

> [!TIP]
> Para probar como Coordinador o Administrador, cambia `"CRM_USER_ROLE": "COORDINADOR"` o `"ADMIN"`.

---

### 2. Antigravity IDE (Gemini CLI / AGY)
En tu configuración de MCP (`mcp_config.json` en tu carpeta de usuario o proyecto):

```json
{
  "mcpServers": {
    "crm-firplak": {
      "command": "node",
      "args": ["bin/crm-mcp.mjs"],
      "cwd": "C:\\Users\\isaza\\OneDrive\\Documentos\\CRM FIRPLAK\\CRM",
      "env": {
        "CRM_USER_ROLE": "COORDINADOR"
      }
    }
  }
}
```

---

### 3. Cursor / Windsurf
Crea o edita `.cursor/mcp.json` en la raíz de tu espacio de trabajo:

```json
{
  "mcpServers": {
    "crm-firplak": {
      "command": "node",
      "args": ["bin/crm-mcp.mjs"],
      "env": {
        "CRM_USER_ROLE": "ADMIN"
      }
    }
  }
}
```

---

### 4. ChatGPT (Custom GPTs / Actions / Endpoint Remoto)
El CRM expone un endpoint HTTP/SSE en `/api/mcp` que funciona con Custom GPT Actions o pasarelas de agentes.

- **URL de la API**: `https://crm-64yu.vercel.app/api/mcp`
- **Métodos soportados**:
  - `GET /api/mcp`: Retorna el manifiesto de herramientas y recursos disponibles.
  - `POST /api/mcp`: Acepta llamadas JSON-RPC 2.0 estándar (`tools/call`, `tools/list`, `resources/read`) o `{ tool: "...", args: { ... } }`.
- **Autenticación**: Encabezado `Authorization: Bearer <token_jwt_supabase>` para resolver automáticamente el comercial autenticado.

---

## 📋 Catálogo de Herramientas y Recursos

### Oportunidades
- `crm_buscar_oportunidades`: Búsqueda paginada con filtros por canal, fase y texto.
- `crm_consultar_oportunidad`: Detalle con contactos y cotizaciones asociadas.
- `crm_crear_oportunidad`: Crea oportunidad validando canal y fase con control de duplicados.
- `crm_actualizar_oportunidad`: Actualiza montos, fases o marca pérdida con motivo.
- `crm_recuperar_oportunidad`: Restaura negocios descartados o archivados al pipeline activo.
- `crm_reasignar_oportunidad`: Reasigna responsable (Coordinador / Admin).

### Cuentas y Clientes
- `crm_buscar_cuentas`: Búsqueda por NIT o razón social.
- `crm_consultar_cuenta`: Detalle con sucursales, contactos y negocios activos.
- `crm_crear_cuenta`: Crea cliente con canal obligatorio y NIT provisorio automático.
- `crm_actualizar_cuenta`: Modifica datos de contacto y nivel premium.
- `crm_recuperar_cuenta`: Reactiva cuentas inactivas.
- `crm_reasignar_cuenta_cascada`: Reasigna cuenta y todas sus oportunidades en cascada.

### Contactos
- `crm_listar_contactos`: Contactos de una cuenta o por filtro.
- `crm_consultar_contacto`: Detalle del contacto.
- `crm_crear_contacto`: Crea persona asociada a cuenta.
- `crm_actualizar_contacto`: Actualiza datos o marca contacto principal.
- `crm_recuperar_contacto`: Reactiva contactos archivados.

### Actividades y Agenda
- `crm_agenda_diaria`: Consulta rápida de tareas y compromisos para el día de hoy.
- `crm_listar_actividades`: Filtros por estado (`pendientes`, `vencidas`, `completadas`).
- `crm_consultar_actividad`: Detalle de tarea o evento.
- `crm_crear_actividad`: Programa actividad con autogeneración de asunto.
- `crm_actualizar_actividad`: Marca completada o reprograma fechas.
- `crm_recuperar_actividad`: Reabre actividades cerradas.

### Parámetros y Configuración
- `crm_gestionar_clasificacion`: Nueva clasificación de actividad (Coordinador / Admin).
- `crm_gestionar_origen`: Nuevo origen de oportunidad (Coordinador / Admin).
- `crm_gestionar_configuracion`: Parámetros operativos del sistema (Admin).

### Recursos Nativos URI (`crm://`)
- `crm://canales`: Lista inmutable de canales y listas de precios.
- `crm://fases/{canal_id}`: Etapas ordenadas con probabilidades por canal.
- `crm://clasificaciones-actividad`: Tipos de actividad.
- `crm://motivos-perdida`: Motivos de pérdida estandarizados.
- `crm://origenes-oportunidad`: Catálogo de procedencia de leads.
- `crm://metricas-embudo`: Totales agregados de oportunidades por fase.
