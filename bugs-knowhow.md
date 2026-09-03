# Bugs & Known Issues (Know-how)

## 0. React Hook Form + Disabled HTML Elements & Zod Validation Lock
**Problema:** Al deshabilitar elementos HTML (`disabled={true}`) en React Hook Form (por ejemplo para bloquear edición de cuentas existentes vinculadas), el estándar HTML omite los valores de elementos deshabilitados durante el submit (`undefined` o `""`). Si el esquema de Zod tiene validación obligatoria (`.min(1)`), se produce un falso positivo de validación imposible de corregir por el usuario (e.g. "Subclasificación requerida", "Canal requerido").
**Síntoma:** El usuario ve un campo bloqueado con un valor visible, pero al enviar el formulario aparece un mensaje rojo de error diciendo que el campo es requerido y el formulario no se envía.
**Solución Definitiva:**
1. Los esquemas Zod en formularios híbridos o rápidos no deben exigir `.min(1)` para campos condicionales o potencialmente bloqueados; deben ser `z.string().optional().nullable()`.
2. En `onSubmit`, resolver el valor con fallback determinístico (e.g., `data.subclasificacion_id || selectedAccount?.subclasificacion_id || defaultSubclassId`).
3. No deshabilitar el input (`disabled`), sino permitir su edición fluida o usar `readOnly` si se desea evitar edición sin perder el valor en RHF.
**Archivos Afectados:** `components/tiendas/CreateStoreSaleForm.tsx`.

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

### Missing Pedidos and Fields Mapping (`EXTRA_`)
**Issue:** Sales orders were not showing up in the frontend list despite the Supabase payload returning valid data. Moreover, `EXTRA_Gran Total` and other `EXTRA_` fields coming from SAP were not mapped correctly.
**Resolution Date:** 2026-04-23
**Root Cause:** The `Dexie` IndexedDB schema (`lib/db.ts`) expected certain fields like `status` and `salesOrderNumber`, while Supabase (`CRM_Pedidos`) returned `estado_pedido`, `sales_order_number`. The pull logic mapped `id` instead of using the local `uuid_generado`. Furthermore, SAP `EXTRA_` fields required specific parsing from the payload map to the frontend.
**Fix:**
- Updated `pullChanges` in `lib/sync.ts` for `CRM_Pedidos` to map `id` to `uuid_generado` and standardizing status to `estado_pedido`.
- Fixed the map logic for SAP `EXTRA_` fields.

### Lost Pedido Item Quantities on Edit
**Issue:** Modifying the product quantities of a "Pedido" inside a Quote did not persist the changes to the local Dexie DB nor queue them to Supabase via SyncEngine.
**Resolution Date:** 2026-04-23
**Root Cause:** In `components/quotes/PedidosEditor.tsx`, the `onSubmit` handler for updating an existing `Pedido` only updated the logistical fields (`pedData`) using `updatePedido`. The array containing the updated quantities (`itemsToSave`) was completely ignored because the `usePedidos.ts` hook lacked an `updatePedidoItems` method to process differential array changes.
**Fix:** 
- Added `updatePedidoItems` to `usePedidos.ts` to smartly calculate differential changes (inserts, updates, deletes) against `db.pedidoItems` and correctly queue each mutation to `CRM_PedidoItems`.
- Connected `updatePedidoItems` into the `onSubmit` function in `PedidosEditor.tsx`.
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

## [Bug ID: 20260423-02]

Context:
`lib/sync.ts`, `app/configuracion/page.tsx` y RPC `process_field_updates`. Falla silenciosa y bloqueo en la sincronización de pedidos debido a campos con caracteres especiales y mal manejo de errores en la UI.

What I Did:
Corregí la generación de SQL dinámico en el RPC y arreglé la UI de configuración para que muestre los ítems pendientes aún cuando haya errores.

Problem:
1. Al crear un pedido, este no subía al servidor y causaba una violación de Foreign Key (FK) para sus `CRM_PedidoItems`.
2. La UI de Sincronización ocultaba los ítems en cola (`pendingCount`) cuando se presentaba el mensaje rojo de error, dejando al usuario ciego sobre qué estaba fallando.

Root Cause:
1. **Dynamic SQL Injection Risk / Syntax Error**: El RPC `process_field_updates` no utilizaba `quote_ident()` para los nombres de las columnas. Dado que los pedidos incluyen campos que mapean a SAP como `EXTRA_Incoterm/Incoterm` (los cuales contienen el caracter `/`), la sentencia `INSERT` generaba un error de sintaxis en PostgreSQL (`syntax error at or near "/"`).
2. **Cascading FK Failure**: Como el `INSERT` del pedido fallaba (y era rechazado por la base de datos), el SyncEngine procedía a insertar los ítems asociados (`CRM_PedidoItems`). Al no existir el pedido padre, la base de datos rechazaba los ítems por violación de llave foránea.
3. **UI Logic Error**: El bloque JSX en `app/configuracion/page.tsx` evaluaba `{!error && pendingCount > 0 && (...) }`, haciendo que el componente entero que muestra la cola y el resumen de los ítems desapareciera si `error` era `true`.

Fix Applied:
1. **Database Migration**: Se aplicó la migración `20260423050213_fix_process_field_updates_quotes.sql` que envuelve todos los identificadores (columnas y tablas) con `quote_ident(%I)` dentro de la función de Supabase.
2. **UI Correction**: Se eliminó la negación `!error` de la condición de renderizado en `app/configuracion/page.tsx` para permitir que el error coexista con la vista detallada de los ítems atascados en la cola.

Prevention Rule:
1. **Dynamic SQL Escaping**: Siempre que se construya SQL dinámico en PL/pgSQL, se DEBE usar `quote_ident()` (o el especificador de formato `%I` en `format()`) para cualquier nombre de columna o tabla que provenga de una variable. Esto previene errores de sintaxis y ataques de inyección SQL, especialmente cuando se mapean campos de terceros (SAP) con convenciones inusuales.
2. **UI Error Handling UX**: Nunca ocultar información de diagnóstico (como la cola de sincronización o elementos pendientes) ante la aparición de un error general. El usuario necesita ver el error y el contexto (qué ítems lo causaron) simultáneamente.
3. **Sync Engine Execution Order**: Confirmar siempre que las relaciones Padre-Hijo se ejecuten en orden dentro de `lib/sync.ts` (a través de `TABLE_PRIORITY`) para que los fallos del padre sean la causa raíz comprobable, no la falla secundaria del hijo.

Tags:
[sync] [sql] [rpc] [ui-ux] [foreign-key] [escaping]

## [Bug ID: 20260423-03]

Context:
`lib/hooks/usePedidos.ts`. Error de TypeScript al intentar pasar un posible valor `undefined` a `syncEngine.queueMutation`.

What I Did:
Corregí el error de tipo añadiendo un guard clause (if check).

Problem:
`Argument of type 'LocalPedidoItem | undefined' is not assignable to parameter of type 'Record<string, any>'.`

Root Cause:
El método `db.pedidoItems.get(id)` de Dexie puede devolver `undefined` si el registro no existe (o si hay una race condition), pero la función de sincronización requiere un objeto literal.

Fix Applied:
Se añadió un check `if (updated) { ... }` antes de llamar a la sincronización.

Prevention Rule:
1. **Defensive Database Reads**: Siempre que se lea de Dexie con `.get()`, se debe validar la existencia del objeto antes de procesarlo o pasarlo a funciones que esperan tipos no nulos (como `queueMutation`).
2. **Type Safety en Hooks**: Revisar los retornos de promesas de base de datos en los hooks de negocio para asegurar que el flujo maneje estados nulos o indefinidos.

Tags:

---

## [Bug ID: 20260423-04]

Context:
`components/config/PriceListUploader.tsx`. Fallo en la importación de precios desde Excel.

What I Did:
Implementé limpieza de cabeceras y un sistema de validación de números sensible a la configuración regional (Colombia).

Problem:
Los precios se cargaban como 0 o fallaba el mapeo de columnas a pesar de que el archivo Excel parecía correcto.

Root Cause:
1. **Espacios en Cabeceras**: Los nombres de las columnas en Excel tenían espacios invisibles (ej: `"Número de artículo "`), lo que impedía que `normalizedRow['Número de artículo']` encontrara el valor.
2. **Formato Numérico Local**: Los archivos en Colombia usan puntos para miles y comas para decimales (o viceversa dependiendo de la exportación). Un `parseFloat` simple no manejaba correctamente strings como `"1.250.000,00"`.

Fix Applied:
1. Se aplicó `.trim()` a todas las llaves (keys) durante el mapeo de filas de Excel.
2. Se implementó una función `parseNumber` robusta que detecta dinámicamente si la coma o el punto es el separador decimal comparando su última posición en la cadena.

Prevention Rule:
1. **Excel Header Sanitization**: Siempre aplicar `.trim()` a las cabeceras de archivos externos (Excel/CSV) antes de intentar mapearlas a objetos de negocio.
2. **Locale-Aware Number Parsing**: En aplicaciones para el mercado latinoamericano, nunca usar `parseFloat` directo sobre inputs de texto sin antes normalizar los separadores de miles y decimales.

Tags:
[excel] [parsing] [localization] [sanitization]

## [Bug ID: 20260423-05]

Context:
Edición de código con `multi_replace_file_content` en `PriceListUploader.tsx`.

What I Did:
Intenté realizar múltiples ediciones en un solo paso y borré accidentalmente la cabecera de una función.

Problem:
El código quedó con un error de sintaxis ("Expression expected") porque la declaración de `const handleFileUpload = ...` desapareció del archivo.

Root Cause:
Error de alineación en el bloque de `TargetContent`. Al reemplazar bloques grandes, es fácil omitir o incluir accidentalmente una línea de cierre o apertura si no se verifica el diff inmediatamente.

Fix Applied:
Restauración manual de la firma de la función mediante `replace_file_content`.

Prevention Rule:
1. **Post-Edit Verification**: Tras una edición masiva (`multi_replace`), es MANDATORIO realizar un `view_file` del área afectada para confirmar que las firmas de las funciones y los cierres de llaves sigan intactos.
2. **Chunk Granularity**: Preferir reemplazos más pequeños y específicos sobre reemplazos de bloques gigantescos que incluyan lógica de control de flujo.

Tags:
[tool-usage] [syntax-error] [refactoring]

## [Lección General: Limpieza de Esquema]

Context:
Optimización de tablas en Supabase (`CRM_Pedidos`, `CRM_ListaDePrecios`).

