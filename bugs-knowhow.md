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
