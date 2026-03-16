---
description: Actualiza la versión de la aplicación CRM en todos los archivos necesarios
---

Este workflow automatiza la tarea de subir la versión de la aplicación (por ejemplo, pasando de 1.0.7.9 a 1.0.8.0) a lo largo de todo el código base del proyecto.

1. Pregunta al usuario cuál es la **versión actual** y cuál será la **nueva versión** (o bien, calcúlala incrementando lógicamente el último o penúltimo dígito).
2. Utiliza la herramienta `grep_search` para buscar la versión actual exacta (ej. "1.0.7.9") en todo el directorio del proyecto. 
   - Excluye siempre archivos generados automáticamente y dependencias (ej. `package-lock.json`, `node_modules`, `.next`, `dist`, `build`).
   - Presta especial atención a archivos de configuración importantes como `package.json`, archivos `.env`, configuración de dependencias, y vistas principales de UI que puedan renderizar la versión.
3. Utiliza las herramientas de edición de archivos (`replace_file_content` o `multi_replace_file_content`) para reemplazar el número de versión anterior por el nuevo número de versión en todos los archivos identificados.
4. Una vez todos los archivos hayan sido actualizados, notifica al usuario con una lista de los archivos modificados.
// turbo
5. Ejecuta los comandos de git para asegurar que estás en la rama `alejo` (`git checkout alejo` o asimilarlo), agrega los archivos modificados, y realiza un commit con el mensaje: `chore: bump version to [NUEVA_VERSION]`.