Observation:
Columnas que parecen "huérfanas" o "legacy" según el código actual (ej: `company`, `opportunity`, `fCreado`) suelen contener datos históricos críticos de migraciones previas o campos necesarios para integraciones de terceros (SAP).

Prevention Rule:
**Data-First Auditing**: Nunca eliminar una columna basándose solo en su falta de uso en el código fuente. Siempre ejecutar una consulta SQL para verificar si hay datos poblados (`count(*) where col is not null`) y validar si son parte de un flujo de sincronización externo antes de proponer un `DROP COLUMN`.

Tags:
[database] [migration] [data-integrity] [schema]

---

## [Bug ID: 20260428-01]

Context:
`AccountCombobox.tsx`, `OpportunityCombobox.tsx`. Visualización de registros seleccionados que no están en la primera página de resultados del servidor.

What I Did:
Intenté resolver el nombre de la cuenta usando solo la lista devuelta por `useAccountsServer`.

Problem:
Si el ID de la cuenta/oportunidad seleccionada no estaba entre los primeros 20 resultados (pageSize), el componente mostraba "Seleccione una cuenta..." o quedaba vacío, a pesar de que el valor estaba presente en el formulario.

Root Cause:
Los hooks de servidor (`useAccountsServer`) están paginados. El componente visual realizaba un `.find()` sobre los datos actuales, ignorando que el registro seleccionado podía estar en páginas posteriores o no haber sido cargado aún.

Fix Applied:
1. Se añadió la prop `initialLabel` para permitir al padre pasar el nombre si ya lo conoce.
2. Se implementó una resolución reactiva que prioriza el `initialLabel` y, de forma secundaria, busca en la lista cargada.

Prevention Rule:
**Combobox Pagination Support**: Cuando se use un Combobox paginado con datos del servidor, NUNCA depender únicamente de la lista local de resultados para mostrar la etiqueta del valor seleccionado. Siempre se debe permitir al componente recibir una etiqueta inicial (`initialLabel`) o realizar un fetch puntual por ID para resolver el nombre del registro seleccionado si no está en la página actual.

Tags:
[ui] [combobox] [pagination] [server-state]

## [Bug ID: 20260428-02]

Context:
`AccountCombobox.tsx`. Implementación de fetch asíncrono dentro de un componente de UI genérico.

What I Did:
Añadí un `useEffect` con un bloque `try/catch` que consultaba Supabase/Dexie por ID cada vez que cambiaba el valor.

Problem:
El componente se quedaba en un estado de "Cargando..." infinito si el fetch tardaba, o mostraba "Error al cargar" si había problemas de red o RLS, degradando la UX. Además, causaba re-renders innecesarios.

Root Cause:
Intentar que un componente de UI genérico (como un selector) sea responsable de su propia resolución de datos complejos rompe el principio de responsabilidad única y genera estados de carga difíciles de gestionar. Además, las llamadas a Supabase desde el cliente pueden fallar por políticas de RLS no previstas en tablas relacionadas.

Fix Applied:
Se eliminó la lógica de fetch interno y se delegó la resolución del nombre al componente padre (Modal), que ya tiene el contexto necesario. El combobox pasó a ser puramente visual/reactivo.

Prevention Rule:
**Context-Driven Data Resolution**: Evitar que los componentes de selección (Combobox/Select) realicen peticiones de red internas para resolver nombres por ID. La resolución de datos debe ocurrir en el contenedor (Page/Modal) o a través de hooks de estado global, pasando la información resuelta al componente visual mediante props (`initialLabel`). Esto centraliza el manejo de errores y estados de carga.

Tags:
[ux] [architecture] [async-loading] [ui-components]

## [Bug ID: 20260428-03]

Context:
`CreateActivityModal.tsx` y `app/oportunidades/[id]/page.tsx`. Sincronización de datos Oportunidad -> Cuenta.

What I Did:
Pasaba solo el `accountId` al modal y esperaba que este resolviera el resto.

Problem:
Incluso pasando el ID correcto, el usuario percibía lentitud o veía campos vacíos porque el sistema no aprovechaba que la relación Oportunidad-Cuenta ya estaba disponible en la página de origen.

Root Cause:
Falta de "puenteo" de datos. Al tener la oportunidad cargada en la página de detalles, ya disponemos de su `account_id` y potencialmente de su nombre. Ignorar esta información y obligar a cada subcomponente a "redescubrirla" genera una experiencia de usuario fragmentada.

Fix Applied:
Se modificó el flujo para que el modal resuelva de forma agresiva y secuencial: primero busca la oportunidad, luego toma su cuenta y nombre, y lo inyecta todo en el estado local antes de que el usuario interactúe.

Prevention Rule:
**Relational Data Bridging**: Al navegar entre entidades relacionadas (ej. de Oportunidad a Actividad), pasar siempre el mayor contexto posible (IDs y nombres) a los subcomponentes o modales. Si el sistema ya conoce una relación, debe "regalarla" a los componentes hijos para evitar latencia visual y redundancia de datos.

Tags:
[ux] [performance] [data-flow] [crm-logic]

---

## [Bug ID: 20260429-01]

Context:
`lib/sync.ts`, Motor de Sincronización (SyncEngine). Sucedió durante la sincronización de campos de propiedad (`owner_user_id`, `created_by`, `user_id`) en oportunidades, cuentas y actividades.

What I Did:
Mantuve un bloque de lógica "proactiva" en `pushChanges` que intentaba asegurar que todos los registros en un lote de sincronización tuvieran un propietario válido.

Problem:
Cada vez que un usuario editaba un campo cualquiera (ej. el monto de una oportunidad) de un registro que no le pertenecía, el motor de sincronización detectaba que el campo `owner_user_id` no estaba en el lote de cambios actual (porque era una edición parcial) y procedía a inyectarlo usando el ID del usuario que estaba realizando la edición. Esto resultaba en un "secuestro" automático de la propiedad del registro en el servidor.

Root Cause:
El motor de sincronización asumía erróneamente que si el campo de propietario no estaba presente en el lote de cambios, significaba que era "inválido o faltante" y debía ser "reparado". No distinguía entre una creación de registro (donde el campo es obligatorio) y una actualización parcial (donde el campo no debe ser alterado si no se especificó).

Fix Applied:
Se eliminó el bloque `else` que inyectaba el campo cuando estaba ausente. Ahora la lógica solo actúa si el campo de propietario **está presente** en el lote de cambios pero contiene un valor inválido (ej. datos de prueba o nulos).

Prevention Rule:
**Never inject mandatory ownership fields** in a synchronization engine for partial updates. In an offline-first system with a centralized sync engine, assume that if a field is missing from a mutation batch, it is because it was not modified and should remain unchanged on the server. If a field is mandatory for new records, ensure it is provided at the UI/Hook level (using the snapshot pattern), but never force it at the sync engine level unless you can differentiate between an `INSERT` and an `UPDATE`.

Tags:
[sync] [ownership] [data-hijacking] [engine-logic] [supabase]


## [Bug ID: 20260429-02]

Context:
`CRM_Oportunidades`, `CRM_FasesOportunidad`, y procesos de migración masiva. Se detectaron más de 10,000 oportunidades con fases que no pertenecían al canal de su cuenta asociada (ej. cuenta Nacional con fase de canal Internacional).

What I Did:
Corregí de forma masiva 10,866 registros mediante un script SQL de re-mapeo inteligente y saneamiento de valores NULL.

Problem:
Oportunidades con `fase_id` inconsistentes o nulos. Esto provocaba que las oportunidades fueran invisibles en los filtros de la interfaz, reportes de ventas distorsionados y errores en la lógica de negocio que depende de la etapa del embudo.

Root Cause:
Falta de validación de integridad referencial cruzada (Cross-Table Validation) durante las migraciones. El sistema permitía que una oportunidad apuntara a una fase de un canal distinto al de su cuenta, rompiendo la lógica de segmentación del CRM.

Fix Applied:
Implementación de un script de remediación con lógica de re-mapeo secuencial:
1. **Mapeo por Nombre:** Buscar el ID de la fase con el mismo nombre en el canal correcto.
2. **Mapeo por Orden:** Si el nombre no existe, buscar la fase con el mismo número de orden (jerarquía).
3. **Mapeo por Defecto:** Si falla lo anterior, asignar la fase inicial (Orden 1) del canal.

Prevention Rule:
**Strict Channel-Phase Alignment**: En sistemas multicanal, el `fase_id` de una oportunidad es una propiedad dependiente del `canal_id` de la cuenta. NUNCA se debe permitir la inserción o actualización de una fase sin validar que pertenezca al canal de la cuenta. En procesos de migración, siempre implementar el flujo (Nombre -> Orden -> Default) para garantizar que la oportunidad mantenga su estado semántico en el nuevo contexto técnico.

Tags:
[data-integrity] [migration] [crm-logic] [sql] [phase-mapping]

---

## [Bug ID: 20260429-02]

Context:
`lib/hooks/useAccountsServer.ts`, `CRM_VistaCuentasConPotencial` (Supabase View). Sucedió al intentar guardar comentarios en el formulario de edición de cuentas. El dato llegaba correctamente a Supabase, pero desaparecía al reabrir el formulario.

What I Did:
Asumí que el problema era el guardado (onBlur/onKeyDown) e implementé manejadores de eventos. Los datos llegaban correctamente a Supabase, pero el formulario no los mostraba al volver a editar.

Root Cause:
La vista `CRM_VistaCuentasConPotencial` en Supabase **no incluía la columna `comentarios`** ni `ignorar_limites_descuento`. El hook `useAccountsServer` consulta esta vista para renderizar el listado, y pasa el objeto resultado directamente a `AccountForm` como prop `account`. Al no tener `comentarios`, el form se inicializaba con string vacío y **sobreescribía el comentario existente al guardar**, aunque el dato estuviera correcto en la tabla base.

Fix Applied:
1. Se actualizó la vista `CRM_VistaCuentasConPotencial` con `DROP + CREATE` para incluir `c.comentarios` y `c.ignorar_limites_descuento`.
2. Se agregaron los campos `comentarios` e `ignorar_limites_descuento` al tipo TypeScript `AccountServer` en `useAccountsServer.ts`.

Prevention Rule:
**Vista vs Tabla Base**: Cuando una entidad tiene un formulario de edición complejo que utiliza un hook de listado (paginado/server-side) como fuente del `account` prop, la vista de Supabase DEBE incluir TODOS los campos editables del formulario. Si se agrega un campo nuevo a la tabla base, se debe actualizar también la vista correspondiente. Checklist obligatorio al agregar campos: (1) tabla base ✅, (2) vista de listado ✅, (3) tipo TypeScript del hook ✅, (4) interfaz local Dexie ✅, (5) función `sanitize` de sync ✅.

