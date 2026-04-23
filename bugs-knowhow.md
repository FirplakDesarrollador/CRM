# Bugs & Known Issues (Know-how)

## 1. React Hook Form - Pérdida de Estado en Pestañas
**Problema:** Al usar renderizado condicional para pestañas (e.g. `{activeTab === 'info' && <form>...}`) dentro de un componente que usa `useForm`, RHF desmonta y "desregistra" (unregisters) los campos por defecto. Si el usuario escribe en un campo, cambia de pestaña y vuelve, sus cambios se pierden.
**Síntoma:** El usuario reporta que "no se guardan los comentarios" o cambios en ciertos campos si navega por el formulario antes de dar clic en Guardar.
**Solución:** 
- Opción A (Recomendada): Usar `shouldUnregister: false` en la configuración de `useForm`.
- Opción B: Ocultar las pestañas usando CSS (`hidden` o `display: none`) en lugar de eliminarlas del DOM.
**Archivos afectados:** `components/cuentas/AccountForm.tsx`, `app/oportunidades/nueva/CreateOpportunityWizard.tsx` (Corregidos con `shouldUnregister: false`).

## 2. Sync Engine - LWW Metadata Conflicts
**Problema:** Si se realizan actualizaciones manuales en la DB con un timestamp (`ts`) muy alto en el futuro, el RPC de sincronización rechazará actualizaciones legítimas del cliente porque su timestamp será menor (`v_ts > v_last_ts`).
**Solución:** Asegurarse de usar timestamps realistas en pruebas manuales o resetear los metadatos de sincronización si se brickean registros.

---

## 3. Lucide-React - Componentes Undefined (Missing Imports)
**Problema:** El uso de iconos de `lucide-react` en componentes JSX sin la correspondiente declaración en el bloque de `import` causa un error crítico `TypeError: Cannot read properties of undefined (reading 'render')` o "client-side exception".
**Contexto:** Sucedió al refactorizar el módulo de Pedidos al añadir el icono `Receipt`.
**Regra de Prevención:** Siempre verificar el bloque de `import` al copiar/pegar o añadir nuevos iconos de Lucide. Usar el linter si está disponible para detectar variables no definidas.

## 4. JSX Syntax Errors - Stray Tokens ('v>')
**Problema:** Durante operaciones de edición masiva de archivos (replace_file_content), pueden quedar tokens residuales (como `v>`) que rompen el árbol de sintaxis de Next.js.
**Contexto:** `app/pedidos/page.tsx` falló al compilar por un token residual al cerrar un `div`.
**Regra de Prevención:** Revisar siempre el diff generado por las herramientas de edición y validar que las etiquetas de cierre `</div>` sean coherentes y no contengan texto basura.

## 5. Lógica de Negocio - Duplicidad de Datos y Cálculos Financieros
**Problema:** En el módulo de pedidos, se mostraban datos redundantes (Pedido SAP igual a COT) y valores monetarios incorrectos al heredar el total de la cotización madre para pedidos parciales.
**Contexto:** Los pedidos en estado `PLANEADO` deben calcular su total sumando los items locales (`CRM_PedidoItems`) en lugar de usar el total de la cotización, ya que una cotización puede generar múltiples pedidos parciales.
**Solución:** Implementar un mapeo dinámico de items por pedido y aplicar sumatoria local con parseo de moneda colombiana (manejo de puntos y comas).
**Regra de Prevención:** Nunca asumir que el valor de una entidad hija (Pedido) es igual al de la entidad padre (Cotización) sin validar la granularidad del dato.

