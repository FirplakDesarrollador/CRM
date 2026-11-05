# Directiva Oficial: Protocolo Estándar de Migración y Homologación de Oportunidades (vTiger → CRM Firplak)

## 🎯 Objetivo
Garantizar que toda oportunidad migrada desde vTiger (u otro CRM anterior) hacia Supabase cuente con el 100% de los datos requeridos sin omitir bitácoras, actividades, roles ni configuraciones de estado/fases.

---

## 📐 1. Tabla de Homologación de Fases (`CRM_FasesOportunidad` - Canal PROPIO)

| Etapa / % Origen (vTiger / Proceso) | Fase Destino (`CRM_FasesOportunidad`) | Orden | Probabilidad por defecto |
| :--- | :--- | :---: | :---: |
| **Contacto identificado 0% / Por contactar** | *(Sin fase / NULL)* | — | 0% |
| **Contacto identificado 10% / Primer contacto** | `Primer contacto` | 1 | 5% / 10% |
| **Requerimiento identificado 20% - 30%** | `Presentación de propuesta` | 2 | 10% |
| **Cotización Enviada 40%** | `Acuerdo de precios` | 3 | 20% |
| **Cotización Enviada 50%** | `Negociación final` | 4 | 50% |
| **Opciones de pago enviado 60%** | `Esperando pedido` | 5 | 90% |
| **Abono realizado 80% / Cerrada ganada / Pedido Enviado** | `Cerrada ganada` | 6 | 100% |
| **Cerrada perdida / Prospecto frío** | `Cerrada Perdida` | 7 | 0% |

---

## 📅 2. Fecha de Cierre Estimada (`fecha_cierre_estimada`)
* Extraer directamente de `vtiger_potential.closingdate`.
* **Cuidado:** Formatear estrictamente en ISO (`YYYY-MM-DD`) para evitar inversiones de mes/día (ej. `2026-04-10` = 10 de Abril, no Marzo).

---

## 👔 3. Tipo de Cliente / Cargo / Subclasificación
* **Fuente vTiger:** `vtiger_potentialscf.cf_1122` o `vtiger_contactdetails.title`.
* **Destino Contacto:** Actualizar campo `cargo` en `CRM_Contactos`.
* **Destino Cuenta:** Mapear a `subclasificacion_id` en `CRM_Cuentas`:
  * `Arquitecto` $\rightarrow$ `subclasificacion_id = 19`
  * `Cliente final` $\rightarrow$ `subclasificacion_id = 17`
  * `Decoradores` $\rightarrow$ `subclasificacion_id = 18`
  * `Carpintero` $\rightarrow$ `subclasificacion_id = 20`

---

## 💬 4. Comentarios y Motivos de Pérdida
* **Comentarios Generales (`comentarios`):**
  * Extraer todas las notas de `vtiger_modcomments` (`m.related_to = potentialid AND deleted = 0`).
  * Concatenar cronológicamente: `[YYYY-MM-DD] Comentario...`.
  * Incluir la descripción original de `vtiger_potential.description` si existe.
* **Comentarios de Pérdida (`comentarios_perdida`):**
  * Para negocios cerrados perdidos, poblar `comentarios_perdida` con el comentario final de pérdida.
* **Razón Pareto:**
  * Mapear a `razon_perdida` (texto exacto de `LOSS_REASONS`) y `razon_perdida_id`.

---

## 📞 5. Actividades Históricas (`CRM_Actividades`)
* **Fuente:** `vtiger_activity` vinculadas mediante `vtiger_seactivityrel` (`crmid = potentialid`).
* **Campos obligatorios:**
  * `opportunity_id`, `account_id`, `user_id`.
  * `tipo_actividad_id`: `1` (Llamada), `2` (Reunión), `4` (Tarea).
  * `asunto`: `vtiger_activity.subject`.
  * `descripcion`: `vtiger_activity.description`.
  * `fecha_inicio`: `date_start` + `time_start`.
  * `fecha_fin`: `due_date` + `time_end`.
  * `is_completed`: `true` si `eventstatus IN ('Held', 'Completed')`.

---

## 🛁 6. Categoría Comercial (`categoria_oportunidad`)
* **Fuente:** `vtiger_potentialscf.cf_1152`.
* **Mapeo:**
  * Jacuzzis / Tinas / Hidromasaje $\rightarrow$ `Hidromasajes`
  * Muebles / Lavamanos / Baño $\rightarrow$ `Baños`
  * Cocinas / Mesones $\rightarrow$ `Cocinas`
  * Lavaderos / Ropas / Labores $\rightarrow$ `Zona de Labores`
  * Institucional $\rightarrow$ `Institucional`

---

## 📧 7. Correo y Teléfono
* **Fuente:** `vtiger_contactdetails.email` / `secondaryemail` / `mobile` o `vtiger_account.email1`.
* **Regla:** Sincronizar bidireccionalmente entre `CRM_Contactos` y `CRM_Cuentas`.

---

## ⚡ 8. Regla de Sincronización Obligatoria
* **SIEMPRE** incluir `updated_at = NOW()` en todas las sentencias `UPDATE` para garantizar la propagación inmediata en la PWA y clientes offline.
