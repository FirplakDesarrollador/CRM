---
description: Workflow obligatorio del CRM que previene regresiones. Exige data-testid estables, actualización/creación de tests E2E con Playwright y ejecución de la suite antes de aceptar cambios en features, bugs o lógica crítica.
---

CRM Safe Change Protocol (Workspace)
Trigger

Se activa cuando:

Se agrega una feature

Se corrige un bug

Se modifica lógica existente

Se altera login, listados, filtros o formularios

Paso 1 — Identificar impacto

Determinar módulo afectado

Identificar si impacta UI, estado, auth o data fetching

Paso 2 — Garantizar testabilidad

Verificar que todos los elementos interactivos tengan data-testid

Si faltan, agregarlos con convención:

<modulo>-<elemento>-<accion>

Ejemplos:

accounts-search

accounts-table

accounts-edit-save

auth-submit

Prohibido usar clases CSS como selector.

Paso 3 — Protección E2E

Crear o actualizar test en /tests/e2e/

Si es bug → crear regression test

El test debe validar:

carga correcta

estados vacíos

comportamiento esperado

No depender de datos productivos específicos

Paso 4 — Validación obligatoria

Ejecutar:

npx playwright test

No se considera completo si hay fallos.

Paso 5 — Documentación (si aplica)

Si fue bug:

Documentar causa raíz

Confirmar qué test lo protege

Reglas

No refactorizar innecesariamente

No alterar UX solo para que el test pase

No romper auth

No introducir selectores frágiles