Tags:
[data-loss] [supabase-view] [typescript] [crm-logic] [form-data]

---

## [Bug ID: 20260430-01]

Context:
Navegación entre módulos (Contactos/Oportunidades -> Cuentas) mediante enlaces con parámetros de consulta (`/cuentas?id=...`).

What I Did:
Implementé un `useEffect` en `app/cuentas/page.tsx` para manejar el "deep linking". El efecto lee el parámetro `id` de la URL y abre automáticamente el formulario de edición de la cuenta correspondiente.

Problem:
Anteriormente, al hacer clic en "Ver Cuenta" desde otros módulos, el usuario llegaba a la página de Cuentas, pero esta no mostraba ninguna información específica ni abría el formulario de la cuenta seleccionada. El usuario tenía que buscar la cuenta manualmente de nuevo.

Root Cause:
Inconsistencia en el patrón de diseño de navegación. Mientras que el módulo de Contactos ya tenía lógica para abrir un contacto específico vía URL, el módulo de Cuentas carecía de esta funcionalidad, ignorando el parámetro `id` enviado por los otros módulos.

Fix Applied:
Se añadió lógica de detección de `id` en `app/cuentas/page.tsx` que:
1. Verifica si el ID ya existe en la lista cargada (para apertura instantánea).
2. Si no existe en la lista (ej. está en otra página de resultados), realiza un fetch directo a Supabase (`CRM_Cuentas`) para obtener los datos mínimos necesarios y abrir el formulario.

Prevention Rule:
**Deep Linking Consistency**: Todos los módulos principales que actúan como "padres" (Cuentas, Contactos, Oportunidades, Pedidos) DEBEN implementar soporte para apertura directa mediante el parámetro `id` en la URL. Esto garantiza que las referencias cruzadas entre módulos funcionen de manera predecible. Al implementar un enlace de navegación dinámica hacia otro módulo, siempre verificar que el módulo de destino tenga el `useEffect` correspondiente para procesar el parámetro de búsqueda.

Tags:
[navigation] [deep-linking] [ux] [consistency]

---

## [Bug ID: 20260709-01]

Context:
Búsqueda de cuentas al crear un contacto nuevo en `app/contactos/page.tsx` y `page-isazaale.tsx`.

What I Did:
Realicé una búsqueda de cuentas por término ingresado.

Problem:
La aplicación crasheó mostrando la pantalla roja con el error: `acc.nit?.toLowerCase is not a function`.

Root Cause:
Al crear una cuenta con un NIT numérico (como `999999999`), el motor almacena el NIT como tipo `number` (o se lee como tal desde IndexedDB/Supabase). Al filtrar las cuentas en la lista de contactos, el código ejecutaba `acc.nit?.toLowerCase()`, arrojando una excepción porque los números no poseen el método `toLowerCase`.

Fix Applied:
Se convirtió explícitamente el NIT a tipo String usando `String(acc.nit || '')` antes de llamar a `.toLowerCase().includes(term)`.

Prevention Rule:
**Defensive Type Casting on Search Filters**: Al filtrar u operar sobre campos alfanuméricos ingresados por el usuario o importados (como NITs, códigos postales, IDs o teléfonos), NUNCA asumas que su tipo de dato en JS/TS es siempre `string`. Si vas a aplicar métodos de cadena como `.toLowerCase()`, `.trim()` o `.includes()`, castea el valor explícitamente primero mediante `String(valor || '')`.

Tags:
[types] [typescript] [search] [accounts] [contacts] [crash]

---

## [Bug ID: 20260709-02]

Context:
Wizard de creación de cuentas (`CreateAccountWizard.tsx`). El usuario estaba en el Paso 1 (Información Base), seleccionó un canal de venta en un `<select>`, y presionó Enter.

What I Did:
Implementé un `onKeyDown` en el `<form>` que interceptaba Enter únicamente cuando `e.target instanceof HTMLInputElement`. Esto cubría inputs de texto pero no `<select>`, `<button type="button">`, ni otros elementos focusables.

Problem:
Al presionar Enter estando enfocado en un `<select>` (ej. Canal de Venta), el formulario se enviaba inmediatamente saltando los pasos 2 y 3 del wizard. El registro se creaba incompleto.

Root Cause:
La condición `e.target instanceof HTMLInputElement` solo es verdadera para `<input>`. Cuando el foco está en un `<select>`, `<button>`, o cualquier otro elemento HTML, la condición es falsa, el `preventDefault()` no se ejecuta, y el Enter dispara el submit nativo del `<form>`.

Fix Applied:
Se cambió la condición a verificar por `tagName` del target casteado como `HTMLElement`. Ahora se bloquea Enter en TODOS los elementos excepto `<textarea>` (donde Enter es un salto de línea válido) y botones `type="submit"` (donde Enter debe enviar el formulario). Aplicado en los 4 wizards: Cuentas, Contactos, Actividades, Pedidos.

Prevention Rule:
**Enter Key in Multi-Step Wizards**: Todo formulario que use un wizard multi-paso DEBE incluir un `onKeyDown` en el `<form>` que bloquee Enter globalmente excepto para `<textarea>` y `type="submit"`. NUNCA usar `instanceof HTMLInputElement` como condición—usar `target.tagName !== 'TEXTAREA'` para cubrir todos los tipos de elemento (input, select, button, div contentEditable, etc.).

Tags:
[wizard] [form-submit] [enter-key] [ux] [data-loss]

---

## [Bug ID: 20260709-03]

Context:
`npm run dev` con Next.js 16.1.1/Turbopack en Windows.

Problem:
El servidor arrancaba, pero al abrir rutas aparecian errores como:
`Cannot find module 'next/dist/server/app-render/work-async-storage.external.js'`,
`Cannot find module 'react/jsx-runtime'`, `build-manifest.json ENOENT` y
`Persisting failed: Another write batch or compaction is already active`.

Root Cause:
Cache corrupta o bloqueada de Next/Turbopack mientras habia procesos `node`
anteriores escribiendo en paralelo. Los modulos realmente existian en
`node_modules`; el problema estaba en artefactos regenerables (`.next` y
`C:\Users\isaza\.next-crm`).

Fix Applied:
1. Detener procesos `node` que estaban escuchando en los puertos de desarrollo.
2. Borrar `.next` del proyecto.
3. Borrar `C:\Users\isaza\.next-crm`.
4. Levantar de nuevo `npm run dev`.

Prevention Rule:
**Next/Turbopack Cache Reset**: Si Next reporta modulos existentes como faltantes
o aparecen errores SST/build-manifest durante `next dev`, primero verificar si
hay varios procesos `node` activos y limpiar caches regenerables antes de
reinstalar dependencias.

Tags:
[nextjs] [turbopack] [cache] [windows] [dev-server]

---

## [Bug ID: 20260709-04]

Context:
Wizard de creacion de cuentas en `app/cuentas/nueva/CreateAccountWizard.tsx`.

Problem:
Al terminar el paso 2, la cuenta podia crearse inmediatamente y redirigir a
`/cuentas?id=...`, sin darle oportunidad al usuario de diligenciar el paso 3
de clasificacion.

Root Cause:
El boton final `Crear Cuenta` aparece en la misma posicion que `Siguiente`.
En transiciones rapidas, doble clics o activaciones repetidas podian disparar
el submit del formulario justo despues de pasar al ultimo paso.

Fix Applied:
Se definio `LAST_STEP_INDEX`, se bloqueo cualquier submit que no ocurra desde
el ultimo paso, y se agrego una ventana corta de habilitacion para el boton
final. Al entrar al paso 3, `Crear Cuenta` inicia deshabilitado por 500 ms,
evitando que un segundo clic heredado cree la cuenta antes de que el usuario
interactue con la pantalla final.

Prevention Rule:
**Wizard Final Submit Guard**: En wizards multi-paso, el `onSubmit` debe validar
explicitamente que el usuario esta en el ultimo paso. Si el boton final ocupa
la misma posicion que el boton de avance, deshabilitar el submit brevemente al
entrar al ultimo paso para evitar creaciones accidentales por doble clic.

Tags:
[wizard] [accounts] [form-submit] [double-click] [ux]

---

## [Bug ID: 20260710-01]

Context:
Wizards de creacion con boton de avance y boton final ubicados en la misma zona visual: actividades, contactos, pedidos y oportunidades.

Problem:
Al completar el penultimo paso, un doble clic o activacion repetida sobre "Siguiente" podia impactar el boton final recien renderizado y disparar la creacion del registro antes de que el usuario diligenciara o revisara el ultimo paso.

Root Cause:
React cambia de paso y reemplaza el boton "Siguiente" por el boton final en la misma posicion. Sin una guarda temporal, el segundo click del usuario puede caer sobre el boton de submit inmediatamente despues del render.

Fix Applied:
Cada wizard define un indice de ultimo paso, valida en `onSubmit` que el submit venga desde ese paso, y deshabilita el boton final durante 500 ms al entrar a la pantalla final. Se agrego cobertura E2E para actividades usando `/e2e/activities-wizard` y se mantuvo la prueba de cuentas.

Prevention Rule:
**Delayed Final Submit in Wizards**: Todo wizard de creacion cuyo boton final reemplace visualmente a "Siguiente" debe tener una guarda de ultimo paso y un delay corto antes de habilitar el submit final. La prueba E2E debe hacer doble clic en "Siguiente" desde el penultimo paso y verificar que no se cree ni se redirija.

Tags:
[wizard] [activities] [contacts] [orders] [opportunities] [form-submit] [double-click] [e2e]

---

## [Bug ID: 20260710-02]

Context:
Edicion de actividades tipo `TAREA` en `CreateActivityModal`, seccion "Actividades (Checklist Planner)".

Problem:
Los items agregados al checklist se veian en pantalla, pero no quedaban registrados en Dexie/Supabase ni se enviaban a Microsoft Planner.

Root Cause:
El checklist vive en estado React (`checklist`) y no en `react-hook-form`, asi que `useFormAutoSave` no detectaba cambios al agregar, editar, marcar o borrar items. Adicionalmente, `useActivities.updateActivity` filtraba `_sync_metadata` fuera de los cambios permitidos, por lo que el lugar natural para persistir `checklist` se descartaba antes de llegar a Dexie/outbox/Supabase.

