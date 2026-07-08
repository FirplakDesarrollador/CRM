---
description: Revisión de salud del LLM Wiki - detecta contradicciones, contenido obsoleto y enlaces rotos
---

Este workflow ejecuta la operación LINT del LLM Wiki (`wiki/`), definida en `wiki/SCHEMA.md`.

1. Lee `wiki/INDEX.md` y verifica que cada página listada exista en `wiki/pages/` y que cada página existente esté listada (sin huérfanas).
2. Recorre las páginas y extrae todos los enlaces `[[slug]]`; reporta los que no tienen página, clasificándolos como "pendiente legítimo" (ej. módulo en construcción) o "enlace roto".
3. Para cada página, contrasta 2-3 afirmaciones clave contra el código actual (rutas en `app/`, hooks en `lib/`, migraciones en `supabase/migrations/`). Marca lo obsoleto.
4. Busca contradicciones entre páginas (ej. permisos descritos distinto en dos páginas).
5. Corrige los problemas menores directamente; para los mayores, lista qué páginas necesitan re-ingest y pide confirmación.
6. Registra el resultado del lint como entrada nueva en `wiki/LOG.md` (fecha, hallazgos, correcciones aplicadas).
