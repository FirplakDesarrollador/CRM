# Registro de procedimientos QA - CRM FIRPLAK

La fuente ejecutable unica es `quality/stages.mjs`. El bloque siguiente es su representacion determinista y `npm run qa:drift` falla si diverge.

<!-- GENERATED-STAGES:START -->
| ID | Nivel | Objetivo | Comando | Requerida | Timeout | Dependencias |
|---|---|---|---|---:|---:|---|
| harness-tests | quick, gate, release | Prueba las reglas de estados, dependencias, trinquetes y artefactos del propio harness. | `node --test quality/qa.test.mjs` | si | 30000 ms | - |
| drift | quick, gate, release | Evita divergencia entre registro, comandos npm, documentos, reglas espejo y CI. | `node quality/checks.mjs drift` | si | 30000 ms | harness-tests |
| safe-change-policy | quick, gate, release | Bloquea nuevas supresiones, pruebas enfocadas o exclusiones que debiliten controles. | `node quality/checks.mjs policy` | si | 30000 ms | drift |
| type-ratchet | quick, gate, release | Impide nuevos errores TypeScript por archivo y codigo estable. | `node quality/checks.mjs type-ratchet` | si | 120000 ms | safe-change-policy |
| lint-ratchet | quick, gate, release | Impide nuevas infracciones ESLint por archivo y regla sin tolerar ruido de carpetas ignoradas. | `node quality/checks.mjs lint-ratchet` | si | 180000 ms | safe-change-policy |
| product-tests | quick, gate, release | Ejecuta las pruebas Vitest versionadas del CRM y aplica el trinquete por caso exacto. | `node quality/checks.mjs test-ratchet` | si | 120000 ms | safe-change-policy |
| migration-static | gate, release | Comprueba orden, identidad, RLS y protecciones estaticas de las migraciones versionadas. | `node quality/checks.mjs migrations` | si | 30000 ms | drift |
| e2e-chromium | gate, release | Valida los tres harnesses de UI para cuentas y actividades en Chromium conservando trazas. | `npx playwright test --config=playwright.e2e.config.ts --project=chromium` | si | 180000 ms | product-tests |
| production-build | gate, release | Empaqueta la PWA Next.js con el mismo comando usado para entrega. | `npm run build` | si | 600000 ms | type-ratchet, lint-ratchet, product-tests |
| pwa-offline-e2e | gate, release | Instala la PWA construida, valida sus helpers y recarga el shell publico sin red. | `npx playwright test --config=playwright.pwa.config.ts --project=chromium` | si | 300000 ms | production-build |
| database-replay | gate, release | Reconstruye una base desechable y ejecuta contratos RLS con dos identidades. | `node quality/checks.mjs database-replay` | no | 300000 ms | migration-static |
| external-contracts | gate, release | Reserva los contratos reales de Microsoft, Supabase y ForceManager para ejecucion autorizada. | `node quality/checks.mjs external-contract-summary` | no | 30000 ms | - |
| diff-review | release | Exige confirmacion humana de que el diff no elimina ni debilita contratos. | `node quality/checks.mjs confirmation QA_DIFF_REVIEWED` | si | 10000 ms | production-build, e2e-chromium, pwa-offline-e2e |
| ci-review | release | Exige confirmar que el gate remoto correspondiente termino correctamente. | `node quality/checks.mjs confirmation QA_CI_REVIEWED` | si | 10000 ms | diff-review |
| human-approval | release | Exige aprobacion humana final antes de integrar o desplegar. | `node quality/checks.mjs confirmation QA_HUMAN_APPROVED` | si | 10000 ms | ci-review |
<!-- GENERATED-STAGES:END -->

## Procedimientos a demanda

| Procedimiento | Nombre humano | Cuando | Comando | Duracion esperada | Bloqueante / artefactos |
|---|---|---|---|---|---|
| `qa:focused` | Prueba enfocada del cambio CRM | RED, GREEN y tras cada cambio significativo | `npm run qa:focused -- <archivo.test.ts>` | 5-180 s | Si; logs del framework y artefactos Playwright si aplica. Sin archivo falla por cero pruebas. |
| `qa:quick` | Verificacion rapida del CRM | Antes de entregar una iteracion local | `npm run qa:quick` | 1-5 min | Si; `.tmp/qa-results/<run>/`. Requiere autorizacion previa del usuario. |
| `qa:gate` | Gate de entrega del CRM | Antes de PR, merge o release | `npm run qa:gate` | 5-15 min, hoy puede excederlo | Si; resumen JSON, logs, `.next`, trazas y reportes E2E. Requiere autorizacion previa. |
| `qa:drift` | Auditoria de deriva QA | Al cambiar reglas, CI, scripts o documentos | `npm run qa:drift` | <30 s | Si; salida de consola. |
| `qa:baseline:update` | Reduccion de deuda heredada | Solo despues de corregir deuda | `npm run qa:baseline:update`; aplicar con `npm run qa:baseline:update -- --apply` | 1-5 min | Solo acepta reducciones; genera `.tmp/qa-results/baseline.candidate.json` y exige revisar el diff. |
| `qa:incident` | Memoria de regresion CRM | Tras un incidente o bug importante | `npm run qa:incident -- --id <ID> --flow <R#> --summary "..."` | <10 s | Crea `docs/failures/<fecha>-<id>.md`; nunca sobrescribe. |
| `qa:release` | Entrega protegida | Despues de gate y CI | `npm run qa:release` con `QA_DIFF_REVIEWED=1`, `QA_CI_REVIEWED=1`, `QA_HUMAN_APPROVED=1` | Gate + revision | Si; no despliega ni integra por si solo. |
| `qa:contract:microsoft` | Contrato Microsoft OIDC | Manual/programado, con autorizacion | `npm run qa:contract:microsoft` | <30 s | Fuera del gate; requiere `QA_ALLOW_EXTERNAL_CONTRACTS=1` y configuracion Microsoft. No afirma Graph. |
| `qa:contract:supabase` | Disponibilidad Supabase Auth | Manual/programado, con autorizacion | `npm run qa:contract:supabase` | <30 s | Fuera del gate; read-only. No afirma RLS ni escrituras. |
| `qa:contract:forcemanager` | Contrato SAP/ForceManager | Manual cuando exista sandbox | `npm run qa:contract:forcemanager` | No estimada | Actualmente `NOT_CONFIGURED`: falta endpoint sandbox y operacion read-only acordada. |

## Significado de resultados

- `VERIFIED`: el comando se ejecuto y paso. Solo este estado satisface una etapa requerida.
- `FAILED`: el control se ejecuto y encontro regresion, timeout o error operativo.
- `SKIPPED`: omision deliberada. Bloquea si la etapa era requerida.
- `NOT_CONFIGURED`: falta secreto, sandbox, fuente autoritativa o aprobacion. Bloquea si era requerida y siempre aparece en el resumen.
- `NOT_RUN`: una dependencia no fue `VERIFIED`; nunca se presenta como aprobada.

El proceso retorna exito solo si todas las etapas requeridas estan `VERIFIED`. Los exit codes reservados son `0=VERIFIED`, `77=SKIPPED`, `78=NOT_CONFIGURED`; cualquier otro valor es `FAILED`.
