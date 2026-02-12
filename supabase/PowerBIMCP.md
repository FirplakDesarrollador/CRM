# Power BI MCP en Antigravity (Setup + Uso)

## Objetivo
Conectar Antigravity a Power BI mediante MCP para:
- Consultar modelos semánticos (Remote MCP server)
- (Opcional) Hacer cambios de modelado / DAX / operaciones masivas (Modeling MCP server)

---

## 1) Dónde se configura en Antigravity
1. Abre el panel del Agent (⋯)
2. MCP Servers
3. Manage MCP Servers
4. View raw config
5. Edita el archivo `mcp_config.json` y vuelve a Antigravity → Refresh

Referencia del flujo y ejemplo de estructura JSON en Antigravity:
- "Manage MCP Servers" → "View raw config" → editar `mcp_config.json` :contentReference[oaicite:1]{index=1}

---

## 2) Opción A (Recomendada): Remote Power BI MCP Server (solo consulta)
### Qué hace
Permite a agentes consultar un modelo semántico existente: obtener esquema, generar DAX y ejecutar consultas.

### Endpoint
- https://api.fabric.microsoft.com/v1/mcp/powerbi :contentReference[oaicite:2]{index=2}

### Config para `mcp_config.json`
Agrega esto (o fusiona con lo que ya tengas):

{
  "mcpServers": {
    "powerbi-remote": {
      "type": "http",
      "url": "https://api.fabric.microsoft.com/v1/mcp/powerbi"
    }
  }
}

> Microsoft muestra este mismo patrón de configuración (type=http + url). :contentReference[oaicite:3]{index=3}

### Cómo probar rápido
En el chat del agente:
- “Conéctate al modelo semántico con ID: <MODEL_ID>”
- “¿Qué tablas hay en este modelo?”
- “Dame top 10 productos por ventas”

(Para esto necesitas el Model ID del dataset/semantic model en Power BI.)

---

## 3) Opción B: Power BI Modeling MCP Server (modelado / cambios)
### Qué hace
Servidor local para tareas de modelado: crear/editar tablas/medidas/relaciones, validar DAX, operaciones masivas, etc. :contentReference[oaicite:4]{index=4}

### Repo oficial
- microsoft/powerbi-modeling-mcp :contentReference[oaicite:5]{index=5}

### Config típica (STDIO) para `mcp_config.json`
Ejemplo basado en el README (ajusta la ruta al .exe y variables):

{
  "mcpServers": {
    "powerbi-modeling-mcp": {
      "type": "stdio",
      "command": "C:\\RUTA\\powerbi-modeling-mcp.exe",
      "args": ["--start", "--skipconfirmation"],
      "env": {
        "PBI_MODELING_MCP_ACCESS_TOKEN": "PEGAR_ACCESS_TOKEN"
      }
    }
  }
}

> Ojo con `--skipconfirmation`: auto-aprueba escrituras; úsalo solo si tienes backups. :contentReference[oaicite:6]{index=6}

---

## 4) Buenas prácticas (para evitar líos)
- Usa Remote MCP para **consulta** y Modeling MCP solo cuando realmente necesites **cambios**.
- Evita exponer datos sensibles en prompts o logs.
- Antes de operaciones de modelado, crea backup del modelo (PBIX/PBIP/Fabric).

---

## 5) Prompts útiles (para Antigravity)
- “Dame el esquema del modelo y sugiere medidas DAX para: margen, crecimiento YoY, ticket promedio.”
- “Genera una consulta DAX que devuelva ventas por canal y mes, últimos 12 meses.”
- (Modeling) “Crea medidas con nombres estándar y valida dependencias; lista errores.”
