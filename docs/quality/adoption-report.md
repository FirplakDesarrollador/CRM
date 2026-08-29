# Informe de adopcion del harness QA

## Alcance instalado

- Orquestador en Node.js, coherente con el stack npm existente.
- Tres niveles: `qa:focused`, `qa:quick`, `qa:gate`; `qa:release` agrega aprobaciones humanas.
- Estados explicitos y resumen JSON por corrida en `.tmp/qa-results/`.
- Trinquetes monotonicamente decrecientes para ESLint, TypeScript, Vitest y supresiones de politica.
- Drift entre comandos, etapas, documentos, CI y copias de instrucciones.
- Memoria estructurada de incidentes vinculada a `bugs-knowhow.md`.
- CI nuevo con permisos de solo lectura y el comando local exacto `npm run qa:gate`.

## Decisiones adaptadas al repositorio

- Vitest queda acotado a pruebas del CRM; los `.spec.ts` de Playwright no se cargan como unitarias y `n8n-mcp` ignorado no contamina resultados.
- El gate usa solo Chromium porque los tres E2E actuales prueban harnesses locales y no justifican todavia una matriz triple.
- Los contratos Microsoft, Supabase y ForceManager quedan fuera del gate. Requieren autorizacion explicita y nunca reciben secretos ficticios.
- El replay de base es opcional y visible como `NOT_CONFIGURED`: 95 migraciones existen localmente, pero no todas estan versionadas y no hay base desechable autoritativa.
- El build sigue usando el comando existente. El harness no oculta su timeout ni afirma que `ignoreBuildErrors` sea seguro.

## Estado de ejecucion

- Baseline inicial adoptado: 847 hallazgos ESLint en 239 identidades; 0 errores TypeScript; 9 identidades Vitest heredadas; 25 supresiones/exclusiones en 20 identidades de politica.
- Pruebas enfocadas finales del harness: 12/12 pasaron.
- `qa:drift`: `VERIFIED` con 14 etapas, 10 comandos y tres copias de instrucciones identicas.
- `qa:gate`: ejecutado con autorizacion el 2026-08-28. Resultado `FAILED` por una etapa requerida; evidencia en `.tmp/qa-results/2026-08-29T01-25-42-469Z-gate/summary.json`.
- Las etapas equivalentes a `qa:quick` quedaron todas `VERIFIED` dentro del gate; `qa:quick` no se ejecuto como comando separado.

### Resultado del gate autorizado

| Etapa | Estado | Duracion | Evidencia principal |
|---|---|---:|---|
| harness-tests | VERIFIED | 956 ms | 12/12 casos |
| drift | VERIFIED | 229 ms | 14 etapas, 10 comandos, reglas espejo |
| safe-change-policy | VERIFIED | 339 ms | 20 identidades iguales al baseline |
| type-ratchet | VERIFIED | 9.072 s | 0 errores TypeScript |
| lint-ratchet | VERIFIED | 10.818 s | 239 identidades; 585 errores y 262 advertencias heredados, sin aumento |
| product-tests | VERIFIED por trinquete | 3.143 s | 33 casos: 32 pasan y 1 fallo heredado; 9 identidades de deuda sin aumento |
| migration-static | FAILED | 395 ms | 22 migraciones locales no versionadas |
| e2e-chromium | VERIFIED | 10.053 s | 3/3 specs pasaron |
| production-build | VERIFIED | 47.480 s | Next/PWA compilo y genero 45 paginas; el build omitio tipos, cubiertos separadamente |
| database-replay | NOT_RUN, opcional | 0 | dependencia `migration-static` no verificada |
| external-contracts | NOT_CONFIGURED, opcional | 0 | fuera del gate sin autorizacion especifica |

El gate termino correctamente con exit code 1: no produjo un falso verde. Para verificar `migration-static`, deben incorporarse o descartarse conscientemente las 22 migraciones locales hoy ignoradas; este trabajo no altera ese historial sin una decision del propietario.

El build actualizo los artefactos rastreados `public/sw.js` y `next-env.d.ts`, como hace la configuracion PWA/Next existente. Se dejan visibles en el working tree y no se presentan como cambios fuente del harness. Tambien se preservaron cambios concurrentes ajenos en layout, health check, calidad de red y wiki.

## Limites de CI

El workflow detecta y hace visible un gate fallido en PR y `main`. No se verifico configuracion de branch protection, por lo que no se afirma que impida merge. El workflow previo `revision-produccion.yml` continua existiendo y su aprobacion automatica no sustituye este gate ni la aprobacion humana de `qa:release`.
