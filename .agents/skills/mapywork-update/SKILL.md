---
name: mapywork-update
description: Evalúa tras cada mejora, corrección o nuevo feature del CRM Firplak si el cambio amerita registrarse en los flujos operativos de mapywork (entorno FIRPLAK, área de Ventas) bajo 3 premisas estrictas, formula una propuesta al usuario y, solo tras su aprobación explícita, actualiza los flujos mediante el servidor MCP (`vibeworkflow`).
---

# mapywork Update Skill — Entorno FIRPLAK (Área de Ventas)

Skill para sincronizar de forma **justa, moderada y justificada** los flujos estándar y macroflujos de **FIRPLAK** (especialmente el **área de Ventas** y los flujos del CRM) en mapywork tras completar una mejora, corrección de bug o nueva funcionalidad en el código.

> **Principio de Moderación**: mapywork modela los procesos operativos y la arquitectura funcional de FIRPLAK, **no** es un registro de commits ni un changelog de micro-detalles. Cada cambio en el grafo debe aportar valor operacional duradero para el equipo comercial/tecnología y evitar ruido o saturación.

---

## 0. Contexto Fijo del Entorno FIRPLAK (MCP `vibeworkflow`)

> **Contrato técnico**: El nombre técnico del servidor MCP es `vibeworkflow` (no lo cambies al invocar herramientas).

- **Entorno objetivo**: `FIRPLAK`
  - `environment_id`: `30432837-6ac0-4486-83af-80cd39371f9b`
- **Área prioritaria**: `Ventas`
  - `area_id`: `e5d73584-955a-489b-b612-622a51caecfc`
- **Alcance principal**: Flujos del **área de Ventas** (`area_id = e5d73584-955a-489b-b612-622a51caecfc`). Solo tocar otras áreas de FIRPLAK si el cambio impacta directamente procesos transversales (ej. Logística, Contabilidad y finanzas, Tecnología) y el usuario lo aprueba.

### Mapa de referencia rápida — Flujos del Área de Ventas (FIRPLAK)

| Tipo | Nombre del flujo | `flow_id` |
|---|---|---|
| `standard` | CRM - Módulo de Cuentas (Clientes y Sucursales) | `e118e016-e698-479c-b585-0b79a0ac3b66` |
| `standard` | CRM - Módulo de Oportunidades (Negocios y Embudo) | `c82b30f7-384e-48c7-9b9e-88160c9fd343` |
| `standard` | CRM - Módulo de Contactos | `876efa74-55c6-4e3f-9ad1-66d2ed20ae23` |
| `standard` | CRM - Módulo de Actividades (Tareas y Seguimiento) | `5f904bf6-0045-49f5-93a1-3f2f17991a79` |
| `standard` | CRM - Módulo de Cotizaciones y Pedidos | `c2daff36-ea02-4305-bbe7-3092180bb0da` |
| `standard` | CRM - Módulo de Comisiones y Colaboradores | `a0b4f209-58b1-41eb-af57-14fd28f0f7e3` |
| `standard` | CRM - Módulo de Canales de Venta y Configuración | `2f4610fc-52e8-4e24-80ec-671901f672d4` |
| `standard` | CRM — Login, carga de datos, operación offline y configuración | `f200f7f0-7dde-4ab7-9b33-6aecfd88f522` |
| `macro` | Ventas | `e605766b-1b1e-41d6-8cb8-e22589d7a70a` |
| `macro` | Comercialización de cocinas B2C | `ef35a590-67fd-4241-a532-0fb8b1c6658b` |
| `standard` | Proceso de ventas FIRPLAK | `566b1d56-49cf-4d9a-942f-7d3349943c68` |
| `standard` | Apertura y cierre de ventas - Construcción | `5d47d44e-d084-44ef-8bcf-c6fd75b5602e` |
| `standard` | Apertura y cierre de ventas - Distribución | `4363dd32-32d1-4cdd-922f-938d5265ffbf` |
| `standard` | Atención a cliente final - Tiendas | `291e9447-84ac-4ea4-bb5c-99aec234233a` |
| `standard` | Atención a cliente final - Ecommerce | `927241d9-f9ae-4f26-a412-0d04a446bb34` |
| `standard` | Gestión de pricing y condiciones comerciales | `d6d9b7d6-a953-47ca-a99d-9ed5e564cf98` |
| `standard` | Seguimiento de desempeño comercial | `ab75afe3-abd0-4a48-861a-cf9c13455598` |

