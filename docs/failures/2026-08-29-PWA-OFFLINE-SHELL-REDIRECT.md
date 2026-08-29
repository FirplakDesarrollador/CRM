# PWA-OFFLINE-SHELL-REDIRECT - El proxy redirigia helpers generados del service worker a login, impidiendo instalar caches y recargar offline; e2e/pwa/offline-shell.spec.ts lo detecta permanentemente.

- Fecha: 2026-08-29
- Flujo critico: R9
- Estado: CORREGIDO

## Impacto

Todos los usuarios de la PWA quedaban sin una instalacion util del service worker: el shell no creaba caches y una recarga sin red terminaba en `ERR_INTERNET_DISCONNECTED`. Ademas, la politica generada podia persistir respuestas de API y del catch-all sin aislamiento por usuario.

## Causa raiz

El worker principal importaba `/fallback-<hash>.js`, pero el matcher de `proxy.ts` no trataba ese helper como recurso publico. El proxy respondia `307 /login`, por lo que el navegador intentaba ejecutar HTML como JavaScript y abortaba la instalacion. En paralelo, la configuracion Workbox incluia reglas `apis`, `others` y `start-url` demasiado amplias para una aplicacion autenticada.

## Prevencion

Se hicieron publicos los prefijos de artefactos PWA generados, se limito el precache documental a `/login` y `/offline`, y se eliminaron las caches de API, catch-all y raiz protegida. Las mutaciones, Dexie, outbox, autenticacion y modulos funcionales no se modificaron.

## Deteccion permanente

- Prueba que falla antes de la correccion: `e2e/pwa/offline-shell.spec.ts`
- Etapa QA que la ejecuta: `pwa-offline-e2e`, requerida en `qa:gate` despues de `production-build`
- Identidad estable del caso: `publica los helpers PWA como JavaScript y no cachea datos privados`; `instala el shell publico y recarga login sin internet`

## Evidencia

- RED: `npm run qa:focused -- e2e/pwa/offline-shell.spec.ts` devolvio `307` para `/fallback-ce627215c0e4a9af.js` y cero caches instaladas.
- GREEN: el mismo comando termino con 2/2 casos aprobados sobre `next start`.
- Build: `npm run build` genero correctamente `public/sw.js` y el helper Workbox versionado.
- Artefactos: `playwright-report-pwa/`, `test-results-pwa/` y `.tmp/qa-results/<run>/focused-tests.log`.

## Riesgo residual

Este caso cubre el shell publico. Siguen sin verificarse de extremo a extremo la recarga de un modulo autenticado con datos locales, una edicion offline seguida de resincronizacion y la actualizacion de version del worker con outbox pendiente.
