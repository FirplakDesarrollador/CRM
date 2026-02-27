# Sistema de Notificaciones - Actividades Vencidas

## Descripción General

El sistema de notificaciones ahora incluye un nuevo tipo de evento: **Actividad Vencida** (`ACTIVITY_OVERDUE`). Este tipo permite notificar automáticamente a los usuarios cuando una tarea o evento no se ha marcado como completado después de un número configurable de días desde su vencimiento.

## Configuración

### Crear una Regla de Actividad Vencida

1. Navega a **Configuración → Notificaciones** (`/configuracion/notificaciones`)
2. Haz clic en **"Nueva Regla"**
3. Selecciona **"Actividad Vencida"** como tipo de evento
4. Configura los siguientes parámetros:

#### Parámetros de Configuración

- **Nombre de la Regla**: Un nombre descriptivo para identificar la regla
- **Días después del vencimiento**: Número de días después de la fecha de vencimiento para generar la notificación
  - `0 días`: Notifica el mismo día del vencimiento
  - `1 día`: Notifica un día después del vencimiento
  - `2+ días`: Notifica después del número especificado de días
- **Destinatarios**: Quién recibirá la notificación
  - Vendedor Asignado
  - Coordinador / Gerente
- **Canales**: Cómo se enviará la notificación
  - Aplicación (Campana) ✅ Implementado
  - Correo Electrónico ⏳ Pendiente
  - Microsoft Teams ⏳ Pendiente

### Ejemplo de Configuración

**Regla**: "Actividades Vencidas 2 días"
- **Tipo**: Actividad Vencida
- **Días**: 2
- **Destinatario**: Vendedor Asignado
- **Canal**: Aplicación (Campana)

Esta regla generará una notificación 2 días después de que una actividad haya vencido y no se haya completado.

## Funcionamiento Técnico

### Base de Datos

#### Tabla: `CRM_NotificationRules`
```sql
{
  "type": "ACTIVITY_OVERDUE",
  "config": {
    "days": 2  -- Días después del vencimiento
  },
  "recipients": ["SELLER"],
  "channels": ["APP"],
  "is_active": true
}
```

#### Tabla: `CRM_Notifications`
Las notificaciones generadas se almacenan con:
- `type`: "ACTIVITY_OVERDUE"
- `entity_type`: "ACTIVITY"
- `entity_id`: ID de la actividad vencida
- `message`: Descripción de la actividad y días de vencimiento

### Función de Verificación

La función `check_overdue_activities()` se encarga de:

1. Buscar todas las reglas activas de tipo `ACTIVITY_OVERDUE`
2. Para cada regla, calcular el umbral de vencimiento basado en los días configurados
3. Encontrar todas las actividades que:
   - No están completadas (`is_completed = false`)
   - Tienen fecha de inicio anterior al umbral
   - No están eliminadas
   - No tienen una notificación reciente (últimas 24 horas)
4. Crear notificaciones para los usuarios asignados

### Ejecución Periódica

⚠️ **IMPORTANTE**: La función `check_overdue_activities()` debe ejecutarse periódicamente para generar las notificaciones.

#### Opciones de Ejecución:

1. **Cron Job Manual** (Recomendado para desarrollo):
   ```sql
   SELECT check_overdue_activities();
   ```

2. **pg_cron** (Si está disponible en Supabase):
   ```sql
   SELECT cron.schedule(
     'check-overdue-activities',
     '0 9 * * *',  -- Ejecutar diariamente a las 9 AM
     $$SELECT check_overdue_activities()$$
   );
   ```

3. **Edge Function con Cron** (Supabase):
   - Crear una Edge Function que llame a la función
   - Configurar un cron job en Supabase para ejecutarla diariamente

4. **Servicio Externo**:
   - Configurar un servicio como GitHub Actions, Vercel Cron, o similar
   - Hacer una llamada HTTP a un endpoint que ejecute la función

## Visualización de Notificaciones

Las notificaciones de actividades vencidas aparecen en:

1. **Icono de Campana** (parte superior derecha)
   - Icono: ⚠️ Alerta roja
   - Fondo: Rojo claro
   - Título: "Actividad Vencida"
   - Mensaje: "La actividad '[nombre]' está vencida desde hace [X] días"

2. **Link Directo**: Al hacer clic, navega a `/actividades?id=[activity_id]`

## Tipos de Notificación Disponibles

El sistema ahora soporta 5 tipos de notificaciones:

1. ✅ **Cliente Inactivo** (`INACTIVE_CLIENT`)
2. ✅ **Actividad Vencida** (`ACTIVITY_OVERDUE`) - **NUEVO**
3. ✅ **Nueva Cuenta Asignada** (`NEW_ACCOUNT`)
4. ✅ **Nueva Oportunidad Asignada** (`NEW_OPPORTUNITY`)
5. ✅ **Fallo de Presupuesto** (`BUDGET_MISS`)

## Próximos Pasos

Para implementar completamente el sistema de notificaciones de actividades vencidas:

1. ✅ Crear el tipo de notificación
2. ✅ Actualizar la base de datos
3. ✅ Crear la función de verificación
4. ⏳ Configurar la ejecución periódica (cron job)
5. ⏳ Implementar canales adicionales (Email, Teams)

## Notas Técnicas

- Las notificaciones se marcan como leídas al hacer clic en ellas
- No se crean notificaciones duplicadas para la misma actividad en 24 horas
- Las actividades eliminadas (`is_deleted = true`) no generan notificaciones
- Las actividades completadas (`is_completed = true`) no generan notificaciones