*(Si algún flujo fue renombrado o creado recientemente, verificar siempre con `search_flows` filtrando por `environment_id` y `area_id` de Ventas).*

---

## 1. Cuándo se activa

Ejecutar este skill al finalizar cualquier ciclo de desarrollo en `CRM FIRPLAK` que introduzca:
- Una mejora en un flujo comercial, módulo del CRM o componente operativo.
- La corrección de un bug relevante que cambie reglas de negocio, controles o experiencia operativa.
- Una nueva funcionalidad (feature), regla de validación, catálogo, integración (SAP, Microsoft Graph, WordPress, ForceManager, MCP) o endpoint.

---

## 2. Fase 1: Filtro Previo de Decisión (Las 3 Premisas)

Antes de planificar cualquier cambio en los flujos o invocar mutaciones en el MCP, evalúa estrictamente el cambio contra estas tres premisas:

| # | Premisa | Criterio de Evaluación |
|---|---|---|
| **1** | **Aporte operativo consultable** | ¿El cambio aporta información relevante sobre cómo opera el CRM / proceso de ventas de FIRPLAK que un usuario comercial, líder de área o agente de IA necesitará consultar a futuro en el lienzo o vía grafo de conocimiento? *(Si es solo un detalle de fontanería interna invisible, NO cumple).* |
| **2** | **Relevancia (NO menor)** | ¿El cambio es estructural, funcional o de comportamiento significativo y NO un ajuste cosmético o trivial? *(Ejemplo de cambio menor: cambiar un icono, corregir un typo en un tooltip, ajustar padding/color. NO registrar).* |
| **3** | **Impacto en decisiones futuras** | ¿El cambio tiene el potencial de condicionar, guiar, habilitar o restringir decisiones comerciales, reglas de negocio, diseño de flujos o integraciones futuras en FIRPLAK? |

### Criterio de Corte
- **Si el cambio NO cumple con las 3 premisas**:
  - Concluye que **NO vale la pena registrar el cambio en los flujos de FIRPLAK**.
  - Informa sintéticamente al usuario indicando el descarte según las premisas y finaliza sin tocar el MCP.
- **Si el cambio SÍ cumple con las 3 premisas**:
  - Continúa a la Fase 2 (Contexto previo e inspección) y Fase 3 (Propuesta al usuario).

---

## 3. Fase 2: Contexto Previo vía Grafo de Conocimiento (MCP `vibeworkflow`)

Antes de proponer o formular cambios específicos:
1. **Confirmar entorno y área**: Usar `environment_id = "30432837-6ac0-4486-83af-80cd39371f9b"` (`FIRPLAK`) y `area_id = "e5d73584-955a-489b-b612-622a51caecfc"` (`Ventas`). Verificar con `list_environments` / `list_areas` solo si hay duda de vigencia.
2. **Consultar grafo de conocimiento (`search_knowledge`)**:
   - Consultar el tema del cambio en lenguaje natural dentro del entorno `FIRPLAK` para obtener citas literales de la documentación oficial (rama principal) y detectar qué tarjetas ya documentan el módulo o proceso.
3. **Localizar flujos y tarjetas objetivo**:
   - Usar `search_flows` con `environment_id` y `area_id` de Ventas para confirmar el flujo o macroflujo exacto.
   - Usar `search_nodes` para localizar tarjetas existentes sin recorrer lienzos a ciegas.
   - *(PROHIBIDO usar `list_flows` o `list_flow_nodes` para búsquedas por texto libre).*
4. **Diseñar el cambio mínimo necesario**:
   - Determinar si basta actualizar tarjetas existentes (`label` o `rich_text`), o si realmente requiere crear tarjetas nuevas, añadir conexiones o retirar tarjetas obsoletas.

---

## 4. Fase 3: Propuesta y Consulta Obligatoria al Usuario

Genera una respuesta clara, corta y sintética con la siguiente estructura:

### Estructura de la Consulta
1. **Evaluación de las 3 Premisas**:
   - *1. Aporte operativo consultable*: [Sí/No + justificación en 1 línea]
   - *2. Relevancia (No menor)*: [Sí/No + justificación en 1 línea]
   - *3. Potencial de decisiones futuras*: [Sí/No + justificación en 1 línea]
