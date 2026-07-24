# Auditoría Local (Historial de Modificaciones)

El CRM Firplak registra localmente las modificaciones y creaciones de datos por usuario para ofrecer visibilidad inmediata del historial reciente en el dispositivo sin impactar la base de datos principal de Supabase.

## Arquitectura del Log

El registro de auditoría es **puramente local y offline-first**, persistido en el `localStorage` mediante un store de Zustand con middleware de persistencia (`useAuditLogStore`).

### Registro Centralizado en Hooks de Dexie
Todo cambio de datos offline-first se intercepta de forma reactiva y nativa a nivel de base de datos local usando los **hooks globales de Dexie** (`creating` y `updating`) en [lib/auditHooks.ts](file:///c:/Users/isaza/OneDrive/Documentos/CRM%20FIRPLAK/CRM/lib/auditHooks.ts). Esto garantiza la comparación precisa del estado original contra el modificado antes de que se persista en disco:

1. **Aislamiento de la Sincronización:** Para evitar registrar cambios de fondo provenientes del servidor (como descargas de red del SyncEngine), el motor establece la propiedad `db.isPulling = true` durante el ciclo de sync, bloqueando temporalmente el encolamiento de auditoría en los hooks de Dexie.
2. **Determinar la Acción:** 
   - El hook `creating` clasifica la acción como `CREATE`.
   - El hook `updating` la clasifica como `UPDATE`.
3. **Resolver el Nombre Legible:**
   - Para entidades maestras, utiliza campos como `nombre`, `full_name`, `asunto`, o `numero_cotizacion`.
   - Para líneas de detalle (`quoteItems`, `pedidoItems`), recupera contextualmente la cotización o pedido padre de Dexie y la asocia al nombre del producto, ej: `Mezclador Lavamanos en COT-052139`.
4. **Detalles de Cambios:** 
   - **En `CREATE`:** Registra un resumen legible de lo creado (ej: `Agregó item: Mezclador Lavamanos x5`).
   - **En `UPDATE`:** El hook recibe `mods` (sólo las claves modificadas) y `obj` (el registro anterior original). Compara los valores campo por campo (filtrando campos internos) y genera la transición `(valor_anterior → valor_nuevo)` (ej: `Modificó: cantidad (2 → 5), total_amount (120000 → 300000)`). Si no hay cambios reales en los valores, omite el registro.
5. **Persistencia y Desacoplamiento:** Los logs se encolan asíncronamente con `setTimeout(..., 0)` para liberar de inmediato la transacción de Dexie y se guardan en `useAuditLogStore`.

### Modelo de Datos del Log (`AuditLogItem`)

```typescript
export interface AuditLogItem {
    id: string; // uuid autogenerado localmente
    user_email: string; // Email del usuario que realizó la acción
    entity_type: string; // Tabla de Supabase (ej. 'CRM_Cuentas')
    entity_id: string; // ID único del registro
    entity_name: string; // Nombre amigable resuelto
    action_type: 'CREATE' | 'UPDATE' | 'DELETE';
    timestamp: number; // Marca de tiempo local
    details: string; // Detalles legibles del cambio
}
```

## Interfaz Gráfica

El historial se muestra de forma premium al final de la vista de Configuración (`/configuracion`):
- **Diseño responsivo:** Tarjeta premium con scroll interno para un máximo de 10 elementos visibles a la vez (de un total de 50 en memoria).
- **Indicadores Visuales:** Iconos temáticos de Lucide-React y badges coloreados según la entidad y tipo de acción (Creación en verde, Modificación en azul).
- **Mantenimiento:** Botón para limpiar de forma segura el historial en el dispositivo.

## Fuentes
- `lib/stores/useAuditLogStore.ts` (Persistencia Zustand)
- `lib/sync.ts` (Interceptación en `queueMutation`)
- `app/configuracion/page.tsx` (Componente de interfaz gráfica)
