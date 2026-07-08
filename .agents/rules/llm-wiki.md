---
trigger: always_on
---

El proyecto tiene un LLM Wiki en `wiki/` (base de conocimiento funcional del CRM, mantenida por el agente).

1. **Antes de responder preguntas o planear cambios** sobre la funcionalidad del CRM (módulos, comisiones, canales, sync, permisos, etc.), lee primero `wiki/INDEX.md` y luego SOLO las páginas relevantes. Ve al código únicamente si el wiki no basta.
2. **Después de completar cualquier cambio que altere la lógica de negocio, el modelo de datos o un módulo**, DEBES invocar el skill `llm-wiki-maintainer` antes de finalizar, para actualizar las páginas afectadas del wiki, el `INDEX.md` y el `LOG.md`.
