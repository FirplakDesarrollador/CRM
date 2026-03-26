"use client";

import React from "react";
import ReactECharts from "echarts-for-react";
import { PieChart, Info } from "lucide-react";

export function ClientDistributionTile() {
    const option = {
        tooltip: {
            trigger: 'item',
            backgroundColor: '#254153',
            borderWidth: 0,
            textStyle: {
                color: '#fff',
                fontSize: 12,
                fontWeight: 'bold'
            },
            formatter: '{b}: <br/>{c} ({d}%)'
        },
        legend: {
            bottom: '0%',
            left: 'center',
            icon: 'circle',
            textStyle: {
                color: '#64748b',
                fontSize: 10,
                fontWeight: 'bold'
            }
        },
        color: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'],
        series: [
            {
                name: 'Distribución',
                type: 'pie',
                radius: ['45%', '75%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 8,
                    borderColor: '#fff',
                    borderWidth: 4
                },
                label: {
                    show: false,
                    position: 'center'
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 16,
                        fontWeight: 'bold',
                        formatter: '{b}\n{d}%'
                    }
                },
                labelLine: {
                    show: false
                },
                data: [
                    { value: 1048, name: 'Mayoristas' },
                    { value: 735, name: 'Minoristas' },
                    { value: 580, name: 'Distribuidores' },
                    { value: 484, name: 'Proyectos' },
                    { value: 300, name: 'Otros' }
                ]
            }
        ]
    };

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-full flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <PieChart className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Distribución de Clientes</h3>
                        <p className="text-xs text-slate-400 font-medium lowercase">Análisis por Segmento</p>
                    </div>
                </div>
                <button className="text-slate-300 hover:text-slate-400">
                    <Info className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 w-full flex items-center justify-center pt-4">
                <ReactECharts
                    option={option}
                    style={{ height: '300px', width: '100%' }}
                    opts={{ renderer: 'svg' }}
                />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Clientes</p>
                    <p className="text-lg font-black text-[#254153]">3,147</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Tasa Crecimiento</p>
                    <p className="text-lg font-black text-emerald-500">+8.2%</p>
                </div>
            </div>
        </div>
    );
}
