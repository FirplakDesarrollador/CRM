'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function DebugCommissionPage() {
    const [oppId, setOppId] = useState('');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const runDiagnostics = async () => {
        setLoading(true);
        setResult(null);
        try {
            // 1. Fetch Opportunity
            const { data: opp, error: oppError } = await supabase
                .from('CRM_Oportunidades')
                .select(`
                    id, amount, account_id, owner_user_id, status:estado_id,
                    account:CRM_Cuentas!account_id (id, nombre, canal_id),
                    owner:profiles!owner_user_id (email)
                `)
                .eq('id', oppId)
                .single();

            if (oppError) throw oppError;

            // 2. Fetch Collaborators
            const { data: collabs, error: collabError } = await supabase
                .from('CRM_Oportunidades_Colaboradores')
                .select('*')
                .eq('oportunidad_id', opp.id);

            // 3. Fetch Rules
            const { data: rules, error: rulesError } = await supabase
                .from('CRM_ComisionReglas')
                .select('*')
                .eq('is_active', true);

            // 4. Fetch Ledger
            const { data: ledger, error: ledgerError } = await supabase
                .from('CRM_ComisionLedger')
                .select('*')
                .eq('oportunidad_id', opp.id);

            // 5. Logic Simulation (Frontend)
            const applicableRules = rules?.filter(r =>
                (!r.vendedor_id || r.vendedor_id === opp.owner_user_id) &&
                (!r.cuenta_id || r.cuenta_id === opp.account_id)
            );

            const scoredRules = applicableRules?.map(r => {
                let score = 0;
                if (r.cuenta_id === opp.account_id) score += 4;
                if (r.vendedor_id === opp.owner_user_id) score += 2;
                if (r.categoria_id) score += 0; // Not checked here
                if (r.canal_id && r.canal_id === opp.account?.canal_id) score += 1;
                return { ...r, score };
            });

            scoredRules?.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return Number(a.porcentaje_comision) - Number(b.porcentaje_comision);
            });

            setResult({
                opportunity: opp,
                collaborators: collabs,
                allRulesCount: rules?.length,
                applicableRules: scoredRules,
                ledger: ledger,
                winnerRule: scoredRules?.[0]
            });

        } catch (e: any) {
            setResult({ error: e.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 space-y-4">
            <h1 className="text-2xl font-bold">Diagnóstico de Comisiones</h1>
            <div className="flex gap-2">
                <Input
                    placeholder="ID de Oportunidad (UUID)"
                    value={oppId}
                    onChange={e => setOppId(e.target.value)}
                />
                <Button onClick={runDiagnostics} disabled={loading}>
                    {loading ? 'Analizando...' : 'Analizar'}
                </Button>
            </div>

            {result && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader><CardTitle>Oportunidad</CardTitle></CardHeader>
                        <CardContent>
                            <pre className="text-xs overflow-auto max-h-60">
                                {JSON.stringify(result.opportunity, null, 2)}
                            </pre>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Colaboradores (Splits)</CardTitle></CardHeader>
                        <CardContent>
                            <pre className="text-xs overflow-auto max-h-60">
                                {JSON.stringify(result.collaborators, null, 2)}
                            </pre>
                        </CardContent>
                    </Card>

                    <Card className="col-span-2">
                        <CardHeader><CardTitle>Simulación de Reglas</CardTitle></CardHeader>
                        <CardContent>
                            <div className="mb-2 font-semibold">Regla Ganadora Frontend:</div>
                            <pre className="bg-green-100 p-2 text-xs mb-4">
                                {JSON.stringify(result.winnerRule, null, 2)}
                            </pre>

                            <div className="mb-2 font-semibold">Todas las Reglas Aplicables:</div>
                            <pre className="text-xs overflow-auto max-h-60">
                                {JSON.stringify(result.applicableRules, null, 2)}
                            </pre>
                        </CardContent>
                    </Card>

                    <Card className="col-span-2">
                        <CardHeader><CardTitle>Registros en Ledger (Backend)</CardTitle></CardHeader>
                        <CardContent>
                            <pre className="text-xs overflow-auto max-h-60">
                                {JSON.stringify(result.ledger, null, 2)}
                            </pre>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