2. **Recomendación**: Justificación técnica concisa de por qué se recomienda registrar (o no) el cambio en FIRPLAK — Ventas y en qué flujo(s)/macroflujo(s) específicos.
3. **Mini Resumen de Cambios Propuestos**: Lista con viñetas de las acciones a realizar:
   - Tarjetas a crear (tipo, label, flujo destino).
   - Tarjetas a modificar (labels o `rich_text`).
   - Conexiones (edges) a crear.
   - Tarjetas a eliminar (si aplica).
4. **Pregunta de Confirmación**: Pregunta explícitamente si el usuario aprueba implementar estos cambios en los flujos de FIRPLAK.

> ⚠️ **REGLA ESTRICTA**: No realices ninguna mutación en el servidor MCP `vibeworkflow` antes de recibir la confirmación explícita del usuario.

---

## 5. Fase 4: Ejecución mediante MCP (Solo tras Aprobación)

Una vez que el usuario confirma la aprobación, ejecuta únicamente los cambios aprobados con el servidor MCP `vibeworkflow` sobre el entorno `FIRPLAK` (`30432837-6ac0-4486-83af-80cd39371f9b`):

### 1. Modificación de Labels
- Herramienta: `update_flow_node`.
- Parámetros: `{ id: "<UUID_NODO>", label: "Nuevo Nombre Funcional" }`.

### 2. Modificación de Rich Text (Documentación)
- Herramienta: `update_flow_node`.
- Parámetros: `{ id: "<UUID_NODO>", rich_text: "Contenido Markdown con reglas, descripción y comportamiento actualizado..." }`.
- *Regla*: Markdown estándar, sin HTML. Es la fuente de verdad que indexa el grafo de conocimiento (`search_knowledge`). Conservar el contexto existente relevante (no borrar documentación vigente por accidente; leer el nodo con `get_flow_node` antes de sobreescribir `rich_text`).

### 3. Creación de Tarjetas
- Herramienta: `create_flow_node`.
- Parámetros:
  - `flow_id`: UUID del flujo estándar o macroflujo (área Ventas de FIRPLAK).
  - `type`: Variante válida (`accion`, `solucion`, `tarea`, `kpi`, `deseo`, `feature`, `responsable`, `escena` en flujos estándar; `macro_flow`, `accion`, `solucion`, `tarea` en macroflujos).
  - `label`: Etiqueta concisa.
  - `position`: Coordenadas absolutas `{ x, y }`, o relativas si tiene `parentId`.
  - `parentId`: Mandatorio si es tarjeta apilada (`tarea`, `kpi`, `deseo`, `feature`, etc.).
  - `checklist`: Mandatorio si el tipo es `tarea` (entre 2 y 7 items concretos con `text`).
  - `rich_text`: Documentación inicial del nodo.

### 4. Creación de Conexiones (Edges)
- Herramienta: `create_edge`.
- **Regla Ontológica Estricta**:
  - `accion` -> `accion`: Flujo horizontal (`sourceHandle: 'output-right'`, `targetHandle: 'input-left'`).
  - `solucion` -> `accion`: Alimentación vertical (`sourceHandle: 'output-top'`, `targetHandle: 'input-bottom'`).
  - `macro_flow` -> `macro_flow`: Flujo horizontal.
  - *Prohibido*: Aristas directas hacia/desde tarjetas secundarias (`tarea`, `kpi`, `feature`, etc.) o conectar `solucion` -> `solucion`.

### 5. Eliminación de Tarjetas
- **Protocolo en 2 pasos obligatorio**:
  1. `preview_delete_flow_node({ id: "<UUID_NODO>" })` y revisar dependencias/aristas asociadas.
  2. `delete_flow_node({ id: "<UUID_NODO>", confirm: true })`.

---

## 6. Reporte Final

Tras completar los cambios en el MCP:
- Notifica las tarjetas y conexiones creadas/modificadas/eliminadas con el nombre del flujo en FIRPLAK — Ventas.
- Confirma que la actualización se aplicó sobre la rama oficial (`main`/principal).
- Mantén la respuesta breve y sintética.
