# Configuración de Ejecución Automática - Notificaciones de Actividades Vencidas

## ✅ Edge Function Desplegada

La Edge Function `check-overdue-activities` ha sido desplegada exitosamente en Supabase.

**Detalles:**
- **ID**: `261360a5-386d-43ec-8739-b99b4a56318c`
- **Nombre**: `check-overdue-activities`
- **Estado**: ACTIVE
- **Versión**: 1
- **JWT Verificado**: Sí (requiere autenticación)

## 🔗 URL de la Función

```
https://lnphhmowklqiomownurw.supabase.co/functions/v1/check-overdue-activities
```

## 🧪 Probar la Función Manualmente

### Opción 1: Desde el Dashboard de Supabase

1. Ve a **Edge Functions** en el dashboard de Supabase
2. Selecciona `check-overdue-activities`
3. Haz clic en **Invoke** para ejecutarla manualmente

### Opción 2: Usando cURL

```bash
curl -X POST \
  'https://lnphhmowklqiomownurw.supabase.co/functions/v1/check-overdue-activities' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json'
```

Reemplaza `YOUR_ANON_KEY` con tu clave anon de Supabase (disponible en Settings → API).

### Opción 3: Desde el Script Local

```bash
npx tsx scripts/check-overdue-activities.ts
```

## ⏰ Configurar Ejecución Automática (Cron)

### Opción A: Supabase Cron (Recomendado)

Supabase ofrece cron jobs nativos para Edge Functions. Para configurarlo:

1. **Desde el Dashboard de Supabase:**
   - Ve a **Database** → **Cron Jobs**
   - Crea un nuevo cron job con:
     - **Nombre**: `check-overdue-activities-daily`
     - **Schedule**: `0 9 * * *` (Diariamente a las 9 AM)
     - **Command**: 
       ```sql
       SELECT
         net.http_post(
           url:='https://lnphhmowklqiomownurw.supabase.co/functions/v1/check-overdue-activities',
           headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
         ) as request_id;
       ```

2. **Usando SQL (pg_cron):**

```sql
-- Habilitar la extensión pg_cron si no está habilitada
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Crear el cron job
SELECT cron.schedule(
  'check-overdue-activities-daily',
  '0 9 * * *',  -- Ejecutar diariamente a las 9 AM (UTC)
  $$
  SELECT
    net.http_post(
      url:='https://lnphhmowklqiomownurw.supabase.co/functions/v1/check-overdue-activities',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    ) as request_id;
  $$
);
```

### Opción B: GitHub Actions

Crea `.github/workflows/check-overdue-activities.yml`:

```yaml
name: Check Overdue Activities

on:
  schedule:
    # Ejecutar diariamente a las 9 AM UTC
    - cron: '0 9 * * *'
  workflow_dispatch: # Permite ejecución manual

jobs:
  check-activities:
    runs-on: ubuntu-latest
    steps:
      - name: Call Edge Function
        run: |
          curl -X POST \
            'https://lnphhmowklqiomownurw.supabase.co/functions/v1/check-overdue-activities' \
            -H 'Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}' \
            -H 'Content-Type: application/json'
```

Agrega `SUPABASE_ANON_KEY` a los secrets del repositorio.

### Opción C: Vercel Cron (Si usas Vercel)

Crea un API route en `app/api/cron/check-activities/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Verificar que la petición viene de Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const response = await fetch(
      'https://lnphhmowklqiomownurw.supabase.co/functions/v1/check-overdue-activities',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

Luego configura en `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/check-activities",
    "schedule": "0 9 * * *"
  }]
}
```

## 📊 Monitorear la Ejecución

### Ver Logs de la Edge Function

1. Ve a **Edge Functions** en Supabase
2. Selecciona `check-overdue-activities`
3. Ve a la pestaña **Logs**

### Verificar Notificaciones Creadas

```sql
SELECT 
  id,
  user_id,
  title,
  message,
  created_at,
  is_read
FROM "CRM_Notifications"
WHERE type = 'ACTIVITY_OVERDUE'
ORDER BY created_at DESC
LIMIT 20;
```

### Estadísticas

```sql
-- Notificaciones creadas hoy
SELECT COUNT(*) as total_today
FROM "CRM_Notifications"
WHERE type = 'ACTIVITY_OVERDUE'
AND created_at >= CURRENT_DATE;

-- Notificaciones por usuario
SELECT 
  u.nombre,
  u.email,
  COUNT(*) as notification_count
FROM "CRM_Notifications" n
JOIN "CRM_Usuarios" u ON n.user_id = u.id
WHERE n.type = 'ACTIVITY_OVERDUE'
AND n.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY u.id, u.nombre, u.email
ORDER BY notification_count DESC;
```

## 🔧 Configuración de Horarios

### Ejemplos de Cron Expressions

```
0 9 * * *     # Diariamente a las 9 AM
0 */6 * * *   # Cada 6 horas
0 9 * * 1-5   # Lunes a Viernes a las 9 AM
0 9,14 * * *  # Diariamente a las 9 AM y 2 PM
*/30 * * * *  # Cada 30 minutos
```

**Nota**: Los horarios están en UTC. Ajusta según tu zona horaria.

## ⚠️ Consideraciones Importantes

1. **Zona Horaria**: Los cron jobs en Supabase usan UTC. Colombia está en UTC-5.
2. **Rate Limits**: Supabase tiene límites de ejecución de Edge Functions según tu plan.
3. **Duplicados**: La función evita crear notificaciones duplicadas en 24 horas.
4. **Autenticación**: La función requiere un token de autorización válido.

## 🎯 Recomendación Final

Para producción, recomiendo usar **Supabase Cron (pg_cron)** porque:
- ✅ Nativo de Supabase
- ✅ No requiere servicios externos
- ✅ Fácil de configurar y monitorear
- ✅ Confiable y escalable

## 📝 Próximos Pasos

1. ✅ Edge Function desplegada
2. ⏳ Configurar cron job (elige una opción de arriba)
3. ⏳ Probar la ejecución manual
4. ⏳ Monitorear logs y notificaciones
5. ⏳ Ajustar horarios según necesidades del negocio