Fix Applied:
Se agrego autosave debounced especifico para checklist en `CreateActivityModal`. Cada cambio guarda `checklist` dentro de `_sync_metadata`, intenta PATCH a `/api/microsoft/planner/tasks/[taskId]` y marca `pending_planner_update` cuando Planner no responde. `useActivities.updateActivity` ahora permite `_sync_metadata`, y `SyncEngine` procesa `pending_planner_update` para reintentar el PATCH.

Prevention Rule:
**Autosave External State**: Si un editor usa auto-save basado en `react-hook-form`, cualquier estado externo al formulario (checklists, adjuntos, asistentes, tags, ordenamientos) debe tener su propio autosave o debe sincronizarse explicitamente al form. Si el estado se guarda en metadata, la allowlist del hook de persistencia debe incluir esa columna.

Tags:
[activities] [planner] [checklist] [autosave] [dexie] [supabase] [sync]

---

## [Bug ID: 20260710-03]

Context:
Filtrado de actividades para roles restringidos, como VENDEDOR, en `app/actividades/page.tsx` durante el estado inicial de carga cuando `useCurrentUser` todavia no ha poblado `user`.

What I Did:
La logica original usaba una condicion equivalente a `if (!canViewAll && user) { ... return false; }`. Cuando `user` era `null` durante la carga, la condicion completa era falsa y se saltaba el filtro de rol.

Problem:
Un VENDEDOR podia ver momentanea o permanentemente todas las actividades al seleccionar "Todas las actividades", porque el filtro de seguridad no se aplicaba mientras `user` estaba vacio.

Root Cause:
Combinar la negacion de permiso (`!canViewAll`) con la presencia del usuario (`&& user`) crea un bypass fail-open. Si `user` aun no esta disponible, el bloque que debia ocultar registros no autorizados no corre.

Fix Applied:
Se separaron las condiciones: primero se verifica `if (!canViewAll)` y dentro se valida explicitamente `if (!user) return false`, denegando acceso mientras el usuario carga.

Prevention Rule:
**Fail-Secure Role Filters**: En filtros client-side donde la falta de permiso debe ocultar datos, nunca combines el check de permiso con el null-check del usuario usando `&&`. Si el usuario no esta cargado, el filtro debe negar por defecto.

Tags:
[react] [security] [data-leak] [filtering]

---

## [Bug ID: 20260710-04]

Context:
Filtrado por rol en hooks server-side (`useAccountsServer.ts`, `useOpportunitiesServer.ts`) al restringir visibilidad para VENDEDOR.

What I Did:
La logica incluia `const ids = [currentUserId, ...(user?.coordinadores || [])]` para determinar que registros podia ver un VENDEDOR.

Problem:
Los VENDEDORES podian ver cuentas y oportunidades propiedad de sus coordinadores. Si un coordinador tenia muchas cuentas, el vendedor heredaba visibilidad ascendente, saltandose la regla de "solo lo propio".

Root Cause:
Interpretacion incorrecta de `user.coordinadores`: ese arreglo contiene IDs de jefes del usuario, no subordinados. Un vendedor nunca debe ver datos de su jefe; solo un COORDINADOR debe ver hacia abajo usando `subordinateIds`.

Fix Applied:
Se elimino `user?.coordinadores` del conjunto de IDs permitidos para VENDEDOR. Para vendedores la lista queda estrictamente `[currentUserId]`; para coordinadores se usa `[currentUserId, ...subordinateIds]`.

Prevention Rule:
**No Upward Visibility**: Nunca concedas acceso a registros cuyo propietario este en `user.coordinadores`. Eso es visibilidad ascendente y es una fuga de seguridad. Usa `subordinateIds` solo para visibilidad descendente de managers y `currentUserId` para contribuidores individuales.

Tags:
[react] [security] [data-leak] [filtering] [rbac]

---

## [Bug ID: 20260714-01]

Context:
`app/cuentas/page.tsx`. Al seleccionar una cuenta en la tabla, el estado `editingAccount` se actualizaba inmediatamente pero el parámetro `id` de la URL se actualizaba mediante un useEffect con debounce de 500ms.

Problem:
Al seleccionar una cuenta diferente en la tabla, el panel se actualizaba temporalmente pero inmediatamente volvía a la cuenta anterior, impidiendo cambiar de selección.

Root Cause:
El `useEffect` de deep-linking se disparaba debido al cambio de `editingAccount?.id`. Al evaluar que el `id` en la URL era diferente del nuevo `editingAccount.id` (porque la URL aún no se había actualizado por el debounce de 500ms), el efecto asumía que la URL tenía la verdad y revertía `editingAccount` a la cuenta del ID viejo de la URL.

Fix Applied:
Se implementó un ref `lastProcessedUrlIdRef` para almacenar el último ID de la URL que fue procesado. Si el ID de la URL no ha cambiado con respecto al de la referencia, el efecto retorna inmediatamente, evitando revertir los cambios de selección local que aún no se han reflejado en la URL.

Prevention Rule:
**Debounced URL State Sync vs Deep Linking**: Al sincronizar un estado local con la URL de forma asíncrona o mediante un debounce, el efecto de "deep linking" (que sincroniza de la URL al estado) debe ignorar los cambios que provienen del estado local. Usa una referencia (`useRef`) para recordar el último parámetro de la URL procesado y evitar bucles o reversiones de estado indeseados mientras la URL se pone al día.

Tags:
[react] [deep-linking] [state-sync] [debounce] [accounts]

---

## [Bug ID: 20260724-01]

Context:
`app/informes/page.tsx` y exportación de informes / Proyección S&OP a Excel y CSV.

Problem:
La exportación de informes (especialmente la Proyección S&OP, Cotizaciones y Contactos) arrojaba error "column CRM_Pedidos.fecha_facturacion does not exist" o generaba archivos con columnas de nombres/importes en blanco.

Root Cause:
1. `CRM_Pedidos` no posee columnas `fecha_facturacion` ni `fecha_entrega`; las columnas reales en PostgreSQL provienen de campos SAP (`"EXTRA_Fecha de facturación"` y `"EXTRA_Fecha mínima requerida por comercial/cliente"`). Al consultar columnas inexistentes, Supabase devolvía error 42703.
2. `CRM_Contactos` usa la columna `nombre` en lugar de `nombres` y `apellidos`.
3. `CRM_Cotizaciones` usa `numero_cotizacion`, `total_amount` y `status` en lugar de `codigo`, `total_final` y `estado`.
4. `CRM_Oportunidades` no vinculaba `probabilidad` con la clave `probability` usada en el encabezado del informe.

Fix Applied:
1. Se corrigió la consulta `.select()` de `CRM_Pedidos` especificando los nombres de columnas de Supabase entre comillas dobles y con valores de respaldo (`closeDate`, `expectedCloseDate`).
2. Se mejoró `getYearAndMonth` para soportar formatos `DD/MM/YYYY`, `YYYY-MM-DD` e ISO.
3. Se alinearon los mapeos de `flattenFn` para Contactos, Cotizaciones, Oportunidades y Cuentas con las columnas reales de las tablas `CRM_*`.

---

## [Bug ID: 20260821-01]

Context:
`lib/sync.ts` y modo snapshot (`_complete_snapshot_`) en sincronización offline contra la función RPC `process_field_updates`.

Problem:
Al sincronizar cuentas en modo snapshot con números de NIT de 10 o más dígitos (o strings formateados), PostgreSQL arrojaba el error: `value "..." is out of range for type integer [Context: _complete_snapshot_ (INSERT)]` o `invalid input syntax for type integer`, abortando la inserción.

Root Cause:
Fix Applied:
Se agregó sanitización defensiva en `SyncEngine` (`lib/sync.ts`) para `CRM_Cuentas` antes de enviar el RPC: si `nit` no es un entero puro o supera `MAX_INT32 = 2147483647`, se establece en `null`, garantizando que `nit_base` conserve el NIT íntegro sin generar errores en PostgreSQL.

Prevention Rule:
**Integer Bounds Checking in Snapshot RPCs**: Al enviar payloads consolidados (`_complete_snapshot_`) a funciones dinámicas en PostgreSQL, asegurarse de que los campos con columnas legacy de tipo `integer` estén acotados (`<= 2147483647`) o sean enviados como `null` cuando exista una columna `text` correspondiente (`nit_base`).

Tags:
[sync] [snapshot] [postgres] [integer-range] [nit] [lww]

---

## [Bug ID: 20260821-02]

Context:
`lib/sync.ts`, ciclo de sincronización y generación de ítems en la cola `db.outbox`.

Problem:
Al editar un registro en la aplicación o iniciar la sincronización, el contador de pendientes se disparaba a más de 1,600 elementos ("Pendientes: 1685"), generando un bucle de carga masiva en el Outbox.

Root Cause:
1. Dentro de `pushBatch`, una validación de auto-curación consultaba `CRM_Cuentas` en Supabase con el JWT del asesor para verificar cuentas vinculadas a oportunidades del lote. Debido a políticas de RLS o latencia, la consulta devolvía menos cuentas, asumiendo que "faltaban" y re-encolando un nuevo snapshot con un UUID aleatorio (`uuidv4()`) en cada ciclo de sincronización.
2. La respuesta del RPC `process_field_updates` para `_complete_snapshot_` no completaba en bloque todas las mutaciones previas del mismo `entity_id`.
3. La compactación previa en `resetStuckItems` ignoraba ítems con `_complete_snapshot_`, impidiendo que los snapshots duplicados se fusionaran.

Fix Applied:
1. Se eliminó la re-consulta ciega dentro de `pushBatch`.
2. Se implementó deduplicación universal en `resetStuckItems()` que colapsa cualquier colección de snapshots y mutaciones repetidas de una misma entidad en su versión más reciente.
3. Se actualizó el procesador de respuesta del RPC para marcar como `COMPLETED` todas las mutaciones del mismo `entity_id` tras un snapshot exitoso.

Prevention Rule:
**Idempotent Outbox Mutations**: Las funciones de sincronización por lotes (`pushBatch`) nunca deben generar nuevas mutaciones de Outbox durante la ejecución del lote con IDs aleatorios. Cualquier auto-curación y compactación debe ser idempotente y ejecutarse antes del bucle de envío.

Tags:
[sync] [outbox] [deduplication] [infinite-loop] [self-healing]

---

## [Bug ID: 20260821-03]

Context:
`lib/sync.ts` y `lib/stores/useSyncStore.ts`, ciclo de sincronización reactiva al guardar/editar registros.

