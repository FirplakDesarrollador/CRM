# Contactos

Los contactos (`/contactos`, tabla `CRM_Contactos`) son las personas asociadas a las
[[cuentas]]. Módulo de soporte para [[oportunidades]] y [[actividades]].

## Funcionalidad

- CRUD estándar con `ContactForm` y `ContactList`; selector de cuenta (`AccountSelector`). Al editar un contacto existente, `ContactForm` incluye una barra de pestañas (**Información** e **Historial de Cambios** vía `EntityAuditHistoryTab`), permitiendo auditar modificaciones en nombre, teléfono, cargo, correo y estado principal con el nombre del usuario y fecha exacta.
- **Interfaz dual:** Vista móvil con tarjetas interactivas adaptadas y vista desktop con tabla interactiva (Handsontable) donde la edición se abre directamente al seleccionar/hacer clic en la fila. Botón responsivo de paginación ("Cargar más contactos").
- **Importación vCard:** `VCardImportModal` + `lib/vcard.ts` permiten importar contactos
  desde archivos vCard (p. ej. exportados del teléfono); `useContactImport` gestiona el flujo.
- **Auto-contacto canal Propio:** la migración `20260202_auto_contact_propio.sql` crea
  contactos automáticamente en flujos del canal PROPIO (B2C), donde el cliente final es
  una persona (ver [[canales-de-venta]] e [[integraciones]] — lead intake de WordPress).
- Permisos: todos los roles ven/crean/editan; borrar requiere COORDINADOR o ADMIN
  (ver [[roles-y-permisos]]).
- **Visibilidad y Directorio Global:** En `/contactos` (`useContactsServer`), los asesores comerciales con rol `VENDEDOR` pueden buscar y consultar el directorio completo de contactos de clientes (por nombre, celular o correo), garantizando que puedan identificar interlocutores y validar datos sin quedar bloqueados por el propietario asignado a la cuenta (`shouldRestrictContactsByAccountOwner = false`).
- **Auditoría en Base de Datos:** `CRM_HistorialModificaciones` con trigger `trg_audit_contact_changes_full` audita automáticamente cambios en nombre, cargo, teléfono, email, cuenta vinculada y contacto principal.

## Notas operativas

- `CreateContactWizard` crea contactos asociados a una cuenta en 3 pasos. El submit final valida que el wizard este en Confirmacion y el boton "Crear Contacto" queda deshabilitado brevemente al entrar al ultimo paso.
- Búsqueda y visibilidad global desacoplada de la propiedad de cuenta para evitar falsos negativos en búsquedas telefónicas (p. ej. asesores consultando contactos creados por otros canales o ferias).

## Fuentes

- `app/contactos/page.tsx`, `components/contactos/`
- `lib/hooks/useContacts.ts`, `useContactsServer.ts`, `useContactImport.ts`, `lib/vcard.ts`
- `lib/contactVisibility.ts`
- Migración: `20260202_auto_contact_propio.sql`

