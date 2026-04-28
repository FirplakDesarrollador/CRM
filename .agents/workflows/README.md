# .agents/workflows/

**Workflows** de Antigravity: `.md` que **tú** invocas explícitamente como slash-comando (`/update-version`, `/test-responsive`, etc.).

> ⚠️ Si el agente debe invocarlo solo según contexto, va en [`../skills/`](../skills/), no aquí.
>
> ⚠️ Los `.workflow.ts` de n8n viven en [`../../workflows/`](../../workflows/), no en esta carpeta.

## Archivos

| Workflow | Slash | Propósito |
| :-- | :-- | :-- |
| `test-responsive.md` | `/test-responsive` | Auditoría de diseño responsivo móvil en todos los módulos |
| `update-version.md` | `/update-version` | Bump de versión del CRM en todos los archivos afectados |

## Formato

```markdown
---
description: Una línea clara de qué hace el workflow cuando el usuario lo invoca
---

# Título

Pasos numerados con herramientas concretas (`grep_search`, `replace_file_content`, etc.).
```

## Reglas

- **Un workflow por archivo**. No clonar variantes con nombre distinto — editar el existente.
- Si detectas que el agente podría invocarlo solo al ver cierto contexto (en vez de esperar que tú lo pidas), muévelo a [`../skills/`](../skills/).