Problem:
Al editar cualquier campo de un registro (por ejemplo, el nombre de una cuenta), el navegador iniciaba una descarga masiva de miles de registros de todas las tablas ("descargando cientos de datos").

Root Cause:
1. `queueMutation` disparaba `triggerSync()`, el cual ejecutaba `pullChanges()` en cada mutación individual/autosave.
2. `useSyncStore` no utilizaba persistencia en `localStorage` para `lastSyncTime`, por lo que cada recarga o sesión nueva iniciaba con `lastSyncTime = null`, provocando que `pullChanges()` hiciera una descarga completa inicial de 3,000 cuentas, 3,000 oportunidades, 3,000 contactos, 3,000 cotizaciones, etc.

Fix Applied:
1. Se añadió `triggerPush()` a `SyncEngine` para que `queueMutation` realice un envío inmediato y ligero de los cambios locales sin descargar ninguna tabla.
2. Se configuró el middleware `persist` de Zustand en `useSyncStore` para guardar `lastSyncTime` en `localStorage`, garantizando que cualquier pull posterior sea estrictamente incremental (`gte('updated_at', lastSync)`).

Prevention Rule:
**Decouple Push from Pull in Local-First Outbox**: Las mutaciones locales del usuario deben disparar únicamente operaciones de envío (*push*). Las descargas completas o incrementales (*pull*) deben estar desacopladas y ejecutarse por intervalos de fondo, al iniciar la aplicación o por acción explícita del usuario.

Tags:
[sync] [push-pull-decoupling] [zustand-persist] [incremental-sync] [outbox]

---

## [Bug ID: 20260821-04]

Context:
`lib/sync.ts`, bloque `finally` de reintentos en `triggerSync()`.

Problem:
Al recargar la página en localhost o existir ítems en estado `FAILED` o `PENDING` en el Outbox, el motor de sincronización iniciaba un bucle infinito que ejecutaba `pullChanges()` cada 100ms, volviendo a descargar todas las tablas de Supabase continuamente.

Root Cause:
En el bloque `finally` de `triggerSync()`, al detectar ítems restantes para reintento se invocaba recursivamente `setTimeout(() => this.triggerSync(), ...)`. Al invocar `triggerSync` en vez de `triggerPush`, cada iteración de reintento del lote ejecutaba nuevamente la fase de descarga (`pullChanges`), saturando la red y la CPU.

Fix Applied:
Se cambió la reprogramación de reintentos en el bloque `finally` para invocar exclusivamente `this.triggerPush()`. La fase de descarga (`pullChanges`) queda confinada a ejecuciones únicas e independientes.

Prevention Rule:
**Never Retry Pull in Outbox Processing Loops**: Los bucles de reintento de la cola de salida (*outbox retry loops*) deben invocar únicamente funciones de envío (*push-only*). Jamás se debe invocar una rutina que contenga descargas (*pull*) dentro de la lógica de reintento de mutaciones.

Tags:
[sync] [infinite-pull-loop] [outbox-retry] [push-only]

---

## [Bug ID: 20260821-05]

Context:
`lib/hooks/useFormAutoSave.ts` y `lib/sync.ts` (`queueMutation`).

Problem:
Al editar un formulario (como el nombre de una cuenta), se acumulaban decenas o cientos de mutaciones idénticas (`_complete_snapshot_`) en la cola de salida (Outbox).

Root Cause:
1. En `useFormAutoSave.ts`, la suscripción a `form.watch` retornaba una función `() => clearTimeout(timer)` que no es ejecutada por el callback de react-hook-form, disparando un temporizador no cancelado por cada pulsación de tecla.
2. En `queueMutation`, cada llamada encolaba un nuevo registro con `id = uuidv4()` sin verificar si ya existía una mutación pendiente para la misma entidad en Dexie.

Fix Applied:
1. Se implementó `timerRef` persistente en `useFormAutoSave` para limpiar el debounce correctamente antes de iniciar un nuevo temporizador.
2. Se implementó deduplicación/upsert in-place en `queueMutation` al momento de encolar (`db.outbox.update(existing.id)`).

Prevention Rule:
**Debounce Cleanup via useRef and Enqueue-Time In-Place Upsert**: Todos los hooks de auto-guardado deben manejar temporizadores de debounce mediante `useRef` explícito. Las funciones de encolado del Outbox deben realizar un *upsert in-place* sobre mutaciones pendientes de la misma entidad para prevenir proliferación de registros redundantes.

Tags:
[autosave] [debounce-ref] [enqueue-upsert] [outbox-dedup]

---

## [Bug ID: 20260821-06]

Context:
`lib/sync.ts`, `components/layout/AppLayout.tsx` y mantenimiento de catálogos.

Problem:
Una recarga, el retorno a la pestaña, el intervalo de cinco minutos o un cambio menor podían volver a descargar ciudades, departamentos, países, fases y demás catálogos completos.

Root Cause:
Los catálogos no tenían vigencia propia y formaban parte de cada `pullChanges()`. Además, algunas operaciones administrativas usaban una sincronización global para refrescar una sola tabla.

Fix Applied:
Se creó un cursor de catálogo con TTL de 24 horas, se paginaron todos los catálogos y se añadió `refreshPhases()` para la recarga dirigida. Los cambios de clasificación actualizan Dexie directamente y ya no disparan un pull global.

Prevention Rule:
**Catalog Sync Has Its Own Lifecycle**: Los catálogos de baja volatilidad deben tener cursor/TTL independiente y refrescos dirigidos. Una mutación de configuración nunca debe descargar todas las tablas del CRM.

Tags:
[sync] [catalogs] [ttl] [pagination] [network]

---

## [Bug ID: 20260821-07]

Context:
`lib/sync.ts`, cursores incrementales y recuperación de pulls parciales.

Problem:
Si una tabla fallaba durante el pull, el error se registraba pero la sincronización podía considerarse terminada y avanzar el cursor. También se tomaba la hora al final, creando una ventana en la que un cambio remoto podía quedar fuera para siempre.

Root Cause:
Los errores internos se absorbían y el cursor global se actualizaba aunque el conjunto no fuera consistente. El límite superior de la ventana no se capturaba antes de empezar.

Fix Applied:
El motor captura `syncUpperBound` al inicio, limita cada consulta incremental a esa frontera, acumula y propaga cualquier error parcial y solo persiste el cursor durable en Dexie cuando todo el pull termina correctamente. El cursor queda aislado por usuario y tabla lógica.

Prevention Rule:
**Commit Cursor Only After Atomic Pull Success**: Un cursor incremental es un commit. Debe avanzar únicamente si todas las lecturas cubiertas por su ventana finalizaron, usando un límite superior capturado antes del pull.

Tags:
[sync] [cursor] [partial-failure] [data-loss] [indexeddb]

---

## [Bug ID: 20260821-08]

Context:
`lib/sync.ts`, ciclo de vida y reintentos del Outbox.

Problem:
Los reintentos se consumían casi de inmediato y, al llegar al máximo, la mutación se borraba. Una corrección posterior del usuario podía conservar el contador agotado y volver a fallar sin oportunidad real de recuperación.

Root Cause:
No existía `next_attempt_at`, el backoff no gobernaba la selección del lote y el estado terminal se modelaba como eliminación.

Fix Applied:
Se añadió backoff exponencial, selección exclusiva de mutaciones vencidas, estado `DEAD_LETTER`, recuperación manual y reactivación automática al editar nuevamente la entidad. Ningún error agotado elimina el cambio del usuario.

Prevention Rule:
**Failed Sync Data Is Evidence, Not Garbage**: Una mutación agotada debe quedar visible y recuperable. El retry count, error y próxima fecha de intento deben persistir; nunca se debe borrar automáticamente información no sincronizada.

Tags:
[sync] [outbox] [retry] [dead-letter] [data-preservation]

---

## [Bug ID: 20260821-09]

Context:
`lib/hooks/useFormAutoSave.ts` y callbacks inline de formularios.

Problem:
Un solo cambio podía no guardarse cuando el componente se volvía a renderizar antes de vencer el debounce.

Root Cause:
La suscripción dependía de la identidad de `onSave`. Los callbacks inline cambiaban en cada render, el cleanup cancelaba el temporizador pendiente y no llegaba a ejecutarse el guardado.

Fix Applied:
`onSave` se conserva en un ref actualizado y la suscripción depende únicamente de `form` y `delay`. Una prueba con temporizadores simulados verifica que un cambio se guarda exactamente una vez aunque el callback cambie de identidad.

Prevention Rule:
**Debounced Subscriptions Must Read the Latest Callback Through a Ref**: No incluyas callbacks inline en las dependencias de una suscripción cuyo cleanup cancela trabajo pendiente.

Tags:
[react] [autosave] [debounce] [use-ref] [regression-test]

---

## [Bug ID: 20260821-10]

Context:
`lib/sync.ts` y deltas de Supabase/PostgREST.

Problem:
Consultas supuestamente completas quedaban limitadas al máximo de filas del API. Además, las ediciones de `CRM_PedidoItems` no aparecían porque el pull incremental filtraba por `created_at`.

Root Cause:
No se recorrían rangos con orden determinista y la tabla de ítems no disponía de una marca de actualización mantenida por la base de datos.

Fix Applied:
Se implementó paginación por `.range()` con orden estable y topes de seguridad. La migración añade `updated_at`, trigger e índice a `CRM_PedidoItems`, y el cliente usa ese campo para sus deltas.

Prevention Rule:
**Every Incremental Collection Needs Pagination and a Mutable Cursor Column**: Toda tabla sincronizada debe tener orden estable, paginación explícita y `updated_at` actualizado en cada modificación.

Tags:
[supabase] [postgrest] [pagination] [updated-at] [pedido-items]

---

## [Bug ID: 20260821-11]

Context:
RPC PostgreSQL `process_field_updates` y estrategia LWW por campo.

Problem:
La función aceptaba un nombre de tabla y `p_user_id` proporcionados por el navegador, operaba como `SECURITY DEFINER` y la ruta de actualización de un solo campo no avanzaba su timestamp en `_sync_metadata`. La respuesta tampoco identificaba inequívocamente la mutación del Outbox.

Root Cause:
El contrato del RPC mezclaba privilegios elevados, SQL dinámico y datos de identidad no verificados. El resultado se correlacionaba por entidad/campo, que no es único cuando existen ediciones concurrentes.

Fix Applied:
La migración mueve la implementación heredada a un esquema no expuesto, la convierte en `SECURITY INVOKER`, crea un wrapper público con lista blanca de tablas y validación `p_user_id = auth.uid()`, repara el timestamp LWW y devuelve `mutation_id`. El acceso queda sujeto a RLS.

