# Workflow: Despliegue a Main desde Rama `alejo`

Este workflow describe los pasos necesarios para desplegar cambios de forma segura desde la rama de trabajo `alejo` hacia la rama principal `main`, asegurando la verificación de compilación en GitHub y Vercel.

## Prerrequisitos
- Estar en la rama de desarrollo `alejo`.
- Asegurar que no hay conflictos sin resolver con `main`.

---

## Pasos del Proceso

### Paso 1: Subir cambios locales a GitHub
1. Guarda y agrega todos los archivos modificados:
   ```bash
   git add .
   ```
2. Realiza el commit con un mensaje descriptivo:
   ```bash
   git commit -m "feat: implementar cambios y configurar workflow de despliegue"
   ```
3. Sube la rama actual al repositorio remoto:
   ```bash
   git push origin alejo
   ```

### Paso 2: Validar Build de Preview (Rama `alejo`)
1. **GitHub**: Verifica en la pestaña de Actions o en la interfaz del repositorio que las pruebas automatizadas y chequeos pasen correctamente.
2. **Vercel**: 
   - Ve al panel de control del proyecto en Vercel.
   - Localiza el deployment generado para la rama `alejo`.
   - Asegúrate de que el estado sea **Ready** (exitoso) y prueba la URL de preview para verificar que todo funcione.

### Paso 3: Hacer Merge a `main`
Una vez comprobado que el build en la rama `alejo` funciona perfectamente:
1. Crea un **Pull Request** desde `alejo` hacia `main` en GitHub.
2. Si los checks automáticos del Pull Request son exitosos, realiza el merge.

### Paso 4: Validar Build Final en Producción
1. Al fusionar en `main`, Vercel iniciará automáticamente un despliegue de producción.
2. Ve al panel de Vercel y monitorea el despliegue de la rama `main`.
3. Valida que el estado final sea **Ready** (compilado exitosamente).
