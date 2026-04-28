# .agents/skills/

**Skills** de Antigravity: `.md` que el agente invoca **automáticamente** cuando detecta que aplican al contexto. No los llamas tú explícitamente.

> Si el archivo lo lanzas tú con un slash (`/...`), va en [`../workflows/`](../workflows/), no aquí.

## Archivos

| Skill | Trigger contextual |
| :-- | :-- |
| `bugs-knowhow-enforcer.md` | Antes/después de generar, modificar o refactorizar código (reforzado por la regla `always_on` en [`../rules/code-check.md`](../rules/code-check.md)) |
| `debugging.md` | Cuando se agrega una feature, se corrige un bug o se modifica lógica del CRM (exige `data-testid`, tests E2E y Playwright) |

## Formato

```markdown
---
description: Una línea describiendo cuándo el agente debe invocar este skill
---

# Título del skill

Pasos / reglas que el agente ejecuta al activarse.
```

## Reglas

- **Criterio skill vs workflow**: si la invocación es **decidida por el agente** al detectar contexto → skill. Si la lanza **el usuario** explícitamente → workflow.
- Los skills se invocan por nombre de archivo (sin extensión). Al renombrar, actualiza las referencias en [`../rules/`](../rules/) y demás skills.
