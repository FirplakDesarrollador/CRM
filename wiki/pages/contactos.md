# Contactos

Los contactos (`/contactos`, tabla `CRM_Contactos`) son las personas asociadas a las
[[cuentas]]. Módulo de soporte para [[oportunidades]] y [[actividades]].

## Funcionalidad

- CRUD estándar con `ContactForm` y `ContactList`; selector de cuenta (`AccountSelector`).
- **Importación vCard:** `VCardImportModal` + `lib/vcard.ts` permiten importar contactos
  desde archivos vCard (p. ej. exportados del teléfono); `useContactImport` gestiona el flujo.
- **Auto-contacto canal Propio:** la migración `20260202_auto_contact_propio.sql` crea
  contactos automáticamente en flujos del canal PROPIO (B2C), donde el cliente final es
  una persona (ver [[canales-de-venta]] e [[integraciones]] — lead intake de WordPress).
- Columna de acciones editar/eliminar solo para ADMIN en la grilla.
- Permisos: todos los roles ven/crean/editan; borrar requiere COORDINADOR o ADMIN
  (ver [[roles-y-permisos]]).

## Fuentes

- `app/contactos/page.tsx`, `components/contactos/`
- `lib/hooks/useContacts.ts`, `useContactsServer.ts`, `useContactImport.ts`, `lib/vcard.ts`
- Migración: `20260202_auto_contact_propio.sql`
