"use client";

import { useOpportunities } from "@/lib/hooks/useOpportunities";
import { useActivities } from "@/lib/hooks/useActivities";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Briefcase, Building2, TrendingUp } from "lucide-react";
import { cn } from "@/components/ui/utils";

// New Dashboard Components
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { OpportunitySummaryCard } from "@/components/dashboard/OpportunitySummaryCard";
import { ObjectivesCard } from "@/components/dashboard/ObjectivesCard";
import { RecentAccounts } from "@/components/dashboard/RecentAccounts";

export default function Home() {
  const { opportunities } = useOpportunities();
  const { activities } = useActivities();
  const { accounts } = useAccounts();
  const router = useRouter();
  const { user, role, isLoading: userLoading } = useCurrentUser();

  // Find the "Important" opportunity (Highest value open)
  const importantOpportunity = useMemo(() => {
    if (!opportunities) return null;
    return [...opportunities]
      .filter(o => o.estado_id === 1 || !o.estado_id)
      .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))[0];
  }, [opportunities]);

  // Calculate Stats for Objectives
  const stats = useMemo(() => {
    if (!opportunities || !accounts) {
      return {
        pipeline: { current: 0, goal: 50000000 },
        newOpps: { current: 0, goal: 50 },
        newAccounts: { current: 0, goal: 10 }
      };
    }

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyOpps = opportunities.filter(o => {
      const d = new Date(o.created_at || '');
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const monthlyAccounts = accounts.filter(a => {
      const d = new Date(a.created_at || '');
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalPipeline = opportunities
      .filter(o => o.estado_id === 1 || !o.estado_id)
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    return {
      pipeline: { current: totalPipeline, goal: 200000000 }, // Mock goal: 200M
      newOpps: { current: monthlyOpps.length, goal: 50 },
      newAccounts: { current: monthlyAccounts.length, goal: 10 }
    };
  }, [opportunities, accounts]);

  // Recent Accounts
  const recentAccounts = useMemo(() => {
    if (!accounts) return [];
    return [...accounts]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 4);
  }, [accounts]);

  // Recent Opportunities for list
  const recentOpps = useMemo(() => {
    if (!opportunities) return [];
    return [...opportunities]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 5);
  }, [opportunities]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-12">
      <DashboardHeader onPersonalize={() => console.log("Personalize")} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Sales & Objectives (Wider) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <OpportunitySummaryCard
              opportunity={importantOpportunity}
              isLoading={!opportunities && !userLoading}
            />
            <ObjectivesCard
              stats={stats}
              isLoading={!opportunities && !accounts}
            />
          </div>

          {/* Detailed Opportunities List */}
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
                  {recentOpps.map(opp => (
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
                        {formatCurrency(opp.amount || 0)}
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
        </div>

        {/* Right Column - Side Panels (Narrower) */}
        <div className="lg:col-span-4 space-y-6">
          <RecentAccounts
            accounts={recentAccounts}
            isLoading={!accounts}
          />

          {/* Quick Stats Card */}
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
        </div>
      </div>

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
