/**
 * Qué filtro vive en la barra (servidor) y no debe repetirse en el menú nativo de Handsontable.
 * El filtro de columna nativo solo opera sobre las filas ya cargadas y se pisa con la barra.
 */

export const ACCOUNT_TOOLBAR_FILTER_COLUMNS = [
    'canal_id',
    'tipo',
    'vendedor',
    'nivel',
    'creacion',
] as const;

export const CONTACT_TOOLBAR_FILTER_COLUMNS = ['cuenta', 'principal'] as const;

export const OPPORTUNITY_SERVER_FILTER_COLUMNS = [
    'creada',
    'cierre',
    'canal',
    'fase',
    'vendedor',
    'estado',
    'origen',
    'pais',
    'ciudad',
] as const;

type AccountCol = (typeof ACCOUNT_TOOLBAR_FILTER_COLUMNS)[number];
type ContactCol = (typeof CONTACT_TOOLBAR_FILTER_COLUMNS)[number];
type OpportunityCol = (typeof OPPORTUNITY_SERVER_FILTER_COLUMNS)[number];

export function isToolbarOwnedTableColumn(
    entity: 'cuentas' | 'contactos' | 'oportunidades',
    colKey: string | null | undefined
): boolean {
    if (!colKey) return false;
    if (entity === 'cuentas') return (ACCOUNT_TOOLBAR_FILTER_COLUMNS as readonly string[]).includes(colKey);
    if (entity === 'contactos') return (CONTACT_TOOLBAR_FILTER_COLUMNS as readonly string[]).includes(colKey);
    return (OPPORTUNITY_SERVER_FILTER_COLUMNS as readonly string[]).includes(colKey);
}

export type ToolbarOwnedColumn = AccountCol | ContactCol | OpportunityCol;
