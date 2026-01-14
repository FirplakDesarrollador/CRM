# Instructivo de Configuración del Proyecto

Sigue estos pasos para clonar y ejecutar el proyecto correctamente.

## 1. Clonar el repositorio

Si aún no has clonado el proyecto, ejecuta:

```bash
git clone <URL_DEL_REPOSITORIO>
cd CRM
```

*(Reemplaza `<URL_DEL_REPOSITORIO>` con la URL real de tu repositorio Git)*.

## 2. Configurar Variables de Entorno

Crea o modifica el archivo `.env` en la raíz del proyecto con el siguiente contenido:

```env
NEXT_PUBLIC_SUPABASE_URL=https://lnphhmowklqiomownurw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTIwMzQwMjUsImV4cCI6MjAwNzYxMDAyNX0.FHCOWrVp-K-7qrM3CtYmYaqiOqwzsX_Au7pLm-MN3eQ
```

## 3. Instalar Dependencias

Ejecuta el siguiente comando para instalar todas las librerías necesarias:

```bash
npm install
```

## 4. Ejecutar el Proyecto

Para iniciar el servidor de desarrollo:

```bash
npm run dev
```

El proyecto estará disponible en `http://localhost:3000`.

## Comandos Adicionales

- **Construir para producción:** `npm run build`
- **Iniciar en producción:** `npm start`
- **Verificar código (Lint):** `npm run lint`
