---
description: Validación completa de nuevas funcionalidades de la rama actual versus una rama base elegida por el usuario antes de la fusión.
---

# Workflow: Validación antes de Fusión (/validacion-fusion)

Este workflow guía al agente a través de un proceso exhaustivo y ordenado para validar los cambios de la rama actual frente a una rama base (indicada por el usuario), asegurando la estabilidad técnica, visual y funcional de la aplicación antes de realizar un merge.

## Pasos del Proceso

### Paso 1: Selección de la Rama de Comparación
1. **Interacción con el Usuario**: El agente debe preguntar explícitamente al usuario contra qué rama desea comparar los cambios de la rama actual (por ejemplo: `main` o `dev`).
2. **Obtener Rama Actual**: Determinar la rama de trabajo actual mediante:
   ```bash
   git branch --show-current
   ```

### Paso 2: Análisis de Diferencias y Archivos Afectados
1. Obtener la lista de commits nuevos en la rama de trabajo que no están en la rama de comparación:
   ```bash
   git log <rama-comparacion>..HEAD --oneline
   ```
2. Obtener la lista de archivos modificados:
   ```bash
   git diff <rama-comparacion>..HEAD --name-only
   ```
3. Identificar qué componentes, páginas, rutas o pruebas fueron modificados o agregados. Agrupar los cambios por módulos funcionales del CRM (ej. Cuentas, Contactos, Oportunidades, Actividades, Comisiones, etc.).

### Paso 3: Validación Técnica (Build y Pruebas Unitarias)
1. **Ejecutar Linting**: Validar que el código cumpla con los estándares de estilo del proyecto:
   ```bash
   npm run lint
   ```
2. **Ejecutar Compilación**: Compilar el proyecto en modo producción para detectar cualquier error de tipado o compilación estática de Next.js:
   ```bash
   npm run build
   ```
3. **Ejecutar Pruebas Unitarias Afectadas**: Si se han modificado archivos que tienen pruebas unitarias asociadas en la carpeta `pruebas unitarias/` o si el módulo correspondiente las tiene, ejecutar las pruebas mediante `vitest`:
   ```bash
   npx vitest run "pruebas unitarias/<nombre-modulo>.test.ts"
   ```
   *(Si el cambio es amplio o crítico, se recomienda ejecutar todas las pruebas unitarias: `npx vitest run`)*

### Paso 4: Validación Funcional E2E y Pruebas Visuales
1. **Pruebas de Integración E2E (Playwright)**: Si existen pruebas e2e específicas en la carpeta `e2e/` para los módulos alterados (por ejemplo, `create_account_wizard.spec.ts`), ejecutar Playwright:
   ```bash
   npx playwright test
   ```
2. **Exploración Visual Interactiva**: Si la rama tiene cambios visuales o interactivos en la interfaz, se debe iniciar un `browser_subagent` para comprobar que las funcionalidades nuevas y modificadas funcionen correctamente.
   - **Configuración del Servidor**: Verificar que el servidor local de desarrollo esté activo en `http://localhost:3000`. Si no está activo, iniciarlo con `npm run dev`.
   - **Instrucción al Browser Subagent**: Definir una tarea al subagente que indique expresamente:
     1. Navegar a la URL del módulo modificado.
     2. Realizar las acciones de usuario correspondientes (creación, edición, filtros, etc.) basándose en las nuevas funcionalidades identificadas en el Paso 2.
     3. Tomar capturas de pantalla de los estados clave.
     4. Retornar un reporte detallado con los hallazgos.

### Paso 5: Simulación de Fusión (Merge Check)
1. Antes de proceder, simular la fusión para anticipar conflictos utilizando:
   ```bash
   git merge-tree $(git merge-base HEAD <rama-comparacion>) HEAD <rama-comparacion>
   ```
   *(O alternativamente, previsualizar la fusión mediante una rama temporal o intentando un merge simulado sin confirmación)*:
   ```bash
   git merge --no-commit --no-ff <rama-comparacion>
   git merge --abort
   ```
2. Registrar cualquier posible conflicto de fusión que requiera resolución manual por parte del desarrollador.

### Paso 6: Generación del Reporte Consolidado
1. Crear un reporte de validación titulado `validation_report.md` en el directorio de la conversación actual (bajo `<appDataDir>\brain\<conversation-id>`).
2. El reporte debe estructurarse con la siguiente información:
   - **Resumen**: Rama actual vs. Rama de comparación, y número total de commits/archivos afectados.
   - **Archivos Modificados**: Tabla de archivos modificados organizada por módulo.
   - **Resultado de Compilación y Lint**: Estado del build (`npm run build`) y eslint.
   - **Resultado de Pruebas**: Resultados de pruebas unitarias (`vitest`) y e2e (`playwright`).
   - **Reporte Visual de E2E**: Detalle de los flujos validados por el `browser_subagent` y capturas de pantalla si aplica.
   - **Análisis de Conflictos**: Reporte sobre si el merge es directo o si hay conflictos previstos.
3. Presentar los resultados al usuario destacando si la validación fue exitosa o si se identificaron problemas que requieran corrección previa a la fusión.
