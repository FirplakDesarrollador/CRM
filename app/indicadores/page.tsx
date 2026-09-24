"use client";

import React, { useState } from "react";
import { BarChart3, Info, PieChart, ListChecks, LineChart, CalendarCheck2, Users2 } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { VentasGanadasTile } from "@/components/indicadores/VentasGanadasTile";
import { Page1EstadosTiempo } from "@/components/indicadores/reportes/Page1EstadosTiempo";
import { Page2Clasificaciones } from "@/components/indicadores/reportes/Page2Clasificaciones";
import { Page3MontoAsesor } from "@/components/indicadores/reportes/Page3MontoAsesor";
import { Page4Eventos } from "@/components/indicadores/reportes/Page4Eventos";
import { Page5Cuentas } from "@/components/indicadores/reportes/Page5Cuentas";

const REPORT_TABS = [
    { id: "estados", label: "Cohort", icon: PieChart },
    { id: "clasificaciones", label: "Clasificaciones", icon: ListChecks },
    { id: "montoAsesor", label: "Monto por Asesor", icon: LineChart },
    { id: "eventos", label: "Eventos", icon: CalendarCheck2 },
    { id: "cuentas", label: "Cuentas", icon: Users2 },
] as const;

type ReportTabId = typeof REPORT_TABS[number]["id"];

export default function IndicadoresPage() {
    const [activeTab, setActiveTab] = useState<ReportTabId>("estados");

    return (
        <div className="flex flex-col h-full bg-slate-50/50 p-6 space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            <style jsx>{`
                .scrollbar-thin::-webkit-scrollbar {
                    width: 6px;
                }
                .scrollbar-thin::-webkit-scrollbar-track {
                    background: transparent;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-linear-to-br from-[#254153] to-[#1a2f3d] rounded-xl text-white shadow-md">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Panel de Indicadores</h1>
                    </div>
                    <p className="text-slate-500 text-sm font-medium ml-1">
                        Visualiza los reportes estratégicos y métricas clave de desempeño en tiempo real.
                    </p>
                </div>

        <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-[#254153] transition-all shadow-xs group">
                        <Info className="w-4 h-4 text-slate-400 group-hover:text-[#254153]" />
                        Guía de Uso
                    </button>
                </div>
            </div>

            {/* Dashboard Tiles Section */}
            <div className="w-full relative z-10 block">
                <VentasGanadasTile />
            </div>

            {/* Native Reports Container (replaces the embedded Power BI report) */}
            <div className="w-full relative bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/30">
                {/* Tabs */}
                <div className="flex items-center gap-1 px-4 pt-4 border-b border-slate-100 overflow-x-auto rounded-t-3xl scrollbar-thin">
                    {REPORT_TABS.map(tab => {
                        const TabIcon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold whitespace-nowrap transition-all border-b-2",
                                    isActive
                                        ? "border-[#254153] text-[#254153] bg-slate-50/80"
                                        : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50"
                                )}
                            >
                                <TabIcon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div className="p-6">
                    {activeTab === "estados" && <Page1EstadosTiempo />}
                    {activeTab === "clasificaciones" && <Page2Clasificaciones />}
                    {activeTab === "montoAsesor" && <Page3MontoAsesor />}
                    {activeTab === "eventos" && <Page4Eventos />}
                    {activeTab === "cuentas" && <Page5Cuentas />}
                </div>
            </div>

            {/* Footer / Status */}
            <div className="flex items-center justify-between px-2 text-xs text-slate-400 font-medium">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Datos sincronizados desde el CRM
                </div>
                <div>
                    Última actualización: {new Date().toLocaleDateString()}
                </div>
            </div>
        </div>
    );
}
