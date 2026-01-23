"use client";

import React from "react";
import { TrendingUp, ArrowRight, DollarSign, Calendar } from "lucide-react";
import { cn } from "@/components/ui/utils";
import Link from "next/link";

interface OpportunitySummaryCardProps {
    opportunity: any;
    isLoading?: boolean;
}

export const OpportunitySummaryCard = ({ opportunity, isLoading }: OpportunitySummaryCardProps) => {
    if (isLoading) {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full animate-pulse">
                <div className="h-6 w-1/3 bg-slate-100 rounded mb-4"></div>
                <div className="h-20 w-full bg-slate-50 rounded mb-4"></div>
                <div className="h-10 w-full bg-slate-100 rounded"></div>
            </div>
        );
    }

    if (!opportunity) {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <TrendingUp className="w-6 h-6 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">No hay oportunidades activas</h3>
                <p className="text-sm text-slate-500 mt-1">Empieza creando una nueva oportunidad de negocio.</p>
                <Link
                    href="/oportunidades/nueva"
                    className="mt-4 text-sm font-bold text-[#254153] hover:underline flex items-center gap-1"
                >
                    Crear Oportunidad <ArrowRight className="w-4 h-4" />
                </Link>
            </div>
        );
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col">
            <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-slate-800">Oportunidad Clave</h3>
                <span className="px-2 py-1 rounded-lg bg-blue-50 text-[#254153] text-[10px] font-bold uppercase tracking-wider">
                    Prioritaria
                </span>
            </div>

            <div className="flex-1">
                <h4 className="text-xl font-bold text-slate-900 line-clamp-2 mb-2">
                    {opportunity.nombre}
                </h4>

                <div className="space-y-3 mt-4">
                    <div className="flex items-center gap-3 text-slate-600">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                            <DollarSign className="w-4 h-4 text-[#254153]" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 leading-none">Valor Estimado</p>
                            <p className="text-sm md:text-base font-bold text-slate-800 break-all">{formatCurrency(opportunity.amount || 0)}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-slate-600">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                            <Calendar className="w-4 h-4 text-[#254153]" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 leading-none">Cierre Estimado</p>
                            <p className="text-sm font-bold text-slate-800">
                                {opportunity.fecha_cierre_estimada
                                    ? new Date(opportunity.fecha_cierre_estimada).toLocaleDateString()
                                    : 'Sin fecha'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex gap-3">
                <Link
                    href={`/oportunidades/${opportunity.id}`}
                    className="flex-1 py-2.5 px-4 bg-[#254153] text-white text-center rounded-xl text-sm font-bold hover:bg-[#1a2f3d] transition-colors shadow-sm"
                >
                    Ver Detalles
                </Link>
                <button className="flex-1 py-2.5 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">
                    Actualizar
                </button>
            </div>
        </div>
    );
};
