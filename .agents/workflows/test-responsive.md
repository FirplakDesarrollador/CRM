---
description: Ejecuta pruebas exhaustivas de diseño responsivo móvil (visual y de código) en todos los módulos principales.
---

# Workflow: Pruebas de Responsividad Móvil (/test-responsive)

Este workflow combina exploración visual e inspección estática del código base para evaluar el comportamiento en interfaces móviles. Sigue los pasos al pie de la letra, en orden.

## Paso 1: Exploración Visual Interactiva

// turbo
1. Instancia la herramienta `browser_subagent` asignándole la siguiente tarea ("Task"):
   > "Por favor, visita `http://localhost:3000/`. Cambia el tamaño del viewport a dimensiones exactas de un iPhone (ej. 375x812 o aproximación similar según tus opciones). Tu objetivo es recorrer los módulos principales de la aplicación para detectar fallos visuales en responsive. Específicamente, verifica:
   > - Menú principal y navegación.
   > - Módulos: Inicio, Cuentas, Contactos, Actividades, Oportunidades, Pedidos, Comisiones, Indicadores, Archivos, Usuarios y Configuración.
   > - Busca elementos superpuestos, texto que desborde sin ocultarse, o barras de scroll horizontal a nivel global del documento (fuera de contenedores específicos de tablas). Toma nota de todos los errores de UI encontrados. Cuando hayas recorrido todos los módulos accesibles, retorna un reporte explícito de tus hallazgos."
   El subagente deberá ejecutarse completamente antes de pasar al siguiente paso.

## Paso 2: Análisis Estático de Código (Tailwind)

2. Utiliza tu herramienta `grep_search` para inspeccionar el directorio de código bajo `components/`, `app/` y `lib/` (enfocándote principalmente en vistas de la UI). Debes buscar patrones de clases Tailwind CSS que comúnmente rompen la experiencia móvil. Presta particular atención a:
   - Anchos fijos mayores al tamaño de un viewport móvil (ej. `w-[400px]`, `w-96`, `w-[500px]`).
   - El uso de `w-screen` o `h-screen`, que pueden interactuar mal con la navegación móvil en PWA o en Safari IOS.
   - Márgenes y paddings extremos sin responsive triggers: busca cosas como `p-10`, `m-12`, `px-16` que debieran idealmente ser de este estilo `p-4 md:p-10`.
   - Modales (cajas flotantes) que carezcan de directivas de overflow para prevenir que la información se vuelva inaccesible verticalmente.

## Paso 3: Generación del Reporte de Pruebas

3. Tras recolectar los hallazgos del subagente (Paso 1) y los hallazgos de código (Paso 2), sintetiza toda la información en un formato claro para el usuario.
   - Crea un reporte consolidado oArtifact (ej. `responsive_audit_report.md` en la carpeta de la conversación actual).
   - El reporte debe agrupar los problemas detectados en cada módulo o categoría (ej. Modal Activities superpone menú inferior).
   - Finaliza el reporte con propuestas de pasos inmediatos o código (`replacementChunks`) listos para ser aplicados como fix si el usuario decide aprobarlos.

## Paso 4 (Opcional): Auto-Corrección según instrucción

4. Si el usuario te dio instrucciones de auto-corregir o si le presentaste las soluciones y te da la orden de implementarlas:
   - Usa `replace_file_content` o `multi_replace_file_content` basándote en un mapeo preciso de líneas originadas en tus comandos de lectura o búsqueda. Corrige de forma incremental y pide validación una vez listos todos los reemplazos de Tailwind.
