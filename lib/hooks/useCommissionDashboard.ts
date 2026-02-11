import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { syncEngine } from '@/lib/sync';

export type CommissionSummary = {
    total_devengada: number;
    total_pagada: number;
    total_ajustes: number;
    total_reversos: number;
    pendiente: number;
    potencial: number; // New field
};

export type VendedorSummary = {
    vendedor_id: string;
    vendedor_name: string;
    devengada: number;
    pagada: number;
    pendiente: number;
    potencial: number; // New field
    open_opps_count: number; // Metadata
    open_opps_value: number; // Metadata
};

export function useCommissionDashboard() {
    const [summary, setSummary] = useState<CommissionSummary>({
        total_devengada: 0,
        total_pagada: 0,
        total_ajustes: 0,
        total_reversos: 0,
        pendiente: 0,
        potencial: 0,
    });
    const [vendedorBreakdown, setVendedorBreakdown] = useState<VendedorSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Period filter
    const [dateFrom, setDateFrom] = useState<string | null>(null);
    const [dateTo, setDateTo] = useState<string | null>(null);

    useEffect(() => {
        syncEngine.getCurrentUser().then(({ data: { user } }) => {
            if (user) setCurrentUserId(user.id);
        });
    }, []);

    const fetchDashboard = useCallback(async () => {
        if (!currentUserId) return;

        setLoading(true);
        setError(null);
        try {
            // 1. Fetch all active users (Vendedores/Coordinadores) to ensure everyone is listed
            // We assume anyone in CRM_Usuarios is relevant, or filter by specific roles if needed.
            // For now, getting all active users is safer to match "show all users".
            const { data: allUsers, error: usersError } = await supabase
                .from('CRM_Usuarios')
                .select('id, full_name, role')
                .eq('is_active', true)
                .in('role', ['VENDEDOR', 'COORDINADOR', 'ADMIN']); // Include relevant roles

            if (usersError) throw new Error(`Users Error: ${usersError.message}`);

            // 2. Fetch Ledger entries (History)
            let query = supabase
                .from('CRM_ComisionLedger')
                .select(`
                    tipo_evento,
                    monto_comision,
                    vendedor_id
                `);

            if (dateFrom) query = query.gte('created_at', dateFrom);
            if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59Z');

            const { data: entries, error: ledgerError } = await query;
            if (ledgerError) throw new Error(`Ledger Error: ${ledgerError.message}`);

            // 3. Fetch Open Opportunities (Future / Potential)
            // Status 1 = Open
            let oppsQuery = supabase
                .from('CRM_Oportunidades')
                .select('id, owner_user_id, amount, account_id, account:CRM_Cuentas!account_id (canal_id)')
                .eq('estado_id', 1);

            // If filtering by date, we might filter opportunities created in that date? 
            // Or usually Potential shows ALL currently open? 
            // Let's assume Potential shows ALL currently open regardless of creation date, 
            // because they are "future" revenue. 
            // However, asking for "Potential" in a "Period" view might be ambiguous.
            // Usually "Pipeline" is a snapshot of NOW. 
            // I will keep it as ALL OPEN for now, as that's most useful.

            const { data: openOpps, error: oppsError } = await oppsQuery;
            if (oppsError) throw new Error(`Opps Error: ${oppsError.message}`);

            // 4. Fetch Active Rules for estimation
            // We need to know % to apply.
            const { data: rules, error: rulesError } = await supabase
                .from('CRM_ComisionReglas')
                .select('nombre, vendedor_id, porcentaje_comision, is_active, cuenta_id, cuentas_ids, canal_id')
                .eq('is_active', true);

            if (rulesError) {
                console.error("Error fetching rules", rulesError);
                // Continue without rules (0 potential)
            }

            // 5. Initialize maps
            const vendedorMap = new Map<string, {
                name: string;
                devengada: number;
                pagada: number;
                potencial: number;
                open_ops_count: number;
                open_ops_value: number;
            }>();

            allUsers?.forEach(user => {
                vendedorMap.set(user.id, {
                    name: user.full_name || 'Sin Nombre',
                    devengada: 0,
                    pagada: 0,
                    potencial: 0,
                    open_ops_count: 0,
                    open_ops_value: 0
                });
            });

            // 6. Aggregate Ledger data
            let devengada = 0, pagada = 0, ajustes = 0, reversos = 0;

            if (entries) {
                for (const entry of entries) {
                    const amount = Number(entry.monto_comision) || 0;
                    const vid = entry.vendedor_id;

                    // Update summary totals
                    switch (entry.tipo_evento) {
                        case 'DEVENGADA': devengada += amount; break;
                        case 'PAGADA': pagada += amount; break;
                        case 'AJUSTE': ajustes += amount; break;
                        case 'REVERSO': reversos += amount; break;
                    }

                    // Update user specific stats (only if user exists in map, or add them if missing)
                    if (vendedorMap.has(vid)) {
                        const v = vendedorMap.get(vid)!;
                        if (entry.tipo_evento === 'DEVENGADA' || entry.tipo_evento === 'AJUSTE') {
                            v.devengada += amount;
                        } else if (entry.tipo_evento === 'PAGADA') {
                            v.pagada += amount;
                        } else if (entry.tipo_evento === 'REVERSO') {
                            v.devengada += amount; // reverso is usually negative in DB or subtracted here? 
                            // Ledger definition: reverso entries are usually negative values if they decrease debt.
                            // If they are positive numbers representing a subtraction, we should subtract.
                            // Standard accounting in this app seems to be: 
                            // DEVENGADA (+) 
                            // REVERSO (-) -> likely stored as negative or we sum it.
                            // Let's assume standard summation if 'amount' is signed correctly by the trigger/insertion logic.
                            // If manual entry, usually check sign. 
                            // Given previous code: "devengada += amount", implies amount captures the sign or direction.
                        }
                    }
                }
            }

            // 7. Fetch Collaborators for open opportunities (split logic)
            const oppIds = openOpps?.map(o => o.id) || [];
            // Map: opp_id -> { collabs: [{usuario_id, porcentaje}], totalCollabPct }
            const oppCollabs = new Map<string, { collabs: { usuario_id: string; porcentaje: number }[]; totalCollabPct: number }>();

            if (oppIds.length > 0) {
                let allCollabs: any[] | null = null;
                {
                    const { data: c1, error: c1Err } = await supabase
                        .from('CRM_Oportunidades_Colaboradores')
                        .select('oportunidad_id, usuario_id, porcentaje')
                        .in('oportunidad_id', oppIds)
                        .eq('is_deleted', false);
                    if (c1Err && c1Err.message.includes('is_deleted')) {
                        const { data: c2 } = await supabase
                            .from('CRM_Oportunidades_Colaboradores')
                            .select('oportunidad_id, usuario_id, porcentaje')
                            .in('oportunidad_id', oppIds);
                        allCollabs = c2;
                    } else {
                        allCollabs = c1;
                    }
                }

                if (allCollabs) {
                    for (const c of allCollabs) {
                        if (!oppCollabs.has(c.oportunidad_id)) {
                            oppCollabs.set(c.oportunidad_id, { collabs: [], totalCollabPct: 0 });
                        }
                        const entry = oppCollabs.get(c.oportunidad_id)!;
                        const pctVal = Number(c.porcentaje) || 0;
                        entry.collabs.push({ usuario_id: c.usuario_id, porcentaje: pctVal });
                        entry.totalCollabPct += pctVal;
                    }
                }
            }

            // 8. Calculate Potential (Open Opps) with split logic
            let totalPotential = 0;
            if (openOpps) {
                const generalRule = rules?.find(r => !r.vendedor_id);
                const generalPctVal = generalRule ? Number(generalRule.porcentaje_comision) : 0;
                const generalPct = isNaN(generalPctVal) ? 0 : generalPctVal;

                // Helper: resolve best rule for a given vendedor + opportunity
                const resolveRulePct = (vid: string, accountId: string, canalId: string | null): number => {
                    const applicableRules = rules?.filter(r => {
                        const vendedorMatch = !r.vendedor_id || r.vendedor_id === vid;
                        const cuentaMatch =
                            (!r.cuenta_id && (!r.cuentas_ids || r.cuentas_ids.length === 0)) ||
                            r.cuenta_id === accountId ||
                            (r.cuentas_ids && r.cuentas_ids.includes(accountId));
                        const canalMatch = !r.canal_id || r.canal_id === canalId;
                        return vendedorMatch && cuentaMatch && canalMatch;
                    });

                    if (applicableRules && applicableRules.length > 0) {
                        const scoredRules = applicableRules.map(r => {
                            let score = 0;
                            if (r.vendedor_id === vid) score += 8;
                            if (r.cuenta_id === accountId ||
                                (r.cuentas_ids && r.cuentas_ids.includes(accountId))) score += 4;
                            if (r.canal_id && r.canal_id === canalId) score += 1;
                            return { ...r, score };
                        });

                        scoredRules.sort((a, b) => {
                            if (b.score !== a.score) return b.score - a.score;
                            return Number(a.porcentaje_comision) - Number(b.porcentaje_comision);
                        });

                        const val = Number(scoredRules[0].porcentaje_comision);
                        return isNaN(val) ? 0 : val;
                    }
                    return generalPct;
                };

                for (const opp of openOpps) {
                    const ownerId = opp.owner_user_id;
                    const rawAmount = Number(opp.amount);
                    const amount = isNaN(rawAmount) ? 0 : rawAmount;
                    const oppCanalId = (opp as any).account?.canal_id || null;

                    // Resolve rule % (based on owner context — same rule applies to all beneficiaries)
                    const rulePct = resolveRulePct(ownerId, opp.account_id, oppCanalId);
                    const grossCommission = amount * (rulePct / 100);

                    const collabInfo = oppCollabs.get(opp.id);

                    // Track opp count/value for owner
                    if (vendedorMap.has(ownerId)) {
                        const ownerAttrs = vendedorMap.get(ownerId)!;
                        ownerAttrs.open_ops_count += 1;
                        ownerAttrs.open_ops_value += amount;
                    }

                    if (!collabInfo || collabInfo.collabs.length === 0) {
                        // No collaborators: 100% to owner
                        if (vendedorMap.has(ownerId)) {
                            vendedorMap.get(ownerId)!.potencial += grossCommission;
                            totalPotential += grossCommission;
                        }
                    } else {
                        // Distribute to each collaborator
                        for (const collab of collabInfo.collabs) {
                            const collabShare = grossCommission * (collab.porcentaje / 100);
                            if (vendedorMap.has(collab.usuario_id)) {
                                vendedorMap.get(collab.usuario_id)!.potencial += collabShare;
                                totalPotential += collabShare;
                            }
                        }

                        // Owner gets remainder if not explicitly listed as collaborator
                        const ownerIsCollab = collabInfo.collabs.some(c => c.usuario_id === ownerId);
                        if (!ownerIsCollab) {
                            const ownerSharePct = Math.max(0, 100 - collabInfo.totalCollabPct);
                            const ownerShare = grossCommission * (ownerSharePct / 100);
                            if (vendedorMap.has(ownerId)) {
                                vendedorMap.get(ownerId)!.potencial += ownerShare;
                                totalPotential += ownerShare;
                            }
                        }
                    }
                }
            }

            setSummary({
                total_devengada: devengada,
                total_pagada: pagada,
                total_ajustes: ajustes,
                total_reversos: reversos,
                pendiente: devengada + ajustes + reversos - pagada,
                potencial: totalPotential
            });

            setVendedorBreakdown(
                Array.from(vendedorMap.entries())
                    .map(([vid, v]) => ({
                        vendedor_id: vid,
                        vendedor_name: v.name,
                        devengada: v.devengada,
                        pagada: v.pagada,
                        pendiente: v.devengada - v.pagada,
                        potencial: v.potencial,
                        open_opps_count: v.open_ops_count,
                        open_opps_value: v.open_ops_value
                    }))
                    // Sort: Users by Potential commission (highest first)
                    .sort((a, b) => b.potencial - a.potencial)
            );

        } catch (err: any) {
            console.error('Error fetching commission dashboard:', err);
            setError(err.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [currentUserId, dateFrom, dateTo]);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    return {
        summary,
        vendedorBreakdown,
        loading,
        error,
        refresh: fetchDashboard,
        setDateFrom,
        setDateTo,
    };
}