Prevention Rule:
**Dynamic Sync RPCs Must Be Allowlists Under RLS**: Nunca combines tabla arbitraria, identidad enviada por el cliente y `SECURITY DEFINER`. Correlaciona cada resultado por un ID de mutación estable.

Tags:
[supabase] [postgres] [rls] [rpc] [security] [lww]

---

## [Bug ID: 20260821-12]

Context:
`lib/sync.ts`, recuperación de elementos `SYNCING` y concurrencia entre pestañas.

Problem:
Una pestaña podía devolver inmediatamente a `PENDING` las mutaciones que otra pestaña acababa de reclamar, ocasionando envíos duplicados.

Root Cause:
`resetStuckItems()` trataba cualquier estado `SYNCING` como abandonado, sin registrar cuándo empezó el intento ni respetar una concesión temporal.

Fix Applied:
El reclamo del lote y su paso a `SYNCING` ocurren en una transacción Dexie; se registra `last_attempt_at` y solo se recuperan concesiones vencidas después de dos minutos.

Prevention Rule:
**Outbox Claims Need a Lease**: Reclama lotes atómicamente y no recicles trabajo `SYNCING` activo. La recuperación debe depender de una marca temporal y un timeout explícito.

Tags:
[sync] [multi-tab] [lease] [dexie] [idempotency]

---

## [Bug ID: 20260821-13]

Context:
`lib/sync.ts`, operación administrativa `cleanResync()`.

Problem:
La resincronización limpia podía fallar antes del pull o volver a usar un cursor obsoleto después de vaciar IndexedDB.

Root Cause:
El procedimiento referenciaba tablas Dexie inexistentes (`products`, `priceList`), llamaba un método Zustand que no existía y no eliminaba el cursor durable correspondiente al usuario.

Fix Applied:
Se alineó la transacción con las tablas reales, se corrigió la API del store, se preserva todo el Outbox —incluido `DEAD_LETTER`— y se elimina/recrea el cursor durable solo después de un pull completo exitoso.

Prevention Rule:
**Recovery Paths Must Be Tested Against the Current Local Schema**: Los flujos de recuperación no pueden depender de nombres históricos ni de cursores externos a la base local que acaban de limpiar.

Tags:
[sync] [recovery] [dexie] [cursor] [schema-drift]

## [Bug ID: 20260824-01]

Context:
`components/tiendas/CreateStoreSaleForm.tsx`, selectores dependientes de País, Departamento, Canal y Asesor.

Problem:
Flickering / parpadeo continuo en el selector de departamentos que impedía seleccionar departamentos o los revertía de inmediato.

Root Cause:
Dependencia circular reactiva entre `selectedDept`, `filteredAdvisors` y `selectedAdvisorId`. Un `useEffect` pasivo de sincronización bidireccional sobreescribía `departamento_id` cada vez que cambiaba el asesor o el departamento no coincidía con el asesor anterior, y otro `useEffect` auto-seleccionaba asesor cada vez que `filteredAdvisors` cambiaba, provocando un bucle infinito de re-renders.

Fix Applied:
Se eliminaron los `useEffect`s pasivos que forzaban la selección y sobreescritura de valores. Se delegó el reseteo de asesor (`setValue("asesor_id", "")`) a los eventos `onChange` explícitos de País, Departamento y Canal, y se añadió la opción por defecto `"Seleccione un asesor..."` con validación Zod.

Prevention Rule:
**Never Use Passive useEffects for Multi-Select Cascades**: El reseteo o propagación entre campos de formulario en cascada debe ocurrir en los manejadores de eventos de usuario (`onChange`), nunca en efectos reactivos que reaccionen a los propios valores que modifican.

## [Bug ID: 20260824-02]

Context:
`components/tiendas/CreateStoreSaleForm.tsx`, `lib/sync.ts` y `lib/hooks/useAccounts.ts`. Fallo en cola de sincronización `Contacto - _complete_snapshot_ FAILED` y falta de detección temprana de cuentas/contactos duplicados en el formulario de tienda.

Problem:
Al registrar clientes o ventas en el módulo de Tiendas, mutaciones de contactos (`CRM_Contactos`) quedaban atascadas en estado `FAILED` (`_complete_snapshot_ FAILED`) por violaciones de clave foránea `fk_crmcontactos_account` o de unicidad `unique_active_contact_phone`. Adicionalmente, el formulario no alertaba tempranamente si el NIT, teléfono o email ya pertenecían a un cliente existente.

Root Cause:
1. `resolveDuplicateAccount()` en `lib/sync.ts` solo actualizaba mutaciones donde `field_name === 'account_id'`, omitiendo las mutaciones de tipo snapshot (`_complete_snapshot_`) cuyo `account_id` está dentro del objeto `new_value`. Al reintentar, el snapshot enviaba el `badAccountId` inexistente.
2. `SyncEngine.pushBatch` no interceptaba los errores de duplicidad de teléfono (`unique_active_contact_phone`) ni de cuenta huérfana para contactos, dejando el ítem permanentemente en `FAILED`.
3. El formulario no advertía al usuario en tiempo real cuando ingresaba un NIT, teléfono o email de un cliente existente, ni pasaba los datos personalizados de contacto al crear la cuenta.

Fix Applied:
1. Se extendió `resolveDuplicateAccount` para escanear y actualizar `account_id` dentro de todos los snapshots `_complete_snapshot_` en el outbox.
2. Se implementaron los métodos de auto-curación `healDuplicateContactPhone` y `healOrphanedContactAccount` en `SyncEngine`.
3. Se integró detección temprana reactiva en `CreateStoreSaleForm.tsx` para `nit_base`, `telefono` y `email` con badges de advertencia visual y botón de acción rápida `⚡ Vincular a este cliente`.
4. Se habilitó el paso de `initialContactData` en `useAccounts.createAccount` para conservar datos reales de contacto.

Prevention Rule:
## [Bug ID: 20260826-01]

Context:
`supabase/migrations/` y función RPC `process_field_updates` en Supabase/PostgreSQL.

Problem:
Al sincronizar mutaciones de tipo snapshot (`_complete_snapshot_`) o campos individuales que contienen arreglos (como `contactos_ids` en `CRM_Oportunidades`), PostgreSQL arrojaba el error:
`malformed array literal: "[]" [Context: _complete_snapshot_ (INSERT)]`
provocando que el registro de oportunidad cayera a `DEAD_LETTER` y, en consecuencia, la actividad vinculada fallara por violación de clave foránea `fk_crmact_opp`.

Root Cause:
En la función dinámica `process_field_updates`, la conversión de valores para la consulta SQL usaba extracción de texto simple `($2->>'col')::udt_name`.
Cuando la columna es de tipo arreglo en PostgreSQL (ej. `uuid[]` cuyo `udt_name` es `_uuid`, `_text`, etc.), la extracción JSON a texto produce `"[]"`, el cual es un formato JSON con corchetes y NO una sintaxis de literal de arreglo de PostgreSQL (`"{}"`), causando el error `22P02: malformed array literal`.

Fix Applied:
1. Se actualizó la función `public.process_field_updates` en PostgreSQL para detectar si el tipo de columna es un arreglo usando `LEFT(v_col_type, 1) = '_'` (evitando el comodín de un solo caracter en SQL `LIKE '_%'` que accidentalmente coincidía con tipos como `varchar` y producía `type "archar" does not exist`).
2. Se implementó una cláusula `CASE` que convierte arreglos JSONB usando `jsonb_array_elements_text()` y `array_agg(elem::base_type)` con fallback a `ARRAY[]::base_type[]`, manejando tanto `_complete_snapshot_` como actualizaciones individuales.
3. Se generó la migración `20260826_fix_process_field_updates_array_types.sql`.

Prevention Rule:
**Never Use Unescaped SQL LIKE '_%' For Underscore Matching**: En SQL / PL/pgSQL, el caracter `_` es un comodín que coincide con cualquier caracter individual (haciendo que `varchar` coincida con `_%`). Para verificar si un string inicia con un guión bajo literal, usar siempre `LEFT(col, 1) = '_'` o `starts_with(col, '_')`.
**JSONB Arrays Must Be Aggregated to Postgres Arrays**: En funciones RPC dinámicas en PL/pgSQL, nunca castear un JSONB array extrayendo texto plano `($2->>'col')::array_type`. Siempre usar `jsonb_array_elements_text` + `array_agg` para construir arreglos nativos de PostgreSQL.

Tags:
[sync] [postgres] [rpc] [array-literal] [opportunities] [dead-letter] [sql-like-wildcard]

---

## [Bug ID: 20260826-02]

Context:
`lib/sync.ts`, `lib/hooks/useOpportunities.ts`, `lib/hooks/useAccounts.ts` y RPC `process_field_updates` en Supabase/PostgreSQL al eliminar oportunidades/cotizaciones o sincronizar snapshots de `CRM_CotizacionItems`.

Problem:
Al eliminar una oportunidad (o cotizaciones/cuentas con ítems), la mutación snapshot de `CRM_CotizacionItems` encolada en el Outbox fallaba sistemáticamente arrojando el error:
`[FAILED] CRM_CotizacionItems (_complete_snapshot_): column "subtotal" can only be updated to DEFAULT [Context: _complete_snapshot_ (UPDATE)]`
quedando atascada en el Outbox y bloqueando la sincronización de ítems eliminados.

Root Cause:
1. La columna `subtotal` de `CRM_CotizacionItems` es una columna generada en PostgreSQL (`is_generated = 'ALWAYS'`, expresión: `(cantidad * COALESCE(final_unit_price, precio_unitario))`). PostgreSQL prohíbe explícitamente actualizar o insertar valores en columnas generadas que no sean `DEFAULT`.
2. Al ejecutar `deleteOpportunity` (`useOpportunities.ts`) y `deleteAccount` (`useAccounts.ts`), se encolaba la mutación `{ ...item, is_deleted: true }` conservando la propiedad `subtotal` que proviene del almacenamiento local de Dexie.
3. El filtro en `lib/sync.ts` solo descartaba mutaciones donde `u.field === 'subtotal'`, pero omitía limpiar la clave `subtotal` contenida dentro de los objetos de modo snapshot `u.field === '_complete_snapshot_'`.
4. El RPC `process_field_updates` en PostgreSQL no comprobaba si las columnas detectadas en `information_schema.columns` eran columnas generadas (`is_generated = 'ALWAYS'`), intentando agregarlas a las cláusulas `UPDATE` e `INSERT`.

