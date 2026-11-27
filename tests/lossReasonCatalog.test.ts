import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    filterLossReasonsForChannel,
    isB2CLossReason,
    lossReasonOptionLabel,
    planLossReasonCatalogWrite,
    selectLossReasonsForPicker,
} from '@/lib/lossReasonCatalog';

/**
 * Recorte del catálogo real de CRM_RazonesPerdida (2026-11-24).
 * No hay columna de canal: N-, RED- e INT- son texto de la descripción.
 */
const CATALOG = [
    { id: 1, descripcion: 'Precio', is_active: true },
    { id: 7, descripcion: 'Falta de seguimiento', is_active: true },
    { id: 9, descripcion: 'N - No responde 1mer contacto', is_active: true },
    { id: 17, descripcion: 'RED- MAC', is_active: true },
    { id: 18, descripcion: 'INT - Abandona Conversación', is_active: true },
    { id: 29, descripcion: 'N/A', is_active: false },
    { id: 32, descripcion: 'Duplicado', is_active: true },
    { id: 33, descripcion: 'Sin clasificación', is_active: true },
    { id: 34, descripcion: 'INT - Cliente abandonado ', is_active: true },
    { id: 35, descripcion: 'Cliente abandonado', is_active: true },
    { id: 36, descripcion: '   ', is_active: true },
    { id: 37, descripcion: 'Otra razón futura', is_active: null },
    { id: 38, descripcion: 'Inactiva futura', is_active: false },
];

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), 'utf8');

describe('Razones de pérdida activas para el desplegable', () => {
    it('incluye Cliente abandonado (35) y el INT con espacio final (34), y oculta inactivas', () => {
        const picked = selectLossReasonsForPicker(CATALOG);
        const labels = picked.map(reason => reason.descripcion);

        expect(labels).toContain('Cliente abandonado');
        expect(labels).toContain('INT - Cliente abandonado ');
        expect(labels).toContain('N - No responde 1mer contacto');
        expect(labels).toContain('INT - Abandona Conversación');
        expect(labels).toContain('RED- MAC');
        expect(labels).toContain('Duplicado');
        expect(labels).not.toContain('N/A');
        expect(labels).not.toContain('Inactiva futura');
        expect(labels).not.toContain('   ');
        expect(picked.map(reason => reason.id)).toEqual([...picked.map(reason => reason.id)].sort((a, b) => a - b));
        expect(lossReasonOptionLabel('INT - Cliente abandonado ')).toBe('INT - Cliente abandonado');
    });

    it('no usa una lista fija: una razón activa nueva entra y Precio sigue visible porque está activa', () => {
        const picked = selectLossReasonsForPicker(CATALOG);
        expect(picked.map(reason => reason.id)).toEqual(expect.arrayContaining([1, 7, 33, 35, 37]));
        expect(picked.find(reason => reason.id === 35)?.descripcion).toBe('Cliente abandonado');
        expect(picked.find(reason => reason.id === 37)?.descripcion).toBe('Otra razón futura');
    });

    it('B2C (PROPIO) solo ve las razones con prefijo N-, INT- o RED-', () => {
        const picked = filterLossReasonsForChannel(selectLossReasonsForPicker(CATALOG), true);
        expect(picked.map(reason => reason.id)).toEqual([9, 17, 18, 34]);
        expect(picked.some(reason => reason.descripcion === 'Cliente abandonado')).toBe(false);
        expect(picked.some(reason => reason.descripcion === 'Precio')).toBe(false);
        expect(picked.some(reason => reason.descripcion === 'Duplicado')).toBe(false);
    });

    it('los demás canales siguen viendo todas las activas, con y sin prefijo', () => {
        const all = selectLossReasonsForPicker(CATALOG);
        expect(filterLossReasonsForChannel(all, false)).toEqual(all);
    });

    it('reconoce los prefijos con o sin espacios y no confunde N/A ni palabras que empiezan igual', () => {
        expect(isB2CLossReason('N - No responde 1mer contacto')).toBe(true);
        expect(isB2CLossReason('INT - Abandona Conversación')).toBe(true);
        expect(isB2CLossReason('RED- MAC')).toBe(true);
        expect(isB2CLossReason('int-algo')).toBe(true);
        expect(isB2CLossReason('N/A')).toBe(false);
        expect(isB2CLossReason('No responde')).toBe(false);
        expect(isB2CLossReason('Redes sociales')).toBe(false);
        expect(isB2CLossReason(null)).toBe(false);
    });

    it('al reemplazar el catálogo local borra ids que ya no vienen y conserva el texto exacto', () => {
        const plan = planLossReasonCatalogWrite(
            [{ id: 99, descripcion: 'Vieja', is_active: true }, { id: 34, descripcion: 'distinto', is_active: true }],
            CATALOG,
        );
        expect(plan.idsToDelete).toEqual([99]);
        expect(plan.toStore.find(reason => reason.id === 34)?.descripcion).toBe('INT - Cliente abandonado ');
        expect(plan.toStore.find(reason => reason.id === 29)?.is_active).toBe(false);
        expect(plan.toStore.find(reason => reason.id === 35)?.is_active).toBe(true);
        expect(plan.toStore.find(reason => reason.id === 37)?.is_active).toBe(true);
    });
});

describe('El detalle lee el catálogo y no la lista fija', () => {
    it('el select de razón de pérdida usa el catálogo activo de Supabase', () => {
        const page = read('app', 'oportunidades', '[id]', 'page.tsx');
        expect(page).not.toContain('const LOSS_REASONS');
        expect(page).toContain('selectLossReasonsForPicker');
        expect(page).toContain('refreshLossReasonsFromSupabase');

        const select = page.slice(
            page.indexOf('data-testid="razon-perdida-select"'),
            page.indexOf('data-testid="comentarios-perdida-textarea"'),
        );
        expect(select).toContain('lossReasonOptions.map');
        expect(page).toContain('filterLossReasonsForChannel(lossReasonCatalogOptions, isB2CForLossReasons)');
        expect(select).toContain('lossReasonOptionLabel');
        expect(select).not.toContain('LOSS_REASONS');
    });

    it('la hidratación y el sync reemplazan CRM_RazonesPerdida en lugar de dejar el caché viejo', () => {
        const direct = read('lib', 'supabaseDirect.ts');
        const hydration = direct.slice(direct.indexOf('export async function hydrateReferenceCatalogsFromSupabase'));
        expect(direct).toContain('planLossReasonCatalogWrite');
        expect(direct).toContain('export async function refreshLossReasonsFromSupabase');
        expect(hydration).toContain(".from('CRM_RazonesPerdida')");
        expect(hydration).toContain('applyLossReasonCatalog');
        expect(direct).not.toContain('db.lossReasons.bulkPut(lossReasonsRes.data)');

        const sync = read('lib', 'sync.ts');
        expect(sync).toContain(".from('CRM_RazonesPerdida')");
        expect(sync).toContain('applyLossReasonCatalog');
    });

    it('el modal de pérdida usa el mismo filtro de activas', () => {
        const modal = read('components', 'oportunidades', 'LossReasonModal.tsx');
        expect(modal).toContain('selectLossReasonsForPicker');
        expect(modal).toContain(".eq('is_active', true)");
        expect(modal).not.toContain(".not('descripcion'");
    });
});
