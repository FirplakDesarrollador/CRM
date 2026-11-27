/**
 * Catálogo de razones de pérdida (`CRM_RazonesPerdida`).
 *
 * La tabla no tiene canal. Los prefijos N-, RED- e INT- viven en `descripcion`
 * y marcan las razones del canal B2C (PROPIO):
 * - Oportunidad B2C: el desplegable ofrece SOLO las activas con prefijo N-, INT- o RED-.
 *   Una razón nueva para B2C debe crearse con uno de esos prefijos.
 * - Resto de canales: ofrece todas las filas activas (con y sin prefijo), como antes.
 * `is_active = false` permanece oculta. El valor guardado es el texto exacto
 * (el id 34 conserva el espacio final); la etiqueta visible se recorta.
 */

/** Prefijos de `descripcion` que identifican una razón de pérdida del canal B2C. */
export const B2C_LOSS_REASON_PREFIXES = ['N', 'INT', 'RED'] as const;

const B2C_LOSS_REASON_PATTERN = /^\s*(N|INT|RED)\s*-/i;

/** true si la razón es de B2C: empieza por «N -», «INT -» o «RED-» (con o sin espacios). «N/A» no cuenta. */
export function isB2CLossReason(descripcion: string | null | undefined): boolean {
    return B2C_LOSS_REASON_PATTERN.test(String(descripcion ?? ''));
}

/** Opciones del desplegable según el canal: B2C solo ve sus razones con prefijo; el resto ve todas. */
export function filterLossReasonsForChannel<T extends { descripcion?: string | null }>(
    reasons: readonly T[],
    isB2C: boolean,
): T[] {
    return isB2C ? reasons.filter(reason => isB2CLossReason(reason.descripcion)) : [...reasons];
}

export interface LossReasonCatalogItem {
    id: number | string;
    descripcion?: string | null;
    is_active?: boolean | null;
}

export interface StoredLossReason {
    id: number;
    descripcion: string;
    is_active: boolean;
}

export function lossReasonOptionLabel(descripcion: string | null | undefined): string {
    return String(descripcion ?? '').trim();
}

export function isSelectableLossReason(
    reason: { is_active?: boolean | null; descripcion?: string | null } | null | undefined,
): boolean {
    if (!reason || reason.is_active === false) return false;
    return lossReasonOptionLabel(reason.descripcion).length > 0;
}

export function selectLossReasonsForPicker<T extends LossReasonCatalogItem>(
    reasons: readonly T[] | null | undefined,
): Array<T & { id: number; descripcion: string }> {
    const byId = new Map<number, T & { id: number; descripcion: string }>();
    for (const reason of reasons || []) {
        const id = Number(reason?.id);
        if (!Number.isFinite(id) || !isSelectableLossReason(reason)) continue;
        const descripcion = String(reason.descripcion ?? '');
        const previous = byId.get(id);
        byId.set(id, previous ? { ...previous, ...reason, id, descripcion } : { ...reason, id, descripcion });
    }
    return Array.from(byId.values()).sort((a, b) => a.id - b.id);
}

/**
 * Reemplazo del catálogo local. El llamador solo lo aplica cuando la lectura
 * remota tuvo filas: una respuesta vacía no borra la copia offline.
 */
export function planLossReasonCatalogWrite(
    local: readonly LossReasonCatalogItem[] | null | undefined,
    remote: readonly LossReasonCatalogItem[] | null | undefined,
): { toStore: StoredLossReason[]; idsToDelete: number[] } {
    const toStore: StoredLossReason[] = [];
    const remoteIds = new Set<number>();
    for (const reason of remote || []) {
        const id = Number(reason?.id);
        if (!Number.isFinite(id)) continue;
        remoteIds.add(id);
        toStore.push({
            id,
            descripcion: String(reason.descripcion ?? ''),
            is_active: reason.is_active !== false,
        });
    }
    toStore.sort((a, b) => a.id - b.id);
    const idsToDelete = (local || [])
        .map(row => Number(row?.id))
        .filter(id => Number.isFinite(id) && !remoteIds.has(id));
    return { toStore, idsToDelete };
}