Fix Applied:
1. Se actualizó `public.process_field_updates` en PostgreSQL para consultar `is_generated` y omitir cualquier columna donde `COALESCE(is_generated, 'NEVER') = 'ALWAYS'`. (Migración: `20260826_fix_process_field_updates_generated_columns.sql`).
2. Se actualizó `lib/sync.ts` en `pushChanges` para limpiar la propiedad `subtotal` de los snapshots `_complete_snapshot_` de `CRM_CotizacionItems` antes de enviarlos al RPC, y en `queueMutation` para evitar persistir `subtotal` en la cola de salida.
3. Se corrigió `deleteOpportunity` en `lib/hooks/useOpportunities.ts` y `deleteAccount` en `lib/hooks/useAccounts.ts` desestructurando `{ subtotal, ...itemData }` antes de encolar las mutaciones de soft-delete.

## [Bug ID: 20260826-03]

Context:
`lib/utils.ts` (`includesNormalized`, `matchesSearchTokens`), `components/usuarios/UserList.tsx`, `components/cuentas/UserPickerFilter.tsx` y políticas RLS de `CRM_Usuarios` en Supabase/PostgreSQL.

Problem:
Al entrar al módulo de Gestión de Usuarios (`/usuarios`) o al abrir el selector de usuarios en filtros (`UserPickerFilter`), la lista aparecía vacía ("0 usuarios", "No se encontraron usuarios") a pesar de existir usuarios válidos en la base de datos.

Root Cause:
1. Las funciones utilitarias `includesNormalized` y `matchesSearchTokens` contenían una validación estricta `if (!text || !searchQuery) return false;`. Al cargar la interfaz con `searchTerm = ""` (cadena vacía inicial), `includesNormalized` retornaba `false`, filtrando todos los registros.
2. La tabla `CRM_Usuarios` en Supabase tenía activado RLS pero solo contaba con políticas asignadas al rol `authenticated`. Al realizar consultas durante la inicialización o antes de que el JWT del cliente SSR estuviese completamente adjunto, PostgREST evaluaba el rol `public`/`anon` y devolvía 0 registros.

Fix Applied:
1. Se actualizaron `includesNormalized` y `matchesSearchTokens` en `lib/utils.ts` para retornar `true` cuando `!searchQuery || !searchQuery.trim()`, comportándose de forma consistente con `String.prototype.includes("")`.
2. Se añadió de forma explícita y defensiva la condición `!searchTerm.trim() || ...` en `UserList.tsx` y `UserPickerFilter.tsx`.
3. Se creó y aplicó la política RLS `"Allow read access to public for CRM_Usuarios"` para permitir lectura de usuarios a nivel general en directorios y selectores (Migración: `20260826_allow_public_read_crm_usuarios.sql`).

Prevention Rule:
**Empty Search Queries Must Match Everything & User Directory Read Access**: Toda función de coincidencia de texto debe retornar `true` ante un query vacío. Tablas transversales de lectura como `CRM_Usuarios` deben tener políticas `FOR SELECT TO public` para evitar listas vacías durante la carga y refresco de tokens.

Tags:
[ui] [search] [filtering] [users] [utils] [rls] [supabase]

## [Bug ID: 20260827-02]

Context:
Búsqueda y filtrado multi-módulo (`lib/utils.ts`, `lib/hooks/useAccountsServer.ts`, `lib/hooks/useOpportunitiesServer.ts`, `lib/hooks/useActivitiesServer.ts`, `lib/hooks/useContactsServer.ts`, `lib/hooks/useProducts.ts`, `app/pedidos/page.tsx`, `components/usuarios/UserList.tsx`, `components/cuentas/UserPickerFilter.tsx`, `components/ui/SearchableSelect.tsx`, `components/tiendas/CreateStoreSaleForm.tsx`, `components/comisiones/`).

Problem:
Al buscar palabras con tildes, en orden invertido o con múltiples términos, el buscador no encontraba registros o devolvía resultados imprecisos debido a substrings rígidos en `ilike` y comparaciones `.includes()` sensibles a diacríticos. Además, en componentes de servidor (`useAccountsServer.ts`, etc.) faltaba posfiltrado estricto con tokens normalizados.

Root Cause:
1. `ilike` en SQL/PostgREST es sensible a acentos ('É' != 'e') y solo busca subcadenas contiguas exactas.
2. Los filtros en memoria (`localAccounts`, `data.filter`, `cmdk` en `SearchableSelect`) usaban `toLowerCase().includes()`, fallando ante tildes y palabras fuera de orden.
3. `matchesSearchTokens` no soportaba arrays de campos simultáneos.

Fix Applied:
1. Se extendió `matchesSearchTokens` en `lib/utils.ts` para soportar strings individuales o arrays de campos, normalizando acentos (`removeAccents`) y verificando que todos los tokens estén presentes en cualquier orden.
2. Se añadió `getSearchTokens` en `lib/utils.ts` para tokenizar búsquedas en el servidor Supabase.
3. Se integró `matchesSearchTokens` y tokenización en todos los hooks de servidor y vistas cliente (`useAccountsServer`, `useOpportunitiesServer`, `useActivitiesServer`, `useContactsServer`, `useProducts`, `app/pedidos`, `UserList`, `UserPickerFilter`, `SearchableSelect`, `CreateStoreSaleForm`, `CommissionCategoryManager`, `BonusRulesManager`, `CommissionRuleForm`).
4. Se agregó filtro personalizado con `matchesSearchTokens` a `<Command>` en `SearchableSelect.tsx`.

Prevention Rule:
**Universal Token Search**: Toda búsqueda de usuario (servidor y cliente) debe tokenizarse, ser insensible a mayúsculas/minúsculas y acentos (`removeAccents`), y buscar en arrays de campos con `matchesSearchTokens`.

Tags:
[search] [filtering] [normalization] [accents] [tokens] [performance]

## [Bug ID: 20260828-01]

Context:
`lib/db.ts`, `lib/sync.ts`, hooks CRUD offline y layout autenticado.

Problem:
Una sesion podia reutilizar datos IndexedDB de otro usuario y un cierre entre guardar la entidad y crear su mutacion de outbox podia producir un cambio local imposible de sincronizar.

Root Cause:
La base Dexie era un singleton compartido y la identidad local no era una frontera de almacenamiento. Entidades y outbox se confirmaban en transacciones separadas.

Fix Applied:
Se activo una base fisica por `user.id`; la migracion legado se reclama una sola vez y conserva el origen. Se introdujo `commitLocalChanges()` para confirmar datos y outbox en la misma transaccion y se migraron los hooks activos. Los reintentos reutilizan el `mutation_id` persistido y la UI muestra `Guardado`, `Pendiente` o `Requiere atencion`.

## [Bug ID: 20260831-01]

Context:
`lib/sync.ts`, `lib/hooks/useAccounts.ts`, `components/cuentas/AccountForm.tsx`, `app/cuentas/nueva/CreateAccountWizard.tsx`, `lib/pedidoFormalization.ts` y tabla `CRM_Cuentas` en Supabase/PostgreSQL.

Problem:
Al guardar o editar una cuenta sin NIT en el CRM o tiendas, la sincronización fallaba y la mutación caía en `DEAD_LETTER`:
`duplicate key value violates unique constraint "idx_crmcuentas_nit_base_root" [Context: _complete_snapshot_ (UPDATE)]`

Root Cause:
1. El formulario/código enviaba `nit_base: ""` (cadena vacía) en lugar de un valor único o no permitía cuentas sin NIT. Para PostgreSQL, `""` es un valor de texto real (`"" = ""` en índices únicos), por lo que la segunda cuenta guardada con texto vacío violaba la restricción de unicidad de cuentas principales `idx_crmcuentas_nit_base_root`.
2. Las cuentas creadas en tiendas o ferias sin NIT no tenían un identificador formal asignado, pero tampoco debían poder generar pedidos formales sin antes registrar el NIT real numérico del cliente.

Fix Applied:
1. Se creó `lib/nitUtils.ts` con `generateProvisionalNit()`, `isProvisionalNit()` y `isValidRealNit()`.
2. Toda cuenta creada o modificada sin NIT recibe automáticamente un NIT alfanumérico provisional único `PROV-XXXXXXXX`.
3. `SyncEngine` sanitiza defensivamente `CRM_Cuentas` asegurando que `nit_base` nunca viaje vacío o nulo hacia PostgreSQL.
4. En `lib/pedidoFormalization.ts`, `getMissingPedidoFormalizationFields()` valida que `pedido.nit_cliente_final` sea un NIT real numérico (`isValidRealNit()`), bloqueando la formalización y descarga del PDF hasta que el usuario actualice el NIT provisional al NIT real.
5. Se creó la migración `20260831_backfill_provisional_nits.sql` para actualizar cuentas históricas en la base de datos.

Prevention Rule:
**Provisional Unique Identifiers for Partial Domain Entities**: Nunca enviar cadenas vacías (`""`) a columnas con restricciones de unicidad en PostgreSQL. Cuando una entidad requiera identificación posterior, asignarle un identificador provisional alfanumérico único (`PROV-...`) y proteger las operaciones de orden/facturación validando estrictamente el formato real del dominio.

Tags:
[accounts] [nit] [provisional-id] [sync] [dead-letter] [unique-constraint] [pedidos] [formalization]

## [Bug ID: 20260902-01]

Context:
Búsqueda y asignación de colaboradores de Microsoft en el modal de actividades (`CreateActivityModal.tsx`, `lib/microsoft.ts`, `app/api/microsoft/users/route.ts`).

Problem:
Al buscar colaboradores en el paso 3 del wizard de actividades (ej. "luis"), la interfaz no mostraba resultados y desplegaba "No se encontraron personas con \"luis\"".

Root Cause:
1. `searchMicrosoftUsers` en `lib/microsoft.ts` utilizaba en primer orden la API de People Search (`search/query` con entidad `person`), la cual solo indexa interacciones recientes del usuario autenticado; cuando esta respondía HTTP 200 con `hits: []`, retornaba prematuramente un array vacío y nunca ejecutaba las rutas de búsqueda en el directorio del tenant (`/users`).
2. La constante `SCOPES` en `lib/microsoft.ts` no incluía `User.ReadBasic.All`, `User.Read.All` ni `People.Read`.
3. La autenticación en la ruta `/api/microsoft/users` dependía de cookies SSR de un solo chunk (`get(name)` en vez de `getAll()`) y carecía de soporte para token Bearer en cabecera `Authorization`. Si la sesión cookie no estaba presente, retornaba 401 en vez de resolver sobre el directorio de colaboradores.
4. El cliente en `CreateActivityModal.tsx` no enviaba cabecera `Authorization` ni tenía fallback de cliente hacia `CRM_Usuarios` si la API remota tardaba o no respondía.

