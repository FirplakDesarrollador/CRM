---
description: Mantiene el LLM Wiki (wiki/) sincronizado con el código - operaciones de query, ingest y lint según wiki/SCHEMA.md.
---

# LLM Wiki Maintainer

## Objetivo

Mantener `wiki/` como un artefacto de conocimiento persistente y confiable sobre el CRM Firplak. Las reglas completas viven en `wiki/SCHEMA.md` — este skill es el resumen operativo.

## Estructura

- `wiki/INDEX.md` — catálogo: una línea por página. SIEMPRE se lee primero.
- `wiki/LOG.md` — registro cronológico de operaciones (lo más reciente arriba).
- `wiki/pages/<slug>.md` — páginas en español, kebab-case, con enlaces `[[slug]]` y sección `## Fuentes`.
- `wiki/SCHEMA.md` — reglas y convenciones completas.

## Operación QUERY (responder preguntas)

1. Lee `wiki/INDEX.md` y localiza las páginas relevantes.
2. Lee solo esas páginas; ve al código solo si falta información.
3. Si la respuesta sintetizada es valiosa y reusable, conviértela en página nueva o sección, actualiza `INDEX.md` y registra en `LOG.md`.

## Operación INGEST (después de cambios de código)

Ejecutar cuando un cambio altera lógica de negocio, modelo de datos, migraciones, permisos o módulos:

1. Identifica qué páginas del wiki quedan afectadas (un cambio puede tocar varias).
2. Actualiza esas páginas: hechos respaldados por código, nunca especulación. Marca incertidumbres con `⚠️ (por verificar)`.
3. Si aparece un módulo/concepto nuevo, crea su página y añádela a `INDEX.md` con descripción de una línea.
4. Añade una entrada a `LOG.md`: fecha — operación — resumen de páginas tocadas.

## Operación LINT (salud del wiki)

Bajo demanda (workflow `/wiki-lint`): busca contradicciones entre páginas, afirmaciones obsoletas frente al código actual, enlaces `[[...]]` rotos y páginas huérfanas. Corrige o reporta, y registra en `LOG.md`.

## Prohibido

- Poner en el wiki: credenciales, instrucciones de agente (van en GEMINI.md/AGENTS.md), bugs puntuales (van en `bugs-knowhow.md`).
- Escribir afirmaciones sin fuente en el código.
- Dejar `INDEX.md` o `LOG.md` desactualizados tras tocar páginas.
