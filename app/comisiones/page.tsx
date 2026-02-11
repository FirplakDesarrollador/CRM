"use client";

import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { hasPermission } from '@/lib/permissions';
import { CommissionDashboard } from '@/components/comisiones/CommissionDashboard';
import { DollarSign } from 'lucide-react';
import Link from 'next/link';

export default function ComisionesPage() {
    const { role, isLoading: userLoading } = useCurrentUser();
    const canManageRules = hasPermission(role, 'manage_commission_rules');
    const canManageCategories = hasPermission(role, 'manage_commission_categories');
    const canViewAll = hasPermission(role, 'view_all_commissions');

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-600">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Comisiones</h1>
                        <p className="text-sm text-slate-500">
                            {userLoading ? 'Verificando perfil...' : (canViewAll ? 'Resumen consolidado del equipo' : 'Tus comisiones')}
                        </p>
                    </div>
                </div>

                {/* Quick Links */}
                <div className="flex items-center gap-2">
                    {userLoading ? (
                        <div className="flex gap-2">
                            <div className="w-24 h-9 bg-slate-100 animate-pulse rounded-xl" />
                            <div className="w-24 h-9 bg-slate-100 animate-pulse rounded-xl" />
                        </div>
                    ) : (
                        <>
                            {canManageRules && (
                                <Link href="/comisiones/reglas" className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">
                                    Reglas
                                </Link>
                            )}
                            {canManageCategories && (
                                <Link href="/comisiones/categorias" className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">
                                    Categorías
                                </Link>
                            )}
                            {canViewAll && (
                                <Link href="/comisiones/ledger" className="px-4 py-2 text-sm font-semibold text-white bg-[#254153] rounded-xl hover:bg-[#1a2f3d] transition-all">
                                    Ledger Completo
                                </Link>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Dashboard */}
            <CommissionDashboard />
        </div>
    );
}
