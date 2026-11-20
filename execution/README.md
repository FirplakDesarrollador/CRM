# Execution Scripts Directory

Este directorio contiene los **scripts determinísticos** en Python que ejecutan las tareas.

## Propósito
Scripts confiables, testeables y rápidos que manejan:
- Llamadas a APIs
- Procesamiento de datos
- Operaciones de archivos
- Interacciones con base de datos

## Principios
1. **Determinístico**: Mismo input = mismo output
2. **Bien comentado**: Cada script debe documentar su propósito
3. **Manejo de errores**: Capturar y reportar errores claramente
4. **Variables de entorno**: Usar `.env` para credenciales

## Estructura Recomendada

```python
#!/usr/bin/env python3
"""
Script: [nombre_script].py
Propósito: [Descripción breve]
Directiva: directives/[directiva_relacionada].md

Inputs:
    - [arg1]: [Descripción]
    
Outputs:
    - [output1]: [Descripción]
    
Ejemplo:
    python script.py --arg1 valor
"""

import os
from dotenv import load_dotenv

load_dotenv()

def main():
    # Implementación
    pass

if __name__ == "__main__":
    main()
```

## Scripts Disponibles
- `migrate_vtiger_opportunities.mjs`: Script determinístico de migración y homologación completa de oportunidades (fases, fechas ISO, cargo de contacto, subclasificación de cuenta, bitácora de comentarios, actividades históricas, categorías comerciales y propagación de correos). Directiva asociada: `directives/migracion_completa_oportunidades_vtiger.md`.
