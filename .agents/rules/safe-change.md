---
trigger: always_on
---

# Cambio seguro - CRM FIRPLAK

1. Lea `docs/quality/critical-flows.md`, `docs/quality/known-regressions.md` y la seccion aplicable de `bugs-knowhow.md`.
2. Declare que cambia, que preserva y que queda fuera de alcance.
3. Ejecute una prueba enfocada relacionada antes de editar; registre deuda preexistente.
4. Escriba primero una prueba que falle por la razon correcta (RED). No use skips, only, exclusiones, supresiones de lint/tipos ni artefactos generados para simular GREEN.
5. Implemente el cambio minimo y confirme GREEN con `npm run qa:focused -- <prueba>`.
6. Ejecute pruebas relacionadas despues de cada cambio significativo.
7. Pida autorizacion explicita antes de `npm run qa:quick` o `npm run qa:gate`.
8. Revise el diff buscando eliminaciones, cambios de contratos, migraciones no append-only, secretos y pruebas debilitadas.
9. Para regresiones importantes use `npm run qa:incident` y vincule la prueba permanente.
10. Entregue comandos, estados, artefactos, deuda preservada y riesgos residuales. `SKIPPED`, `NOT_CONFIGURED` y `NOT_RUN` nunca equivalen a aprobado.

No modifique `quality/baseline.json` manualmente. `qa:baseline:update` solo puede reducir deuda y el diff resultante requiere revision humana.
