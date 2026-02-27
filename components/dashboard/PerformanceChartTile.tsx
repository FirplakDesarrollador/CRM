"use client";

import React from "react";
import ReactECharts from "echarts-for-react";
import { TrendingUp, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const MOCK_DATA = [
    { name: "Ene", value: 45000000, opportunities: 12 },
    { name: "Feb", value: 52000000, opportunities: 15 },
    { name: "Mar", value: 48000000, opportunities: 10 },
    { name: "Abr", value: 61000000, opportunities: 22 },
    { name: "May", value: 55000000, opportunities: 18 },
    { name: "Jun", value: 67000000, opportunities: 25 },
];

export function PerformanceChartTile() {
    const option = {
        tooltip: {
            trigger: "axis",
            backgroundColor: "#fff",
            borderColor: "#f1f5f9",
            borderWidth: 1,
            padding: 16,
            textStyle: { color: "#254153", fontSize: 12 },
            formatter: (params: any) => {
                const p = params[0];
                const item = MOCK_DATA[p.dataIndex];
                return `
                    <div style="font-family: inherit;">
                        <div style="text-transform: uppercase; font-size: 10px; font-weight: 900; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 8px;">${p.name}</div>
                        <div style="font-size: 14px; font-weight: 700; color: #254153;">${formatCurrency(p.value)}</div>
                        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">${item.opportunities} Oportunidades</div>
                    </div>
                `;
            },
            axisPointer: {
                lineStyle: { color: "#254153", width: 1, type: "dashed" },
            },
        },
        grid: { top: 10, right: 10, bottom: 30, left: 10 },
        xAxis: {
            type: "category",
            data: MOCK_DATA.map((d) => d.name),
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { fontSize: 10, fontWeight: 700, color: "#94a3b8", margin: 10 },
        },
        yAxis: { type: "value", show: false },
        series: [
            {
                type: "line",
                data: MOCK_DATA.map((d) => d.value),
                smooth: true,
                symbol: "none",
                lineStyle: { width: 3, color: "#254153" },
                areaStyle: {
                    color: {
                        type: "linear",
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: "rgba(37, 65, 83, 0.1)" },
                            { offset: 1, color: "rgba(37, 65, 83, 0)" },
                        ],
                    },
                },
                animationDuration: 1500,
            },
        ],
    };

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

            <div className="flex-1 w-full">
                <ReactECharts
                    option={option}
                    style={{ height: "100%", width: "100%" }}
                    opts={{ renderer: "svg" }}
                />
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
