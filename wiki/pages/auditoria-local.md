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

## Auditoría Persistente en Base de Datos (`CRM_HistorialModificaciones`)

Para garantizar trazabilidad legal, operativa y corporativa permanente en la nube:
- **Tabla append-only:** `CRM_HistorialModificaciones` almacena cronológicamente cada cambio sobre oportunidades, cuentas y contactos.
- **Campos registrados:** `entity_type` ('OPORTUNIDAD' | 'CUENTA' | 'CONTACTO'), `entity_id`, `field_name`, `field_label`, `old_value`, `new_value`, `changed_by` (UUID), `changed_by_name` (nombre del usuario resuelto vía `get_audit_user_name`), `changed_at`.
- **Triggers automáticos en PostgreSQL:**
  - `trg_audit_opportunity_changes`: Audita cambios en fase, estado, vendedor asignado, monto/importe, motivo y comentarios de pérdida, fecha estimada de cierre y borrado suave.
  - `trg_audit_account_changes_full`: Audita cambios en nombre, NIT, canal, teléfono, correo, dirección, ciudad, propietario y borrado suave.
  - `trg_audit_contact_changes_full`: Audita cambios en nombre, cargo, teléfono, correo, cuenta asignada, contacto principal y borrado suave.
- **Visualización en UI:** Componente reutilizable `EntityAuditHistoryTab` integrado en:
  - Detalle de Oportunidad (`app/oportunidades/[id]/page.tsx`): pestaña *Historial*.
  - Detalle/Edición de Cuenta (`components/cuentas/AccountForm.tsx`): pestaña *Historial*.
  - Edición de Contacto (`components/contactos/ContactForm.tsx`): pestaña *Historial de Cambios*.

## Fuentes
- `lib/stores/useAuditLogStore.ts` (Persistencia Zustand en navegador)
- `lib/sync.ts` (Interceptación en `queueMutation`)
- `app/configuracion/page.tsx` (Componente de log local)
- `lib/hooks/useEntityAuditHistory.ts` (Hook de lectura de auditoría en Supabase)
- `components/shared/EntityAuditHistoryTab.tsx` (Componente visual de trazabilidad)
- `supabase/migrations/20261023100000_audit_history_log.sql` (Migración de BD)
