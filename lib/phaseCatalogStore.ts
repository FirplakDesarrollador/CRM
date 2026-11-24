import { db, type LocalFase } from './db';
import { mergePhaseCatalog, type PhaseCatalogItem } from './opportunityPhaseCatalog';

function asLocalPhase(phase: PhaseCatalogItem): LocalFase {
    return {
        id: Number(phase.id),
        nombre: String(phase.nombre ?? ''),
        orden: phase.orden === null || phase.orden === undefined || !Number.isFinite(Number(phase.orden))
            ? 0
            : Number(phase.orden),
        is_active: phase.is_active !== false,
        canal_id: String(phase.canal_id ?? ''),
        probability: Number(phase.probability ?? 0),
    };
}

/** Catálogo completo (activas e inactivas) para nombres y para calcular ganada/perdida. */
export async function readFullPhaseCatalog(): Promise<LocalFase[]> {
    const phases = await db.phases.toArray();
    let labels: LocalFase[] = [];
    try {
        labels = await db.phaseLabels.toArray();
    } catch {
        labels = [];
    }
    return mergePhaseCatalog(labels, phases).map(asLocalPhase);
}
