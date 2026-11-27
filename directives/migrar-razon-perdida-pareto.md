# Directiva: Migración de Razón de Pérdida (Pareto) desde MySQL (Vtiger) a Supabase

## Objetivo
Poblar el campo `razon_perdida` de las oportunidades cerradas-perdidas de un asesor con los datos del sistema anterior (MySQL/Vtiger), usando el CSV exportado como fuente de verdad.

## Aprendizajes clave

### Campo correcto en la UI
- La UI en `app/oportunidades/[id]/page.tsx` usa el campo **`razon_perdida`** (texto), NO `razon_perdida_id` (integer FK).
- Desde 2026-11-24 el dropdown ya no usa el array `LOSS_REASONS`. Lee las filas activas de `CRM_RazonesPerdida` (`lib/lossReasonCatalog.ts`) y guarda el `descripcion` exacto. Una razón nueva activa aparece al recargar el detalle, sin cambiar código. `is_active = false` no se ofrece. La tabla no tiene canal: N-, RED- e INT- no filtran el desplegable.
- El texto migrado tiene que coincidir exactamente con `descripcion` (el id 34 trae un espacio final). Si no hay fila activa con ese texto, el valor histórico sigue viéndose como opción suelta, pero no se puede volver a elegir.
- El campo `razon_perdida_id` corresponde al modal legacy `LossReasonModal.tsx` (no es el que se muestra en la página de detalle). Ese modal usa el mismo filtro de activas.

### Trigger de sincronización
- **SIEMPRE actualizar `updated_at = NOW()`** cuando se hacen UPDATEs directos en Supabase vía MCP o SQL Editor.
- Sin esto, el motor de sync del CRM ignora el cambio (compara `updated_at > lastSync`).

### Bloqueo de outbox
- Si el sync descarga correctamente pero la UI no refleja el cambio, probablemente la oportunidad tiene un registro PENDING en el outbox de Dexie.
- Solución para el usuario: `indexedDB.deleteDatabase('crmdb')` en la consola del browser, luego recarga.

## Proceso paso a paso (para cualquier asesor)

### 1. Obtener las razones únicas del CSV del asesor
```bash
node .tmp/check_razones.js  # Ver distribución Closed Lost en CSV
```

### 2. Mapear razones MySQL → texto exacto de la UI
El campo `razon_perdida` en Supabase debe coincidir EXACTAMENTE con `CRM_RazonesPerdida.descripcion` de una fila activa. Referencia histórica (ya no es una lista fija en el código):
- `"N- No responde 1mer contacto"` ← MySQL: `"N- No responde 1mer contacto"`
- `"RED- Firplak Home"` ← MySQL: `"RED- Firplak Home"`
- `"RED- Ser. Tecnico"` ← MySQL: `"RED- Ser. Tecnico"`
- `"RED- Distribución"` ← MySQL: `"RED- Distribución"`
- `"Precio"`, `"Diseño"`, `"Competencia"`, etc.

Si la razón en MySQL no tiene equivalente, hay que dar de alta una fila activa en `CRM_RazonesPerdida`. No se vuelve a añadir al código.

### 3. Generar y ejecutar SQL de actualización (vía MCP Supabase)
```sql
UPDATE "CRM_Oportunidades" 
SET razon_perdida = '<razón exacta>', updated_at = NOW()
WHERE owner_user_id = '<UUID del asesor>'
  AND estado_id = 3
  AND nombre IN ('<lista de nombres de oportunidades>');
```

### 4. Verificar
```sql
SELECT id, nombre, razon_perdida, razon_perdida_id, updated_at 
FROM "CRM_Oportunidades" 
WHERE owner_user_id = '<UUID>' AND estado_id = 3
ORDER BY updated_at DESC;
```

## Datos de referencia — Asesor Hernando Tovar Mendoza
- **UUID Supabase**: `5b7fb6e5-1c8b-4f76-a8be-af49f7a66c31`
- **CSV fuente**: `.tmp/oportunidades_migradas.csv`
- **Total Closed Lost en CSV**: 42 oportunidades
  - 29 sin razón en MySQL (campo vacío en Vtiger)
  - 11 → "RED- Firplak Home"
  - 2 → "N- No responde 1mer contacto"
- **Ejecutado**: 2026-09-29

## Archivos relacionados
- `.tmp/oportunidades_migradas.csv` — CSV de migración de Hernando (fuente MySQL)
- `.tmp/gen_update.js` — Generador de SQL de UPDATE por razón
- `.tmp/check_razones.js` — Extrae razones únicas de un CSV
- `generate_import.js` — Script de migración original (MySQL → Supabase)
- `app/oportunidades/[id]/page.tsx` — UI del detalle de oportunidad (campo `razon_perdida`)
