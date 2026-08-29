# Regresiones conocidas y controles

La memoria historica detallada continua en `bugs-knowhow.md`. Esta vista conecta las familias de fallos mas graves con el harness actual.

| Familia | Evidencia historica | Flujo | Control actual | Estado |
|---|---|---:|---|---|
| Datos cruzados entre sesiones, guardado local sin outbox, perdida/duplicacion de mutaciones y dead letters | `bugs-knowhow.md`; `lib/local-database.test.ts`; `lib/sync-runtime.test.ts`; `lib/sync-engine.test.ts` | R2 | `product-tests`, `type-ratchet` | VERIFIED enfocado: 16/16; `product-tests` incluye archivos nuevos no ignorados |
| Pedidos sin cantidades/campos SAP o identidad incorrecta | `bugs-knowhow.md`; `lib/pedidoFormalization.ts`; `pruebas unitarias/pedidoFormalization.test.ts` | R4 | `product-tests` | INFERRED; formalizacion tiene casos, persistencia completa no |
| RLS o RPC de sync con privilegios excesivos | `supabase/migrations/20260821230051_harden_sync_engine.sql` | R1, R2 | `migration-static`; `database-replay` | Estatico parcial; contrato real NOT_CONFIGURED |
| Estado de formularios perdido al cambiar pestañas o pasos | `bugs-knowhow.md`; tres specs en `e2e/` | R3, R6 | `e2e-chromium` | Configurado; gate aun no ejecutado tras adopcion |
| Loops de router y render por sincronizacion de URL | `bugs-knowhow.md` | R3 | Lint por trinquete | INFERRED; no hay prueba de regresion dedicada |
| Supresiones, errores de tipos ignorados y pruebas debilitadas | `next.config.mjs`; fuentes con supresiones heredadas | Transversal | `safe-change-policy`, `type-ratchet`, `lint-ratchet` | Proteccion monotona; deuda heredada declarada |
| Migraciones locales ausentes del control de versiones | `supabase/migrations/`; `.gitignore` | R1-R8 | `migration-static` | BROKEN: 22 archivos locales no versionados bloquean `qa:gate` |

Una regresion nueva se registra con `npm run qa:incident`. La nota debe identificar la prueba RED, la etapa que la ejecuta y la evidencia GREEN.
