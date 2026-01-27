"use client";

import React from "react";
import { cn } from "@/components/ui/utils";

interface CircularProgressProps {
    value: number;
    max: number;
    label: string;
    sublabel: string;
    prefix?: string;
}

const formatValue = (val: number) => {
    if (val >= 1000000000) return (val / 1000000000).toFixed(1) + "B";
    if (val >= 1000000) return (val / 1000000).toFixed(1) + "M";
    if (val >= 1000) return (val / 1000).toFixed(1) + "K";
    return val.toString();
};

const CircularProgress = ({ value, max, label, sublabel, prefix }: CircularProgressProps) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="flex flex-col items-center flex-1 min-w-0">
            <div className="relative w-24 h-24 mb-3">
                {/* Background Circle */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className="text-slate-100"
                    />
                    {/* Progress Circle */}
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className="text-[#254153] transition-all duration-1000 ease-out"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
                    <span className="text-sm font-bold text-slate-800 leading-none">{Math.round(percentage)}%</span>
                    <span className="text-[10px] text-slate-400 mt-1 font-bold truncate w-full" title={value.toString()}>
                        {prefix}{formatValue(value)}
                    </span>
                </div>
            </div>
            <p className="text-xs font-bold text-slate-700 text-center leading-tight mb-1 truncate w-full px-1">{label}</p>
            <p className="text-[10px] text-slate-400 text-center italic truncate w-full px-1">{sublabel}</p>
        </div>
    );
};

interface ObjectivesCardProps {
    stats: {
        pipeline: { current: number; goal: number };
        newOpps: { current: number; goal: number };
        newAccounts: { current: number; goal: number };
    };
    isLoading?: boolean;
}

export const ObjectivesCard = ({ stats, isLoading }: ObjectivesCardProps) => {
    return (
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 h-full">
            <div className="flex justify-between items-center mb-6 sm:mb-8">
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">Objetivos Comerciales</h3>
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md">
                    Enero 2026
                </span>
            </div>

            <div className="grid grid-cols-2 gap-y-8 gap-x-4">
                <CircularProgress
                    value={stats.pipeline.current}
                    max={stats.pipeline.goal}
                    label="Pipeline"
                    sublabel="Mensual"
                    prefix="$"
                />
                <CircularProgress
                    value={stats.newOpps.current}
                    max={stats.newOpps.goal}
                    label="Nuevas Opps"
                    sublabel={`Meta: ${stats.newOpps.goal}`}
                />
                <div className="col-span-2 flex justify-center">
                    <CircularProgress
                        value={stats.newAccounts.current}
                        max={stats.newAccounts.goal}
                        label="Nuevas Cuentas"
                        sublabel={`Meta: ${stats.newAccounts.goal}`}
                    />
                </div>
            </div>
        </div>
    );
};
