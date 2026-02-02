# Debugging de Actividades del CRM

## Objetivo
Diagnosticar y solucionar problemas relacionados con las actividades (tareas y eventos) del CRM Firplak.

## Contexto
Las actividades en el CRM funcionan con sincronización offline-first:
1. Los datos se guardan localmente en IndexedDB (Dexie)
2. Se sincronizan con Supabase cuando hay conexión
3. Las fechas deben manejarse considerando zona horaria Colombia (UTC-5)

## Inputs
- Descripción del problema del usuario
- ID de actividad (si aplica)
- Logs de consola del navegador

## Flujo de Diagnóstico

### 1. Problemas de Fechas
Si el usuario reporta fechas incorrectas (ej: selecciona día X pero se guarda día X-1):

**Causa típica**: El input `type="date"` devuelve formato `YYYY-MM-DD` que JavaScript interpreta como UTC medianoche, causando desfase de un día.

**Solución**: Usar la función `toISODateString()` en `lib/hooks/useActivities.ts` que parsea fechas solo-día como hora local.

**Archivos relevantes**:
- `components/activities/CreateActivityModal.tsx` - Formulario de actividades
- `lib/hooks/useActivities.ts` - Hook de creación/actualización
- `lib/date-utils.ts` - Utilidades de fecha para Colombia

### 2. Actividades No Aparecen
Si las actividades no se muestran en Agenda o Todo:

**Verificar**:
1. ¿Existen en Supabase? → Revisar tabla `CRM_Actividades`
2. ¿Se sincronizaron a local? → Revisar IndexedDB en DevTools
3. ¿El filtro de fecha está correcto? → Verificar `parseColombiaDate()`

**Archivos relevantes**:
- `lib/sync/index.ts` - Motor de sincronización
- `app/actividades/page.tsx` - Vista de agenda

### 3. Clasificaciones No Cargan
Si el select de clasificación está vacío:

**Verificar**:
1. ¿Existen en `CRM_ClasificacionActividad`?
2. ¿El sync las trajo? → Revisar `db.activityClassifications.toArray()`

## Outputs
- Diagnóstico del problema
- Corrección aplicada (si es posible)
- Actualización de esta directiva con aprendizajes

## Aprendizajes
- [2026-01-27]: Problema de zona horaria en fechas de tareas. Input type="date" requiere parseo especial como hora local, no UTC. Implementado `toISODateString()` en useActivities.ts.
