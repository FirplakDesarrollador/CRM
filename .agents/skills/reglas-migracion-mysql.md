---
description: Reglas obligatorias de homologación, extracción y sincronización al migrar datos desde MySQL (vTiger CRM) hacia Supabase CRM Firplak.
---

# Reglas de Migración MySQL (vTiger → Supabase CRM Firplak)

## 🎯 Objetivo
Garantizar que toda migración, actualización o sincronización de oportunidades, contactos, cuentas y actividades desde MySQL (vTiger `cfirplak_crmv`) hacia Supabase (`lnphhmowklqiomownurw`) se ejecute bajo el protocolo estándar estricto sin pérdida de datos, fechas corruptas, comentarios omitidos o inconsistencias en los catálogos.

---

## 📐 1. Homologación de Fases y Estados (`CRM_FasesOportunidad` - Canal PROPIO)

| Etapa Origen en vTiger (`sales_stage`) | Fase Destino (`CRM_FasesOportunidad`) | `fase_id` Real | `estado_id` (`CRM_EstadosOportunidad`) | Probabilidad |
| :--- | :--- | :---: | :---: | :---: |
| **Contacto identificado 0% / Por contactar** | *(Sin fase)* | `NULL` | `1` (Abierta) | 0% |
| **Contacto identificado 10% / Primer contacto** | `Primer contacto` | `116` | `1` (Abierta) | 10% |
| **Requerimiento identificado 20% - 30%** | `Presentación de propuesta` | `117` | `1` (Abierta) | 20% |
| **Cotización Enviada 40%** | `Acuerdo de precios` | `118` | `1` (Abierta) | 40% |
| **Cotización Enviada 50% / Negociación** | `Negociación final` | `119` | `1` (Abierta) | 50% |
| **Opciones de pago enviado 60%** | `Esperando pedido` | `120` | `1` (Abierta) | 60% |
| **Abono realizado 80% / Cerrada ganada / Closed Won / Pedido Enviado** | `Cerrada ganada` | `121` | `2` (Ganada) | 100% |
| **Cerrada perdida / Closed Lost / Prospecto frío** | `Cerrada Perdida` | `122` | `3` (Perdida) | 0% |

---

## 📅 2. Fechas de Cierre Estimadas (`fecha_cierre_estimada`)
* Extraer de `vtiger_potential.closingdate`.
* **Formateo Estricto:** Convertir siempre a formato ISO `YYYY-MM-DD` (ej. `2026-04-10`).
* **Prevención de Inversión Mes/Día:** Validar que la fecha no invierta mes con día.

---

## 👔 3. Tipo de Cliente, Cargo de Contacto y Subclasificación de Cuenta
* **Fuente vTiger:** `vtiger_potentialscf.cf_1122` o `vtiger_contactdetails.title`.
* **Destino Contacto (`CRM_Contactos.cargo`):** Guardar el nombre exacto del rol (ej. `'Arquitecto'`, `'Cliente final'`).
* **Destino Cuenta (`CRM_Cuentas.subclasificacion_id`):** Mapear obligatoriamente al ID correspondiente:
  * `Arquitecto` $\rightarrow$ `subclasificacion_id = 19`
  * `Cliente final` $\rightarrow$ `subclasificacion_id = 17`
  * `Decoradores` / `Decorador` $\rightarrow$ `subclasificacion_id = 18`
  * `Carpintero` $\rightarrow$ `subclasificacion_id = 20`
  * `Constructor` $\rightarrow$ `subclasificacion_id = 16`

---

## 💬 4. Bitácora de Comentarios y Motivos de Pérdida
* **Comentarios Generales (`CRM_Oportunidades.comentarios`):**
  * Extraer todas las notas de `vtiger_modcomments` vinculadas (`related_to = potentialid AND deleted = 0`).
  * Concatenar cronológicamente con formato: `[YYYY-MM-DD HH:MM:SS] Contenido del comentario`.
  * Anteponer `[DESCRIPCIÓN]: ...` si `vtiger_potential.description` contiene información.
