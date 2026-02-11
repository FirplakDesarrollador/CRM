"use client";

import React from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
} from "recharts";
import { TrendingUp, ArrowUpRight, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const MOCK_DATA = [
    { name: "Ene", value: 45000000, opportunities: 12 },
    { name: "Feb", value: 52000000, opportunities: 15 },
    { name: "Mar", value: 48000000, opportunities: 10 },
    { name: "Abr", value: 61000000, opportunities: 22 },
    { name: "May", value: 55000000, opportunities: 18 },
    { name: "Jun", value: 67000000, opportunities: 25 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-4 shadow-xl border border-slate-100 rounded-xl">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
                <p className="text-sm font-bold text-[#254153]">
                    {formatCurrency(payload[0].value)}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                    {payload[0].payload.opportunities} Oportunidades
                </p>
            </div>
        );
    }
    return null;
};

export function PerformanceChartTile() {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-full flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Desempeño de Ventas</h3>
                        <p className="text-xs text-slate-400 font-medium italic">Histórico de Pipeline (Millones COP)</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="flex items-center gap-1 text-emerald-600 font-black text-xs bg-emerald-50 px-2 py-1 rounded-full">
                        <ArrowUpRight className="w-3 h-3" />
                        <span>+12.5%</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={MOCK_DATA} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#254153" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#254153" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                            dy={10}
                        />
                        <YAxis
                            hide
                            domain={['dataMin - 5000000', 'dataMax + 5000000']}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#254153', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#254153"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Promedio Mensual</span>
                        <span className="text-sm font-bold text-slate-700">{formatCurrency(54600000)}</span>
                    </div>
                </div>
                <button className="text-[10px] font-black text-[#254153] uppercase tracking-widest hover:underline">
                    Ver reporte detallado
                </button>
            </div>
        </div>
    );
}
