# Directives Directory

Este directorio contiene los **SOPs (Standard Operating Procedures)** en formato Markdown para agentes Claude / Gemini (capa 1 de la arquitectura descrita en `CLAUDE.md`).

## Ubicaciones relacionadas

| Carpeta | Para qué |
| :-- | :-- |
| `directives/` (esta) | SOPs de alto nivel para Claude/Gemini (`.md`) |
| `execution/` | Scripts Python determinísticos invocados por las directivas |
| `workflows/` | Workflows de **n8n** como `.workflow.ts` (sync con n8n Cloud) |
| `.agents/skills/` | **Skills** de Antigravity (`.md`) — el agente las invoca automáticamente según contexto |
| `.agents/workflows/` | **Workflows** de Antigravity (`.md`) — tú los lanzas con slash-comando |
| `.agents/rules/` | Reglas `always_on` de Antigravity |
| `docs/` | Documentación del proyecto (setup, features, guías operativas) |

## Propósito
Definir QUÉ hacer, con qué herramientas/scripts, y los casos especiales a considerar.

## Formato de Directivas
Cada directiva debe incluir:

```markdown
# [Nombre de la Directiva]

## Objetivo
[Descripción clara del objetivo]

## Inputs
- [Listado de inputs requeridos]

## Scripts/Herramientas
- `execution/[script].py` - [Descripción]

## Flujo
1. [Paso 1]
2. [Paso 2]
...

## Outputs
- [Descripción de outputs esperados]

## Casos Especiales / Edge Cases
- [Caso especial 1]
- [Caso especial 2]

## Aprendizajes
- [YYYY-MM-DD]: [Aprendizaje capturado]
```

## Directivas Disponibles
_Esta sección se actualiza conforme se crean nuevas directivas._