* **Comentarios de Pérdida (`CRM_Oportunidades.comentarios_perdida`):**
  * En negocios cerrados perdidos (`estado_id = 3`), poblar con la bitácora completa o la justificación del cierre.
* **Motivo de Pérdida Pareto (`CRM_Oportunidades.razon_perdida`):**
  * Extraer de `vtiger_potentialscf.cf_1154`.

---

## 📞 5. Actividades Históricas (`CRM_Actividades`)
* **Fuente:** `vtiger_activity` vinculadas vía `vtiger_seactivityrel` (`crmid = potentialid`).
* **Mapeo de Tipos (`tipo_actividad_id`):**
  * Llamada / Call $\rightarrow$ `1`
  * Reunión / Meeting $\rightarrow$ `2`
  * Tarea / Task $\rightarrow$ `4`
* **Campos Requeridos:**
  * `opportunity_id`, `account_id`, `user_id`.
  * `asunto`: `vtiger_activity.subject`.
  * `descripcion`: `vtiger_activity.description` o entidad.
  * `fecha_inicio`: `date_start` + `time_start` (con zona horaria `-05`).
  * `fecha_fin`: `due_date` + `time_end` (con zona horaria `-05`).
  * `is_completed`: `true` si el estado en vTiger es `'Held'` o `'Completed'`.
* **Idempotencia:** Usar cláusula `WHERE NOT EXISTS` por `opportunity_id` y `asunto` para evitar duplicados.

---

## 🛁 6. Categorías Comerciales (`CRM_Oportunidades.categoria_oportunidad`)
* **Fuente:** `vtiger_potentialscf.cf_1152`.
* **Normalización Obligatoria:**
  * Contiene *Jacuzzi / Tina / Hidromasaje / Spa* $\rightarrow$ `'Hidromasajes'`
  * Contiene *Mueble / Lavamanos / Baño / Sanitario* $\rightarrow$ `'Baños'`
  * Contiene *Cocina / Mesón / Meson* $\rightarrow$ `'Cocinas'`
  * Contiene *Lavadero / Ropa / Labores* $\rightarrow$ `'Zona de Labores'`
  * Contiene *Institucional* $\rightarrow$ `'Institucional'`

---

## 📧 7. Sincronización Bidireccional de Correo y Teléfono
* Si el contacto tiene email/teléfono y la cuenta no, actualizar la cuenta.
* Si la cuenta tiene email/teléfono y el contacto no, actualizar el contacto.

---

## ⚡ 8. Regla de Sincronización Local-First (PWA)
* **SIEMPRE** incluir `updated_at = NOW()` en todas las sentencias `UPDATE` e `INSERT`.
* Esto garantiza que el `SyncEngine` y Dexie descarguen de inmediato los cambios a la aplicación frontend sin inconsistencias de caché.

---

## 📚 Esquema y Nombres de Columnas Clave

| Entidad / Tabla | Columna Correcta | Columna Incorrecta (Evitar) |
| :--- | :--- | :--- |
| `CRM_Oportunidades` | `account_id` | `cuenta_id` |
| `CRM_Oportunidades` | `contactos_ids` (`uuid[]`) | `contacto_id` |
| `CRM_Oportunidades` | `estado_id` (`1, 2, 3`) | `estado` |
| `vtiger_potentialscf` | `cf_1154` (Razón pérdida) | `cf_1038` |
| `vtiger_potentialscf` | `cf_1152` (Categoría) | `categoria` |
| `vtiger_potentialscf` | `cf_1122` (Tipo cliente) | `tipo_cliente` |

---

## 🛠️ Herramientas de Ejecución
* Script determinístico asociado: `execution/migrate_vtiger_opportunities.mjs`
* Directiva SOP: `directives/migracion_completa_oportunidades_vtiger.md`
