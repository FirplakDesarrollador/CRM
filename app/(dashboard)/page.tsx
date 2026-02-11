"use client";

import React from "react";
import { useOpportunities } from "@/lib/hooks/useOpportunities";
import { useActivities } from "@/lib/hooks/useActivities";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Briefcase, Building2, TrendingUp } from "lucide-react";

// Dashboard Components
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { OpportunitySummaryCard } from "@/components/dashboard/OpportunitySummaryCard";
import { ObjectivesCard } from "@/components/dashboard/ObjectivesCard";
import { RecentAccounts } from "@/components/dashboard/RecentAccounts";
import { SalesFunnelTile } from "@/components/dashboard/SalesFunnelTile";
import { DashboardGrid, DEFAULT_TILES, saveDashboardOrder } from "@/components/dashboard/DashboardGrid";
import { DashboardFilters, DashboardFilterState } from "@/components/dashboard/DashboardFilters";
import { PerformanceChartTile } from "@/components/dashboard/PerformanceChartTile";
import { ClientDistributionTile } from "@/components/dashboard/ClientDistributionTile";

export default function Home() {
  const { opportunities } = useOpportunities();
  const { activities } = useActivities();
  const { accounts } = useAccounts();
  const router = useRouter();
  const { user, role, isLoading: userLoading } = useCurrentUser();

  // Dashboard Filters State
  const [filters, setFilters] = useState<DashboardFilterState>({
    canal_id: null,
    advisor_id: null,
    subclasificacion_id: null,
    nivel_premium: null
  });

  // Filtered Data Sets
  const filteredData = useMemo(() => {
    if (!opportunities || !accounts) return { opportunities: [], accounts: [] };

    const accountMap = new Map(accounts.map(a => [a.id, a]));

    const filteredOpps = opportunities.filter(o => {
      if (filters.advisor_id && o.owner_user_id !== filters.advisor_id) return false;

      const acc = accountMap.get(o.account_id);
      if (filters.canal_id && acc?.canal_id !== filters.canal_id) return false;
      if (filters.subclasificacion_id && acc?.subclasificacion_id !== filters.subclasificacion_id) return false;
      if (filters.nivel_premium && acc?.nivel_premium !== filters.nivel_premium) return false;

      return true;
    });

    const filteredAccs = accounts.filter(a => {
      if (filters.canal_id && a.canal_id !== filters.canal_id) return false;
      if (filters.subclasificacion_id && a.subclasificacion_id !== filters.subclasificacion_id) return false;
      if (filters.nivel_premium && a.nivel_premium !== filters.nivel_premium) return false;
      // Note: advisor filter on accounts usually means who created it or who owns it
      if (filters.advisor_id && a.created_by !== filters.advisor_id) return false;
      return true;
    });

    return { opportunities: filteredOpps, accounts: filteredAccs };
  }, [opportunities, accounts, filters]);

  // Use filtered data for all derivations
  const displayOpps = filteredData.opportunities;
  const displayAccs = filteredData.accounts;

  // Personalization state
  const [isEditing, setIsEditing] = useState(false);
  const currentOrderRef = useRef<string[]>(DEFAULT_TILES.map((t) => t.id));
  const savedOrderRef = useRef<string[]>(DEFAULT_TILES.map((t) => t.id));

  // Find the "Important" opportunity (Highest value open)
  const importantOpportunity = useMemo(() => {
    if (!displayOpps) return null;
    return [...displayOpps]
      .filter(o => o.estado_id === 1 || !o.estado_id)
      .sort((a, b) => (Number(b.amount || b.valor) || 0) - (Number(a.amount || a.valor) || 0))[0];
  }, [displayOpps]);

  // Calculate Stats for Objectives
  const stats = useMemo(() => {
    if (!displayOpps || !displayAccs) {
      return {
        pipeline: { current: 0, goal: 50000000 },
        newOpps: { current: 0, goal: 50 },
        newAccounts: { current: 0, goal: 10 }
      };
    }

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyOpps = displayOpps.filter(o => {
      const d = new Date(o.created_at || '');
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const monthlyAccounts = displayAccs.filter(a => {
      const d = new Date(a.created_at || '');
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalPipeline = displayOpps
      .filter(o => o.estado_id === 1 || !o.estado_id)
      .reduce((acc, curr) => acc + (Number(curr.amount || curr.valor) || 0), 0);

    return {
      pipeline: { current: totalPipeline, goal: 200000000 },
      newOpps: { current: monthlyOpps.length, goal: 50 },
      newAccounts: { current: monthlyAccounts.length, goal: 10 }
    };
  }, [displayOpps, displayAccs]);

  // Recent Accounts
  const recentAccountsData = useMemo(() => {
    if (!displayAccs) return [];
    return [...displayAccs]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 4);
  }, [displayAccs]);

  // Recent Opportunities for list
  const recentOppsData = useMemo(() => {
    if (!displayOpps) return [];
    return [...displayOpps]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 5);
  }, [displayOpps]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
  };

  // Personalization handlers
  const handleStartEditing = useCallback(() => {
    savedOrderRef.current = [...currentOrderRef.current];
    setIsEditing(true);
  }, []);

  const handleSave = useCallback(() => {
    saveDashboardOrder(currentOrderRef.current);
    setIsEditing(false);
  }, []);

  const handleCancel = useCallback(() => {
    // Force reset to saved order by remounting the grid
    currentOrderRef.current = [...savedOrderRef.current];
    setIsEditing(false);
    // Trigger re-render to restore order
    setForceKey((k) => k + 1);
  }, []);

  const handleReset = useCallback(() => {
    const defaultOrder = DEFAULT_TILES.map((t) => t.id);
    currentOrderRef.current = defaultOrder;
    saveDashboardOrder(defaultOrder);
    setIsEditing(false);
    setForceKey((k) => k + 1);
  }, []);

  const handleOrderChange = useCallback((order: string[]) => {
    currentOrderRef.current = order;
  }, []);

  const [forceKey, setForceKey] = useState(0);

  // Build tile map
  const tiles: Record<string, React.ReactNode> = {
    "sales-funnel": <SalesFunnelTile filters={filters} />,
    "performance-chart": <PerformanceChartTile />,
    "client-distribution": <ClientDistributionTile />,
    "opportunity-card": (
      <OpportunitySummaryCard
        opportunity={importantOpportunity}
        isLoading={!displayOpps && !userLoading}
      />
    ),
    "objectives-card": (
      <ObjectivesCard
        stats={stats}
        isLoading={!displayOpps && !displayAccs}
      />
    ),
    "recent-accounts": (
      <RecentAccounts
        accounts={recentAccountsData}
        isLoading={!displayAccs}
      />
    ),
    "recent-opps": (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#254153]" />
            Oportunidades Recientes
          </h3>
          <Link href="/oportunidades" className="text-xs font-bold text-[#254153] hover:underline">
            Ver todas
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase tracking-wider">Oportunidad</th>
                <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase tracking-wider">Valor</th>
                <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase tracking-wider">Cliente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentOppsData.map((opp: any) => (
                <tr
                  key={opp.id}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  onClick={() => router.push(`/oportunidades/${opp.id}`)}
                >
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-800">{opp.nombre}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">{opp.fase_id || 'Prospecto'}</p>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-700">
                    {formatCurrency(opp.amount || opp.valor || 0)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <span className="text-slate-600 font-medium">Empresa Registrada</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
    "global-pipeline": (
      <div className="bg-[#254153] p-6 rounded-2xl text-white shadow-xl shadow-[#254153]/20 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
          <TrendingUp className="w-24 h-24" />
        </div>
        <h3 className="font-bold text-lg mb-1">Global Pipeline</h3>
        <p className="text-blue-200 text-xs mb-6">Total de oportunidades abiertas</p>
        <p className="text-3xl font-bold mb-2">{formatCurrency(stats.pipeline.current)}</p>
        <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-4">
          <div
            className="bg-white h-full"
            style={{ width: `${Math.min((stats.pipeline.current / stats.pipeline.goal) * 100, 100)}%` }}
          ></div>
        </div>
      </div>
    ),
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-12">
      <DashboardHeader
        onPersonalize={handleStartEditing}
        isEditing={isEditing}
        onSave={handleSave}
        onCancel={handleCancel}
        onReset={handleReset}
      />

      <DashboardFilters
        filters={filters}
        onFilterChange={setFilters}
      />

      <DashboardGrid
        key={forceKey}
        tiles={tiles}
        isEditing={isEditing}
        onOrderChange={handleOrderChange}
      />

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <Link
          href="/oportunidades/nueva"
          className="w-14 h-14 bg-[#254153] hover:bg-[#1a2f3d] text-white rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 group"
        >
          <Plus className="w-7 h-7 group-hover:rotate-90 transition-transform duration-300" />
        </Link>
      </div>
    </div>
  );
}
