---
trigger: always_on
---

Tras completar cualquier mejora funcional, corrección de bug relevante o nueva funcionalidad en el CRM Firplak, DEBES evaluar el skill `mapywork-update` (`.agents/skills/mapywork-update/SKILL.md`) para determinar bajo sus 3 premisas estrictas si el cambio amerita actualizar los flujos del entorno **FIRPLAK** (prioritariamente área de **Ventas**) en mapywork mediante el servidor MCP `vibeworkflow`.

- Si NO cumple las 3 premisas, descártalo brevemente sin invocar mutaciones en el MCP.
- Si SÍ cumple las 3 premisas, consulta contexto en solo lectura (`search_knowledge`, `search_flows`, `search_nodes`) y presenta la propuesta al usuario. **NUNCA** ejecutes mutaciones en el MCP `vibeworkflow` sin aprobación explícita del usuario.
