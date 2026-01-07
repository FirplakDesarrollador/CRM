"use client";

import { useState } from 'react';
import { useActivities, LocalActivity } from '@/lib/hooks/useActivities';
import { useOpportunities } from '@/lib/hooks/useOpportunities';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Plus,
    Clock,
    CheckCircle2,
    Circle,
    Building2,
    CalendarDays,
    Search
} from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { useForm } from 'react-hook-form';

export default function ActivitiesPage() {
    const { activities, createActivity, toggleComplete } = useActivities();
    const { opportunities } = useOpportunities();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [view, setView] = useState<'agenda' | 'month'>('agenda');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Format activities for display
    const filteredActivities = activities?.filter(act => {
        const actDate = new Date(act.fecha_inicio);
        return (
            actDate.getDate() === selectedDate.getDate() &&
            actDate.getMonth() === selectedDate.getMonth() &&
            actDate.getFullYear() === selectedDate.getFullYear()
        );
    })?.sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)] space-y-4">
            {/* Header */}
            <header className="flex justify-between items-center p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
                        <CalendarIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Actividades</h1>
                        <p className="text-sm text-slate-500">Planifica tu día y haz seguimiento</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all hover:scale-105 active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    Nueva Actividad
                </button>
            </header>

            <div className="flex flex-1 gap-6 overflow-hidden">
                {/* Mini Calendar / Sidebar */}
                <div className="w-80 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-y-auto hidden lg:block">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-900">Calendario</h3>
                            <div className="flex gap-1">
                                <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Placeholder for Mini Cal */}
                        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase">
                            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(d => <div key={d}>{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: 31 }).map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setSelectedDate(new Date(2026, 0, i + 1))}
                                    className={cn(
                                        "h-9 rounded-lg text-sm transition-all",
                                        selectedDate.getDate() === (i + 1)
                                            ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-100"
                                            : "hover:bg-slate-50 text-slate-600"
                                    )}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>

                        <hr className="border-slate-100" />

                        {/* Summary */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hoy</h3>
                            <div className="space-y-2">
                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                        <Plus className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-900">Crear Tareas</p>
                                        <p className="text-[10px] text-slate-500">Próximos eventos</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Agenda View */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors">
                                <CalendarDays className="w-5 h-5 text-blue-500" />
                                <span className="font-bold">Vista Agenda</span>
                            </button>
                            <span className="text-slate-300">|</span>
                            <span className="text-lg font-bold text-slate-900">
                                {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                        </div>
                        <div className="flex gap-2 p-1 bg-slate-50 rounded-xl border border-slate-100">
                            <button className="px-4 py-1.5 rounded-lg text-xs font-bold bg-white text-blue-600 shadow-sm">Hoy</button>
                            <button className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-white transition-all">Semana</button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {filteredActivities && filteredActivities.length > 0 ? (
                            <div className="space-y-4">
                                {filteredActivities.map((act) => {
                                    const opp = opportunities?.find(o => o.id === act.opportunity_id);
                                    return (
                                        <div
                                            key={act.id}
                                            className={cn(
                                                "group p-4 rounded-2xl border transition-all hover:shadow-md",
                                                act.is_completed
                                                    ? "bg-slate-50 border-slate-100 opacity-75"
                                                    : "bg-white border-slate-200 hover:border-blue-300"
                                            )}
                                        >
                                            <div className="flex items-start gap-4">
                                                <button
                                                    onClick={() => toggleComplete(act.id, !act.is_completed)}
                                                    className="mt-1 transition-colors"
                                                >
                                                    {act.is_completed ? (
                                                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                                    ) : (
                                                        <Circle className="w-6 h-6 text-slate-300 hover:text-blue-400" />
                                                    )}
                                                </button>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className={cn(
                                                            "font-bold text-lg",
                                                            act.is_completed ? "text-slate-500 line-through" : "text-slate-900"
                                                        )}>
                                                            {act.asunto}
                                                        </h4>
                                                        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            {new Date(act.fecha_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>

                                                    {act.descripcion && (
                                                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{act.descripcion}</p>
                                                    )}

                                                    {(opp || act.opportunity_id) && (
                                                        <div className="mt-4 flex items-center gap-3">
                                                            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                                                <Building2 className="w-3 h-3" />
                                                                {opp?.nombre || 'Oportunidad'}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                                <div className="bg-slate-50 p-6 rounded-full">
                                    <Clock className="w-12 h-12 text-slate-200" />
                                </div>
                                <div className="text-center">
                                    <h3 className="font-bold text-slate-600">No hay actividades</h3>
                                    <p className="text-sm">Todo despejado para este día</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal for Creating Activity */}
            {isModalOpen && (
                <CreateActivityModal
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={(data) => {
                        createActivity(data);
                        setIsModalOpen(false);
                    }}
                    opportunities={opportunities}
                />
            )}
        </div>
    );
}

interface CreateActivityModalProps {
    onClose: () => void;
    onSubmit: (data: any) => void;
    opportunities?: any[];
}

function CreateActivityModal({ onClose, onSubmit, opportunities }: CreateActivityModalProps) {
    const { register, handleSubmit } = useForm();

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900">Programar Actividad</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Asunto</label>
                        <input
                            {...register('asunto', { required: true })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            placeholder="Ej. Llamar para seguimiento"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Fecha Inicio</label>
                            <input
                                type="datetime-local"
                                {...register('fecha_inicio', { required: true })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                defaultValue={new Date().toISOString().slice(0, 16)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Fecha Fin</label>
                            <input
                                type="datetime-local"
                                {...register('fecha_fin')}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                defaultValue={new Date(Date.now() + 3600000).toISOString().slice(0, 16)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Oportunidad Relacionada</label>
                        <select
                            {...register('opportunity_id')}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                        >
                            <option value="">Seleccione una oportunidad...</option>
                            {opportunities?.map((opp: any) => (
                                <option key={opp.id} value={opp.id}>{opp.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Descripción</label>
                        <textarea
                            {...register('descripcion')}
                            rows={3}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                            placeholder="Notas adicionales..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-blue-200"
                        >
                            Agendar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
