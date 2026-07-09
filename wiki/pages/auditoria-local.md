# Auditoría Local (Historial de Modificaciones)

El CRM Firplak registra localmente las modificaciones y creaciones de datos por usuario para ofrecer visibilidad inmediata del historial reciente en el dispositivo sin impactar la base de datos principal de Supabase.

## Arquitectura del Log

El registro de auditoría es **puramente local y offline-first**, persistido en el `localStorage` mediante un store de Zustand con middleware de persistencia (`useAuditLogStore`).

### Registro Centralizado en SyncEngine
Todo cambio de datos offline-first se encola a través del método `queueMutation` de `SyncEngine` (`lib/sync.ts`). Hemos interceptado este flujo para:
1. **Determinar la Acción:** Consulta de forma asíncrona la tabla correspondiente de Dexie por `entityId`. Si el registro existe es un `UPDATE`; si no existe, es un `CREATE`.
2. **Resolver el Nombre Legible:**
   - Para entidades maestras, utiliza campos como `nombre`, `full_name`, `asunto`, o `numero_cotizacion`.
   - Para líneas de detalle (`CRM_CotizacionItems`, `CRM_PedidoItems`), recupera contextualmente la cotización o pedido padre de Dexie y la asocia al nombre del producto, ej: `Mezclador Lavamanos en COT-052139`.
3. **Detalles de Cambios:** 
   - **En `CREATE`:** Registra un resumen legible de lo creado (ej: `Agregó item: Mezclador Lavamanos x5`).
   - **En `UPDATE`:** Filtra los campos internos y compara los valores campo a campo contra el registro en Dexie antes del cambio. Si el valor de un campo es distinto, lo incluye con su valor anterior y nuevo (ej: `Modificó: cantidad (2 → 5), total_amount (120000 → 300000)`). Si no hay cambios reales en los valores (común en re-guardados de snapshots), omite el registro para evitar ruido.
4. **Persistencia:** Almacena los últimos 50 registros de auditoría en la UI del dispositivo mediante `useAuditLogStore.getState().addLog(...)`.

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
