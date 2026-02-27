import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type HistoricalCommission = {
    id: string;
    created_at: string;
    tipo_evento: string; // 'DEVENGADA' | 'PAGADA' | 'AJUSTE' | 'REVERSO'
    monto_comision: number;
    base_amount: number;
    porcentaje_comision: number;
    oportunidad?: {
        id: string;
        nombre: string; // We might not have this in Oportunidades directly if it's not joined, usually we have 'nombre' or we construct it. 
        // Checking schema: CRM_Oportunidades usually has account_id, we might need to fetch Account Name.
    };
    concepto?: string; // For adjustments
};

export type PotentialCommissionItem = {
    opportunity_id: string;
    account_name: string;
    amount: number;
    pct_applied: number;
    estimated_commission: number;
    rule_name: string;
};

export type BonusProgress = {
    id: string;
    nombre: string;
    periodo: string;
    meta_recaudo: number;
    monto_bono: number;
    recaudado: number;
    progreso_pct: number;
    is_global: boolean;
};

export function useVendorCommissions(vendedorId: string | null, dateFrom: string | null, dateTo: string | null) {
    const [historical, setHistorical] = useState<HistoricalCommission[]>([]);
    const [potential, setPotential] = useState<PotentialCommissionItem[]>([]);
    const [bonuses, setBonuses] = useState<BonusProgress[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!vendedorId) return;

        setLoading(true);
        setError(null);

        try {
            // 1. Fetch Historical (Ledger)
            let ledgerQuery = supabase
                .from('CRM_ComisionLedger')
                .select(`
                    id, created_at, tipo_evento, monto_comision, base_amount, porcentaje_comision, motivo,
                    oportunidad:CRM_Oportunidades!oportunidad_id (
                        id, 
                        account:CRM_Cuentas!account_id (nombre)
                    )
                `)
                .eq('vendedor_id', vendedorId)
                .order('created_at', { ascending: false });

            if (dateFrom) ledgerQuery = ledgerQuery.gte('created_at', dateFrom);
            if (dateTo) ledgerQuery = ledgerQuery.lte('created_at', dateTo + 'T23:59:59Z');

            const { data: ledgerData, error: ledgerError } = await ledgerQuery;
            if (ledgerError) throw new Error(ledgerError.message);

            const mappedHistorical: HistoricalCommission[] = ledgerData.map((item: any) => ({
                id: item.id,
                created_at: item.created_at,
                tipo_evento: item.tipo_evento,
                monto_comision: item.monto_comision,
                base_amount: item.base_amount,
                porcentaje_comision: item.porcentaje_comision,
                concepto: item.motivo,
                oportunidad: item.oportunidad ? {
                    id: item.oportunidad.id,
                    nombre: item.oportunidad.account?.nombre || 'Desconocido' // Using Account Name as Opp Name proxy if Oportunidad doesn't have a name field shown here
                } : undefined
            }));
            setHistorical(mappedHistorical);

            // 2. Fetch Potential (Open Opportunities)
            // 2a. Opportunities owned by this vendor
            const { data: ownedOpps, error: oppsError } = await supabase
                .from('CRM_Oportunidades')
                .select(`
                    id, amount, account_id, owner_user_id,
                    account:CRM_Cuentas!account_id (nombre, canal_id)
                `)
                .eq('owner_user_id', vendedorId)
                .eq('estado_id', 1);

            if (oppsError) throw new Error(oppsError.message);

            // 2b. Opportunities where vendor is an active collaborator
            let collabLinks: any[] | null = null;
            {
                const { data: cl1, error: cl1Err } = await supabase
                    .from('CRM_Oportunidades_Colaboradores')
                    .select('oportunidad_id')
                    .eq('usuario_id', vendedorId)
                    .eq('is_deleted', false);
                if (cl1Err && cl1Err.message.includes('is_deleted')) {
                    // Column doesn't exist yet — fetch all
                    const { data: cl2 } = await supabase
                        .from('CRM_Oportunidades_Colaboradores')
                        .select('oportunidad_id')
                        .eq('usuario_id', vendedorId);
                    collabLinks = cl2;
                } else {
                    collabLinks = cl1;
                }
            }

            let collabOpps: any[] = [];
            if (collabLinks && collabLinks.length > 0) {
                const ownedIds = new Set((ownedOpps || []).map(o => o.id));
                const uniqueCollabIds = collabLinks
                    .map(c => c.oportunidad_id)
                    .filter(id => !ownedIds.has(id));

                if (uniqueCollabIds.length > 0) {
                    const { data: collabOppData } = await supabase
                        .from('CRM_Oportunidades')
                        .select(`
                            id, amount, account_id, owner_user_id,
                            account:CRM_Cuentas!account_id (nombre, canal_id)
                        `)
                        .in('id', uniqueCollabIds)
                        .eq('estado_id', 1);

                    if (collabOppData) collabOpps = collabOppData;
                }
            }

            const openOpps = [...(ownedOpps || []), ...collabOpps];

            // Fetch Collaborators for these opportunities to adjust ownership %
            const oppIds = openOpps?.map(o => o.id) || [];
            const collaboratorsInfo: Record<string, { totalPct: number, myExplicitPct: number | null }> = {};

            if (oppIds.length > 0) {
                try {
                    // Fetch active collaborators (filter out soft-deleted)
                    let activeCollaborators: any[] | null = null;
                    let collabError: any = null;
                    {
                        const { data: ac1, error: ac1Err } = await supabase
                            .from('CRM_Oportunidades_Colaboradores')
                            .select('oportunidad_id, porcentaje, usuario_id')
                            .in('oportunidad_id', oppIds)
                            .eq('is_deleted', false);
                        if (ac1Err && ac1Err.message.includes('is_deleted')) {
                            const { data: ac2, error: ac2Err } = await supabase
                                .from('CRM_Oportunidades_Colaboradores')
                                .select('oportunidad_id, porcentaje, usuario_id')
                                .in('oportunidad_id', oppIds);
                            activeCollaborators = ac2;
                            collabError = ac2Err;
                        } else {
                            activeCollaborators = ac1;
                            collabError = ac1Err;
                        }
                    }

                    if (collabError) {
                        console.error('Error fetching collaborators:', collabError);
                    }

                    if (!collabError && activeCollaborators) {
                        activeCollaborators.forEach(c => {
                            if (!collaboratorsInfo[c.oportunidad_id]) {
                                collaboratorsInfo[c.oportunidad_id] = { totalPct: 0, myExplicitPct: null };
                            }
                            const pct = Number(c.porcentaje) || 0;
                            // Add to total used percentage
                            collaboratorsInfo[c.oportunidad_id].totalPct += pct;

                            // Check if this is ME
                            if (c.usuario_id === vendedorId) {
                                collaboratorsInfo[c.oportunidad_id].myExplicitPct = pct;
                            }
                        });
                    }
                } catch (collabErr) {
                    console.warn("Could not fetch collaborators (table might be missing):", collabErr);
                }
            }

            // 3. Fetch Rules for Potential Calculation
            const { data: rules, error: rulesError } = await supabase
                .from('CRM_ComisionReglas')
                .select('nombre, vendedor_id, cuenta_id, cuentas_ids, canal_id, porcentaje_comision')
                .eq('is_active', true);

            if (rulesError) throw new Error(rulesError.message);

            const generalRule = rules?.find(r => !r.vendedor_id && !r.cuenta_id);
            const generalPct = generalRule ? Number(generalRule.porcentaje_comision) : 0;

            const mappedPotential: PotentialCommissionItem[] = (openOpps || []).map((opp: any) => {
                const amount = Number(opp.amount) || 0;

                // Rule Selection Logic: Specificity > Value (matching backend resolve_commission_rule)
                // Dimensions: vendedor (+8), cuenta (+4), categoria (+2), canal (+1)
                const oppCanalId = opp.account?.canal_id || null;

                const applicableRules = rules?.filter(r => {
                    const vendedorMatch = !r.vendedor_id || r.vendedor_id === vendedorId;
                    const cuentaMatch =
                        (!r.cuenta_id && (!r.cuentas_ids || r.cuentas_ids.length === 0)) ||
                        r.cuenta_id === opp.account_id ||
                        (r.cuentas_ids && r.cuentas_ids.includes(opp.account_id));
                    const canalMatch = !r.canal_id || r.canal_id === oppCanalId;
                    return vendedorMatch && cuentaMatch && canalMatch;
                });

                let pct = 0;
                let ruleName = 'General';

                if (applicableRules && applicableRules.length > 0) {
                    // Calculate Specificity Score (matching backend priority_score)
                    const scoredRules = applicableRules.map(r => {
                        let score = 0;
                        if (r.vendedor_id === vendedorId) score += 8;
                        if (r.cuenta_id === opp.account_id ||
                            (r.cuentas_ids && r.cuentas_ids.includes(opp.account_id))) score += 4;
                        if (r.canal_id && r.canal_id === oppCanalId) score += 1;
                        return { ...r, score };
                    });

                    // Sort: High Score First, then Low %
                    scoredRules.sort((a, b) => {
                        if (b.score !== a.score) return b.score - a.score;
                        return Number(a.porcentaje_comision) - Number(b.porcentaje_comision);
                    });

                    const bestRule = scoredRules[0];
                    pct = Number(bestRule.porcentaje_comision);
                    ruleName = bestRule.nombre || 'Regla Personalizada';
                } else {
                    pct = generalPct;
                    ruleName = generalRule?.nombre || 'General (Fallback)';
                }

                if (isNaN(pct)) pct = 0;

                // Adjust for shared ownership
                // Logic: If I am explicitly in the collaborators list, use my %. 
                // If not, I am the owner (remainder), so use 100 - sum(others).
                const info = collaboratorsInfo[opp.id] || { totalPct: 0, myExplicitPct: null };

                let mySharePct = 100;
                if (info.myExplicitPct !== null) {
                    // Case A: I am explicitly listed
                    mySharePct = info.myExplicitPct;
                } else {
                    // Case B: I am the owner/remainder
                    mySharePct = Math.max(0, 100 - info.totalPct);
                }

                // Effective Percentage = Rule % * (My Share / 100)
                const effectivePct = pct * (mySharePct / 100);

                return {
                    opportunity_id: opp.id,
                    account_name: opp.account?.nombre || 'Desconocido',
                    amount: amount,
                    pct_applied: effectivePct,
                    estimated_commission: amount * (effectivePct / 100),
                    rule_name: ruleName + (mySharePct < 100 ? ` (Compartida ${mySharePct}%)` : '')
                };
            });
            // Sort potential by amount desc
            mappedPotential.sort((a, b) => b.estimated_commission - a.estimated_commission);
            setPotential(mappedPotential);

            // 4. Fetch Bonus Rules & Progress
            try {
                const { data: bonusRules } = await supabase
                    .from('CRM_ReglasBono')
                    .select('id, nombre, periodo, meta_recaudo, monto_bono, vendedor_id')
                    .eq('is_active', true);

                if (bonusRules && bonusRules.length > 0) {
                    // Filter: rules for this vendor OR global (vendedor_id is null)
                    const applicable = bonusRules.filter(
                        r => !r.vendedor_id || r.vendedor_id === vendedorId
                    );

                    // Calculate recaudo: sum of PAGADA events for this vendor
                    let recaudoQuery = supabase
                        .from('CRM_ComisionLedger')
                        .select('base_amount')
                        .eq('vendedor_id', vendedorId)
                        .eq('tipo_evento', 'PAGADA');

                    if (dateFrom) recaudoQuery = recaudoQuery.gte('created_at', dateFrom);
                    if (dateTo) recaudoQuery = recaudoQuery.lte('created_at', dateTo + 'T23:59:59Z');

                    const { data: pagos } = await recaudoQuery;
                    const totalRecaudado = (pagos || []).reduce((sum, p) => sum + (Number(p.base_amount) || 0), 0);

                    const bonusProgress: BonusProgress[] = applicable.map(rule => {
                        const meta = Number(rule.meta_recaudo) || 0;
                        return {
                            id: rule.id,
                            nombre: rule.nombre,
                            periodo: rule.periodo,
                            meta_recaudo: meta,
                            monto_bono: Number(rule.monto_bono) || 0,
                            recaudado: totalRecaudado,
                            progreso_pct: meta > 0 ? Math.min(100, (totalRecaudado / meta) * 100) : 0,
                            is_global: !rule.vendedor_id,
                        };
                    });
                    setBonuses(bonusProgress);
                } else {
                    setBonuses([]);
                }
            } catch (bonusErr) {
                console.warn('Could not fetch bonus rules:', bonusErr);
                setBonuses([]);
            }

        } catch (err: any) {
            console.error("Error fetching vendor details:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [vendedorId, dateFrom, dateTo]);

    useEffect(() => {
        if (vendedorId) {
            fetchData();
        }
    }, [fetchData, vendedorId]);

    return { historical, potential, bonuses, loading, error };
}
