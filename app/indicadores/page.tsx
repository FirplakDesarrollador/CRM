"use client";

import React from "react";
import { BarChart3, ExternalLink, Info } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { VentasGanadasTile } from "@/components/indicadores/VentasGanadasTile";

export default function IndicadoresPage() {
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
                    <a
                        href={process.env.NEXT_PUBLIC_POWERBI_REPORT_URL || "https://app.powerbi.com/"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-[#254153] to-[#1a2f3d] text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-[#254153]/20 transition-all active:scale-95"
                    >
                        Abrir en Power BI
                        <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            </div>

            {/* Dashboard Tiles Section */}
            <div className="w-full relative z-10 block">
                <VentasGanadasTile />
            </div>

            {/* Power BI Container - Clean Design */}
            <div className="flex-1 min-h-[700px] w-full relative bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/30 overflow-hidden group">
                {/* Removed overlay to prevent blurriness */}
                
                {process.env.NEXT_PUBLIC_POWERBI_REPORT_URL ? (
                    <iframe
                        title="Reporte BI CRM"
                        className="w-full h-full relative z-0 border-none bg-transparent"
                        src={process.env.NEXT_PUBLIC_POWERBI_REPORT_URL}
                        allowFullScreen={true}
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-4">
                        <div className="w-full h-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center p-12 transition-colors group-hover:bg-slate-50/80">
                            <div className="w-20 h-20 bg-linear-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg mb-6 transform transition-transform group-hover:scale-110 duration-500">
                                <BarChart3 className="w-12 h-12 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">Listo para insertar Power BI</h2>
                            <p className="text-slate-500 max-w-md mx-auto">
                                Para visualizar tus reportes, configura la variable <code>NEXT_PUBLIC_POWERBI_REPORT_URL</code> en tu archivo de entorno.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer / Status */}
            <div className="flex items-center justify-between px-2 text-xs text-slate-400 font-medium">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Conectado a Power BI Service
                </div>
                <div>
                    Última actualización: {new Date().toLocaleDateString()}
                </div>
            </div>
        </div>
    );
}
