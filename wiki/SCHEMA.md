# SCHEMA del Wiki — Reglas de Mantenimiento

> Este documento define la estructura, convenciones y flujos de trabajo del wiki.
> Convierte al LLM en un "mantenedor disciplinado de wiki" en lugar de un chatbot genérico.
> Basado en el patrón LLM Wiki de Karpathy (gist 442a6bf555914893e9891c11519de94f).

## Propósito

Este wiki es un **artefacto persistente y acumulativo** de conocimiento sobre el CRM Firplak.
No es documentación generada una vez y olvidada: se actualiza cada vez que el código cambia
de forma relevante, y cada respuesta buena a una pregunta puede convertirse en una página nueva.

- **Fuente cruda (inmutable para el wiki):** el código del repositorio (`app/`, `lib/`, `components/`, `supabase/`). El wiki lo lee, nunca lo modifica.
- **El wiki (este directorio):** páginas markdown generadas y mantenidas por el LLM.
- **El schema (este archivo):** las reglas del juego.

## Estructura de directorios

```
wiki/
├── SCHEMA.md      ← este archivo: reglas y convenciones
├── INDEX.md       ← catálogo: una línea por página, siempre al día
├── LOG.md         ← registro cronológico de operaciones sobre el wiki
└── pages/         ← las páginas de conocimiento
    └── <slug>.md
```

## Convenciones de páginas

1. **Nombre de archivo:** slug en kebab-case, en español (`comisiones.md`, `sincronizacion-offline.md`).
2. **Estructura de cada página:**
   - Título `#` con el nombre del módulo/concepto.
   - Párrafo inicial: qué es y para qué sirve, en 2-4 frases.
   - Secciones con el detalle funcional.
   - Sección final `## Fuentes` con las rutas de código que respaldan lo escrito.
3. **Enlaces cruzados:** usar `[[slug]]` para referirse a otra página del wiki. Enlazar generosamente; un `[[slug]]` que aún no existe marca una página pendiente de escribir, no un error.
4. **Idioma:** español (el dominio del negocio y el equipo son hispanohablantes). Los términos técnicos de código quedan en su forma original (`SyncEngine`, `outbox`, `LWW`).
5. **Hechos, no especulación:** todo lo afirmado debe estar respaldado por código o migraciones existentes. Si algo es incierto, marcarlo con `⚠️ (por verificar)`.

## Operaciones

### Ingest (ingesta)
Cuando cambia el código de forma relevante (nuevo módulo, cambio de lógica de negocio, migración importante):
1. Leer el cambio (diff, migración, archivo nuevo).
2. Actualizar las páginas afectadas — un cambio puede tocar varias.
3. Actualizar `INDEX.md` si hay páginas nuevas o descripciones que cambian.
4. Añadir una línea a `LOG.md` con fecha y resumen.

### Query (consulta)
Al responder preguntas sobre el CRM:
1. Leer primero `INDEX.md` para localizar páginas relevantes.
2. Leer solo esas páginas; ir al código solo si el wiki no basta.
3. Si la respuesta sintetizada es valiosa y reusable, convertirla en página nueva o sección.

### Lint (revisión de salud)
Periódicamente, o cuando el usuario lo pida:
- Detectar contradicciones entre páginas.
- Detectar afirmaciones obsoletas frente al código actual.
- Detectar páginas huérfanas (sin enlaces entrantes) y enlaces `[[...]]` rotos que merezcan página.
- Registrar el resultado en `LOG.md`.

## Qué NO va en el wiki

- Instrucciones de agente (eso vive en `CLAUDE.md` / `AGENTS.md`).
- Bugs puntuales y su know-how (eso vive en `bugs-knowhow.md`; el wiki puede enlazarlo).
- Credenciales, tokens o URLs con claves.
- Código copiado en masa; solo fragmentos mínimos ilustrativos.