Fix Applied:
1. Se reestructuró `searchMicrosoftUsers` para buscar en Azure AD vía `https://graph.microsoft.com/v1.0/users?$search=` con header `ConsistencyLevel: eventual`, y como respaldos secuenciales `users?$filter=startsWith(...)`, People Search (`search/query`) y `/me/people`.
2. Se incorporaron `User.ReadBasic.All`, `User.Read.All` y `People.Read` en `SCOPES`.
3. En `app/api/microsoft/users/route.ts`: se migró a `createClient()` de `@/lib/supabase/server` con soporte de cookies chunked (`getAll()`) y lectura de cabecera `Authorization: Bearer <token>`. Si no hay sesión o tokens de Microsoft, consulta `CRM_Usuarios` garantizando siempre HTTP 200 con colaboradores.
4. En `CreateActivityModal.tsx`: la llamada a `/api/microsoft/users` envía la cabecera `Authorization` de la sesión activa, y además implementa un fallback de cliente directo a `CRM_Usuarios` en Supabase si la API remota no retorna resultados o falla la red.
5. Se crearon las suites de pruebas en `pruebas unitarias/microsoftUsersSearch.test.ts` y `pruebas unitarias/microsoftUsersApi.test.ts`.

Prevention Rule:
**Multi-Tier Directory & Fallback Pattern for Graph/Identity Integrations**: Para búsquedas en directorios de Microsoft 365 / Entra ID, consultar siempre `/users` del tenant con `$search` o `$filter` en lugar de limitar la consulta a contactos personales recientes (`person`), y siempre proveer fallbacks encadenados para no devolver arreglos vacíos por respuestas 200 sin hits. En endpoints auxiliares de búsqueda, tolerar auth desacoplada y proveer fallback a datos locales.

Tags:
[microsoft-graph] [azure-ad] [activities] [users-search] [planner] [fallback] [auth-headers]

---

## [Bug ID: 20260902-02]

Context:
Módulo de oportunidades (`lib/hooks/useOpportunitiesServer.ts`, `app/oportunidades/page.tsx`). Filtro por canal, paginación en servidor y maquetación de la tabla Handsontable.

Problem:
1. Al filtrar por canal en oportunidades, el número de registros no disminuía (permanecía en 6882).
2. El filtro tardaba segundos en responder y congelaba la interfaz.
3. Se cargaban las 6882 oportunidades completas en el DOM/Handsontable, inutilizando la paginación y el botón "Cargar más resultados".
4. Experiencia de doble barra de desplazamiento (scroll del contenedor general `<main>` y scroll interno de Handsontable).

Root Cause:
1. `useOpportunitiesServer.ts` solicitaba `vendedor:CRM_Usuarios(full_name)` sin desambiguar la clave foránea. Al existir dos relaciones entre `CRM_Oportunidades` y `CRM_Usuarios` (`owner_user_id` y colaboradores), PostgREST respondía con error HTTP 300 / `PGRST201: Could not embed because more than one relationship was found`.
2. La consulta fallaba y caía al bloque `catch`. En el bloque `catch`, se realizaba un volcado masivo de `db.opportunities.toArray()` sin aplicar el filtro de canal (`channelFilter`) ni paginación (`pageSize`), cargando los 6882 registros de IndexedDB directamente a `data`.
3. En `app/oportunidades/page.tsx`, la altura fija de `HotTable` sumada a los encabezados, contador flotante superior, botón "Cargar más" inferior y padding `pb-12` sobrepasaba el viewport de `<main id="main-content">`, provocando que el contenedor general desplegara una barra vertical externa adicional a la barra interna de la tabla.

Fix Applied:
1. Se especificó la relación foránea explícita `vendedor:CRM_Usuarios!owner_user_id(full_name)` en `useOpportunitiesServer.ts`, resolviendo la ambigüedad en PostgREST y permitiendo que la consulta retorne el conteo exacto y 100 registros en ~100ms.
2. Se unificó la lógica de filtrado y paginación en `fetchOffline` compartida por modo offline y el bloque `catch`, aplicando `channelFilter` y `localOpps.slice(from, to + 1)`.
3. En `app/oportunidades/page.tsx`, se integró el pie de tabla con contador y paginación dentro de la tarjeta desktop, se adaptó la altura dinámica de la tabla (`calc(100vh - 280px)` / `calc(100vh - 490px)`), se ocultó el contador flotante exterior en desktop y se aisló el botón inferior para móvil (`md:hidden`), eliminando el desbordamiento de `<main>` y suprimiendo la doble barra de desplazamiento.
4. Se incorporaron pruebas unitarias en `pruebas unitarias/oportunidades.test.ts`.

Prevention Rule:
**Explicit Ambiguous Foreign Key Disambiguation in PostgREST and In-Card Table Pagination Layout**:
1. Cuando existan múltiples relaciones entre dos tablas en Supabase, siempre desambiguar en `.select()` con `!foreign_key_column` para prevenir fallos `PGRST201`.
2. Los bloques de fallback nunca deben cargar colecciones completas sin filtrar ni paginar.
3. Para evitar doble scrollbar en vistas con tablas de datos, integrar contadores y paginadores dentro de la tarjeta y dimensionar la tabla al espacio restante del viewport sin exceder el contenedor de la página.

Tags:
[postgrest] [pgrst201] [opportunities] [channel-filter] [pagination] [double-scrollbar] [handsontable] [offline-fallback]

---

## [Bug ID: 20260902-03]

Context:
Cálculo de resumen de actividades en oportunidades (`lib/opportunityActivities.ts`, `components/activities/CreateActivityModal.tsx`, `lib/hooks/useOpportunitiesServer.ts`).

Problem:
Una oportunidad ("remodelación casa") aparecía en la vista con el badge rojo de "1 atrasada" a pesar de que su única tarea pendiente ("validación de desarrollo") tenía fecha de vencimiento futura programada para el 9 de septiembre de 2026.

Root Cause:
1. En `CreateActivityModal.tsx`, las actividades de tipo `TAREA` solo exponen en la interfaz el campo "Fecha Vencimiento" asociado a `fecha_inicio`. El campo `fecha_fin` (oculto para tareas) se inicializaba por defecto con la hora del sistema + 1 hora al abrir el modal (`2026-09-02T23:08:00`) y nunca se actualizaba con la fecha elegida por el usuario.
2. `computeOpportunityActivitySummary` en `lib/opportunityActivities.ts` evaluaba únicamente `fecha_fin`. Al transcurrir la hora de apertura (11:08 p.m.), el comparador `actDate < nowTime` resultaba verdadero, marcando la tarea como vencida en el pasado inmediato a pesar de tener `fecha_inicio` en el futuro.
3. En `useOpportunitiesServer.ts`, la consulta de actividades no solicitaba `fecha_inicio` ni `tipo_actividad`.

Fix Applied:
1. En `lib/opportunityActivities.ts`, se actualizó `computeOpportunityActivitySummary` para priorizar `fecha_inicio` cuando `tipo_actividad === 'TAREA'` o cuando `fecha_fin` sea inconsistente (anterior a `fecha_inicio`).
2. En `CreateActivityModal.tsx`, se configuró la sincronización reactiva de `fecha_fin = fecha_inicio` cuando el tipo es `TAREA`, tanto en el efecto de cambio de fecha como en el saneamiento previo al `submit`.
3. En `useOpportunitiesServer.ts`, se agregaron `fecha_inicio` y `tipo_actividad` a la subconsulta de actividades de Supabase.
4. Se corrigió el registro de la actividad en base de datos y se agregaron pruebas en `pruebas unitarias/opportunityActivities.test.ts`.

Prevention Rule:
**Semantic Due Date Evaluation for Activities and Tasks**: En actividades de tipo tarea, `fecha_fin` debe coincidir con `fecha_inicio` (fecha de vencimiento). Los algoritmos de clasificación de estado deben evaluar la fecha semántica apropiada según el tipo y protegerse contra valores residuales huérfanos generados en la inicialización de formularios.

Tags:
[activities] [opportunities] [due-date] [task-deadline] [overdue-calculation] [form-initial-state]

---

## [Bug ID: 20260903-01]

Context:
Módulo de contactos (`app/contactos/page.tsx`). Selección y edición de contactos desde el listado global.

Problem:
Al hacer clic en cualquier contacto del listado para abrir su vista de edición o detalle, la aplicación crasheaba con pantalla blanca arrojando el error de Next.js / React:
"Application error: a client-side exception has occurred while loading crm-64yu.vercel.app (see the browser console for more information)".

Root Cause:
Violación estricta de las **Rules of Hooks** de React:
1. En `app/contactos/page.tsx`, existía un retorno condicional temprano en la línea ~351:
   `if (selectedAccountIdForCreate || editingContact) { return (...); }`
2. Los hooks `useCurrentUser()`, `useState` (para `colWidths`) y `useEffect` (para persistencia de anchos de columna de Handsontable en `localStorage`) estaban declarados en la línea ~382, es decir, **después** del retorno condicional anterior.
3. Cuando el usuario seleccionaba un contacto, `editingContact` cambiaba de `undefined` a un objeto válido, provocando que el componente retornara anticipadamente y se saltara la ejecución de dichos hooks. React detectó una cantidad diferente de hooks llamados entre renders sucesivos y disparó la excepción client-side.

Fix Applied:
1. Se reubicaron `useCurrentUser()`, el estado `colWidths` y su respectivo `useEffect` al inicio de la función `ContactsContent()`, junto a las demás declaraciones de hooks y antes de cualquier retorno condicional.
2. Se verificó que los módulos hermanos (`app/cuentas/page.tsx` y `app/oportunidades/page.tsx`) no tuvieran retornos tempranos antes de sus llamadas a hooks.

Prevention Rule:
**Strict React Hooks Top-Level Invariance**:
Nunca colocar llamadas a Hooks (`use*`, `useState`, `useEffect`, `useCallback`, etc.) debajo de declaraciones `return` condicionales o dentro de bloques `if / else`. Todos los hooks de un componente deben ejecutarse incondicionalmente y en el mismo orden exacto en cada ciclo de render.

Tags:
[react] [rules-of-hooks] [client-side-exception] [contacts] [conditional-return] [handsontable-col-widths]