## 6. Sincronización de Búsqueda - Bucle Infinito de Router
**Problema:** El uso de `useEffect` para sincronizar un estado local (ej. `search`) con la URL mediante `router.replace` o `router.push`, teniendo a `searchParams` como dependencia del efecto sin una validación de cambio real.
**Síntoma:** La terminal del servidor se llena de peticiones `GET /ruta 200` constantes (spam de logs). El rendimiento se degrada y el navegador realiza peticiones RSC sin parar.
**Causa:** `router.replace` actualiza la URL -> Next.js genera un nuevo objeto `searchParams` -> El `useEffect` detecta el cambio de objeto y se vuelve a disparar -> Se llama de nuevo a `router.replace`... creándose un ciclo infinito.
**Solución:** Siempre validar que el estado generado sea diferente al actual de la URL antes de ejecutar el reemplazo:
```tsx
const queryString = params.toString();
if (queryString === searchParams.toString()) return;
router.replace(...);
```
**Archivos afectados:** `app/pedidos/page.tsx`, `app/cuentas/page.tsx`, `app/oportunidades/page.tsx`.

## 7. Marcadores de Diff Residuales ('+')
**Problema:** Inclusión accidental de caracteres `+` al inicio de las líneas durante operaciones de edición de código (ej. `multi_replace_file_content`), lo que provoca errores de "Expression expected".
**Contexto:** Sucedió en `app/oportunidades/page.tsx` al intentar aplicar la corrección del bucle infinito.
**Regra de Prevención:** Revisar meticulosamente que no queden restos de sintaxis de diff en el archivo final. Las herramientas de edición deben usarse sobre bloques limpios.

## 8. Interfaces de DB Desincronizadas (LocalPedido)
**Problema:** Errores de TypeScript: "Property '...' does not exist on type 'LocalPedido'".
**Causa:** Se acceden a campos provenientes de integraciones (SAP) como `EXTRA_Gran Total`, `currency_id` o `responsible` que han sido mapeados en el flujo de datos pero no declarados en la interfaz de Dexie en `lib/db.ts`.
**Solución:** Actualizar las interfaces en `lib/db.ts` para que reflejen todos los campos opcionales que se manejan en la UI o en los procesos de cálculo.
**Regra de Prevención:** Antes de usar un nuevo campo de SAP o de sincronización, validar que esté definido en la interfaz correspondiente en `lib/db.ts`.

---

## [Bug ID: 20260423-01]

Context:
`lib/sync.ts`, `lib/hooks/usePedidos.ts` y `app/pedidos/page.tsx`. Los pedidos de venta (pedidos) no aparecían en la versión desplegada o se veían con campos vacíos.

What I Did:
Diagnostiqué la visibilidad de los pedidos y el mapeo de campos SAP.

Problem:
1. Los pedidos no se veían en absoluto para usuarios autenticados.
2. Los campos provenientes de SAP (EXTRA_...) se veían vacíos en la UI.
3. Al actualizar un pedido, ciertos campos (muestra, flete, etc.) no se guardaban en el servidor.

Root Cause:
1. **RLS (Supabase)**: La tabla `CRM_Pedidos` tenía RLS activado pero NO tenía políticas definidas, bloqueando cualquier consulta de usuarios `authenticated`.
2. **Mapeo Inverso**: El `SyncEngine` descargaba los campos con prefijo `EXTRA_` pero no los mapeaba a los nombres internos (friendly names) usados por la UI.
3. **Mapeo Incompleto**: El hook `usePedidos.ts` no incluía todos los campos SAP en su mapeo de salida hacia el servidor.

Fix Applied:
1. Se añadió política RLS "Permissive All" a `CRM_Pedidos`.
2. Se implementó el mapeo inverso en `SyncEngine.pullChanges` para `CRM_Pedidos`.
3. Se completó el `sapMapping` en `usePedidos.ts` para incluir todos los campos de negocio (muestra, incoterm, flete, etc.).

Prevention Rule:
1. **RLS**: Al crear una tabla nueva en Supabase, verificar SIEMPRE las políticas de RLS para el rol `authenticated`. Si no hay políticas, la tabla será invisible.
2. **Sync Mapping**: Si una entidad usa nombres de columna diferentes entre el servidor (legacy/SAP) y el cliente, el mapeo debe ser bidireccional (Push y Pull).
3. **Coherencia de Interfaces**: Asegurar que `LocalPedido` en `lib/db.ts` coincida con el mapeo en `usePedidos.ts` y `sync.ts`.

Tags:
[sync] [visibility] [rls] [sap-mapping] [pedidos]
