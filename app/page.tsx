"use client";

import { useOpportunities } from "@/lib/hooks/useOpportunities";
import { useActivities } from "@/lib/hooks/useActivities";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Calendar, CheckCircle, Plus, Building2 } from "lucide-react";

export default function Home() {
  const { opportunities } = useOpportunities();
  const { activities } = useActivities();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState({
    openCount: 0,
    wonAmount: 0,
    activitiesToday: 0
  });

  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data }) => setUser(data.user))
      .catch((err) => {
        // Silently ignore network errors (offline mode)
        if (!err.message?.includes('Failed to fetch')) {
          console.error('Error getting user:', err);
        }
      });
  }, []);

  useEffect(() => {
    if (!opportunities || !activities) return;

    const openOpps = opportunities.filter(o => o.estado_id !== 4 && o.estado_id !== 5); // Assuming 4=Won, 5=Lost
    const wonOpps = opportunities.filter(o => o.estado_id === 4);

    const today = new Date();
    const actsToday = activities.filter(a => {
      const d = new Date(a.fecha_inicio);
      return d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();
    });

    const totalWon = wonOpps.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    setStats({
      openCount: openOpps.length,
      wonAmount: totalWon,
      activitiesToday: actsToday.length
    });
  }, [opportunities, activities]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
  };

  // Get today's activities sorted by time
  const todayActivities = activities?.filter(a => {
    const d = new Date(a.fecha_inicio);
    const today = new Date();
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  }).sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime()).slice(0, 5) || [];

  // Recent opportunities
  const recentOpps = opportunities?.sort((a, b) =>
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  ).slice(0, 5) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Hola, {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Vendedor'}
          </h2>
          <p className="text-slate-500">Aquí está tu resumen de hoy.</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-slate-900 capitalize">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Oportunidades Abiertas</p>
            <h3 className="text-3xl font-bold text-slate-800 mt-1">{stats.openCount}</h3>
          </div>
          <div className="p-3 rounded-lg text-blue-600 bg-blue-50">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Actividades Hoy</p>
            <h3 className="text-3xl font-bold text-slate-800 mt-1">{stats.activitiesToday}</h3>
          </div>
          <div className="p-3 rounded-lg text-purple-600 bg-purple-50">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ventas Ganadas</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(stats.wonAmount)}</h3>
          </div>
          <div className="p-3 rounded-lg text-emerald-600 bg-emerald-50">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Agenda Column */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-slate-800">Agenda de Hoy</h3>
            <Link href="/actividades" className="text-sm text-blue-600 font-medium hover:underline">Ver todo</Link>
          </div>

          <div className="space-y-3">
            {todayActivities.length > 0 ? todayActivities.map(act => (
              <div key={act.id} className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500 flex flex-col gap-1">
                <span className="text-xs font-bold text-blue-600 uppercase">
                  {new Date(act.fecha_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <h4 className="font-semibold text-slate-800 line-clamp-1">{act.asunto}</h4>
                <p className="text-sm text-slate-500 line-clamp-1">{act.descripcion || 'Sin descripción'}</p>
              </div>
            )) : (
              <div className="text-center py-8 bg-slate-50 rounded-lg dashed border-2 border-slate-200">
                <p className="text-slate-400 text-sm">No tienes actividades para hoy</p>
                <Link href="/actividades" className="text-blue-600 text-xs font-bold mt-2 block">Agendar Ahora</Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Opportunities */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-slate-800">Oportunidades Recientes</h3>
            <Link href="/oportunidades" className="text-sm text-blue-600 font-medium hover:underline">Ver todas</Link>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-slate-500">Oportunidad</th>
                    <th className="px-6 py-3 font-semibold text-slate-500">Valor</th>
                    <th className="px-6 py-3 font-semibold text-slate-500">Fase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentOpps.length > 0 ? recentOpps.map(opp => (
                    <tr key={opp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{opp.nombre}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {opp.account_id ? 'Cliente Registrado' : 'Prospecto'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-900 font-mono">
                        {formatCurrency(opp.amount || 0)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          {opp.fase_id || 'Prospecto'}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-slate-400">
                        No hay oportunidades recientes
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action FAB */}
      <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8">
        <Link href="/oportunidades/nueva">
          <button className="bg-slate-900 hover:bg-slate-800 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all">
            <Plus className="w-6 h-6" />
          </button>
        </Link>
      </div>
    </div>
  );
}
