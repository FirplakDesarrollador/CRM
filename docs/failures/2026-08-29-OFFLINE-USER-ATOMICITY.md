# OFFLINE-USER-ATOMICITY - Datos locales cruzados y guardados sin outbox atomico

- Fecha: 2026-08-29
- Flujo critico: R2
- Estado: CORREGIDO

## Impacto

Una unica base IndexedDB era compartida por sesiones del mismo navegador y varios hooks escribian primero la entidad local y despues la mutacion. Al cambiar de usuario podia mostrarse cache ajena; un cierre entre ambas escrituras podia dejar un cambio visible localmente que nunca llegaria al servidor. La cola tampoco exponia un estado consistente entre pendiente y agotada.

## Causa raiz

`db` era un singleton global sin identidad de sesion. La identidad se inferia en algunos puntos desde `localStorage`, que no delimita fisicamente los datos. Ademas, las operaciones CRUD y `queueMutation()` usaban transacciones separadas. Un fallo, recarga o cierre en ese intervalo rompia la garantia entidad-outbox. Los reintentos ya disponian de mutaciones persistentes, pero no habia una prueba permanente que exigiera conservar el mismo `mutation_id`.

## Prevencion

Se crea una base Dexie por `user.id` autenticado y se bloquea el render de rutas protegidas hasta activarla. La base legado se asigna una sola vez al primer usuario tras la actualizacion, sin borrarla. `commitLocalChanges()` guarda entidades y una o varias mutaciones en una unica transaccion Dexie. Los hooks activos de cuentas, contactos, actividades, oportunidades, cotizaciones y pedidos usan esa frontera. El reintento conserva la fila y el `mutation_id`; la UI resume la cola como `Guardado`, `Pendiente` o `Requiere atencion`.

## Deteccion permanente

- Prueba que falla antes de la correccion: aislamiento/reapertura en `lib/local-database.test.ts`, rollback atomico e idempotencia en `lib/sync-engine.test.ts`, estados en `lib/sync-runtime.test.ts`.
- Etapa QA que la ejecuta: `product-tests` de `qa:gate`; el descubrimiento incluye archivos versionados y nuevos no ignorados.
- Identidad estable del caso: `local database user isolation`; `rolls back the local entity when writing its outbox mutation fails`; `retries with the same mutation identity instead of creating a duplicate operation`; `exposes only the three discreet save states`.

## Evidencia

RED: `.tmp/qa-results/2026-08-29T02-14-22-288Z-focused` fallo por APIs aun inexistentes; `.tmp/qa-results/2026-08-29T02-30-46-975Z-focused` detecto un cursor legado cruzado; `.tmp/qa-results/2026-08-29T02-25-11-884Z-focused` detecto el primer intento de reintento no verificado correctamente.

GREEN: `npm run qa:focused -- lib/local-database.test.ts lib/sync-runtime.test.ts lib/sync-engine.test.ts lib/hooks/useFormAutoSave.test.tsx` dio 16/16 en `.tmp/qa-results/2026-08-29T02-33-48-034Z-focused`; los tres recorridos E2E dieron 3/3 en `.tmp/qa-results/2026-08-29T02-33-48-022Z-focused`; `npx tsc --noEmit --pretty false` termino sin errores. `node quality/checks.mjs test-ratchet` encontro 28 suites y no aumento la deuda heredada. `qa:gate` no se ejecuto por instruccion del usuario.

## Riesgo residual

No se ha probado el cambio real entre dos usuarios contra Supabase/RLS, la concurrencia entre multiples pestanas ni una actualizacion con una IndexedDB de volumen productivo. `markAsWinner` confirma atomicamente cada entidad, pero no es una sola transaccion para todo el agregado comercial. Los contratos remotos y `qa:gate` permanecen sin ejecutar.
