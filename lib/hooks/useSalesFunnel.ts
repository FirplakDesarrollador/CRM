import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalOportunidad, LocalFase } from "@/lib/db";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";

export interface FunnelStage {
    fase_id: number;
    fase_nombre: string;
    orden: number;
    total_amount: number;
    count: number;
    color: string;
}

export interface SalesFunnelFilters {
    canal_id: string | null;
    advisor_id: string | null;
    subclasificacion_id: number | null;
    nivel_premium: 'ORO' | 'PLATA' | 'BRONCE' | null;
}

export function useSalesFunnel(filters?: SalesFunnelFilters) {
    const { user, role, isLoading: userLoading } = useCurrentUser();

    const data = useLiveQuery(async () => {
        if (!user) return [];

        // 1. Get all relevant phases
        const allPhases = await db.phases.toArray();
        const phases = allPhases.filter(f => f.is_active);
        const sortedPhases = phases.sort((a, b) => a.orden - b.orden);

        // 2. Get all relevant opportunities (Open only)
        const allOpps = await db.opportunities.toArray();
        const allAccounts = await db.accounts.toArray();
        const accountMap = new Map(allAccounts.map(a => [a.id, a]));

        const filteredOpps = allOpps.filter(o => {
            // Filter deleted
            if (o.is_deleted) return false;
            // Permission filtering
            let hasPermission = false;
            if (role === 'ADMIN') hasPermission = true;
            else if (role === 'COORDINADOR') {
                const isOwner = o.owner_user_id === user.id;
                const coordinated = false; // Need to implement coordinator check if possible locally
                // For now assume all synced opps for coordinator are visible due to RLS sync logic
                hasPermission = true;
            } else if (role === 'VENDEDOR') {
                hasPermission = o.owner_user_id === user.id;
            } else {
                hasPermission = o.owner_user_id === user.id;
            }

            if (!hasPermission) return false;

            // Opportunity Status
            if (o.estado_id !== 1 && o.estado_id !== undefined && o.estado_id !== null) return false;

            // Applied Filters
            if (filters?.advisor_id && o.owner_user_id !== filters.advisor_id) return false;

            if (filters?.canal_id || filters?.subclasificacion_id || filters?.nivel_premium) {
                const acc = accountMap.get(o.account_id);
                if (!acc) return false;
                if (filters.canal_id && acc.canal_id !== filters.canal_id) return false;
                if (filters.subclasificacion_id && acc.subclasificacion_id !== filters.subclasificacion_id) return false;
                if (filters.nivel_premium && acc.nivel_premium !== filters.nivel_premium) return false;
            }

            return true;
        });

        // 3. Aggregate
        const aggregated = sortedPhases.map(phase => {
            const stageOpps = filteredOpps.filter(o => o.fase_id === phase.id);
            const total_amount = stageOpps.reduce((acc, curr) => acc + (Number(curr.amount || curr.valor) || 0), 0);

            // Assign colors based on order
            let color = '#64748b';
            switch (phase.orden) {
                case 1: color = '#6366f1'; break; // Indigo
                case 2: color = '#8b5cf6'; break; // Violet
                case 3: color = '#ec4899'; break; // Pink
                case 4: color = '#f43f5e'; break; // Rose
                case 5: color = '#f97316'; break; // Orange
                case 6: color = '#10b981'; break; // Emerald
            }

            return {
                fase_id: phase.id,
                fase_nombre: phase.nombre,
                orden: phase.orden,
                total_amount,
                count: stageOpps.length,
                color
            };
        });

        return aggregated;
    }, [user, role, filters?.canal_id, filters?.advisor_id, filters?.subclasificacion_id]);

    return {
        data: data || [],
        isLoading: userLoading || data === undefined,
        error: null
    };
}
