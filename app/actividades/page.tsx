"use client";

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
    Search,
    ListTodo,
    CalendarClock
} from 'lucide-react';

import { cn } from '@/components/ui/utils';
import { CreateActivityModal } from '@/components/activities/CreateActivityModal';

function ActivitiesContent() {
    const searchParams = useSearchParams();
    const { activities, createActivity, updateActivity, toggleComplete } = useActivities();
    const { opportunities } = useOpportunities();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [view, setView] = useState<'agenda' | 'month'>('agenda');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<LocalActivity | null>(null);

    // Deep linking: detect id in URL and open edit modal
    useEffect(() => {
        const id = searchParams.get('id');
        if (id && activities) {
            const act = activities.find(a => a.id === id);
            if (act) {
                setSelectedDate(new Date(act.fecha_inicio));
                setSelectedActivity(act);
                setIsModalOpen(true);
            }
        }
    }, [searchParams, activities]);

    const handlePrev = () => {
        const newDate = new Date(selectedDate);
        if (view === 'month') {
            newDate.setDate(1);
            newDate.setMonth(newDate.getMonth() - 1);
        } else {
            newDate.setDate(newDate.getDate() - 1);
        }
        setSelectedDate(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(selectedDate);
        if (view === 'month') {
            newDate.setDate(1);
            newDate.setMonth(newDate.getMonth() + 1);
        } else {
            newDate.setDate(newDate.getDate() + 1);
        }
        setSelectedDate(newDate);
    };

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
                {/* Agenda / Month View */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => setView(view === 'agenda' ? 'month' : 'agenda')}
                                className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors"
                            >
                                {view === 'agenda' ? <CalendarDays className="w-5 h-5 text-blue-500" /> : <CalendarIcon className="w-5 h-5 text-blue-500" />}
                                <span className="font-bold">{view === 'agenda' ? 'Vista Agenda' : 'Vista Mensual'}</span>
                            </button>

                            <div className="flex items-center gap-4 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                <button
                                    onClick={handlePrev}
                                    className="p-1 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-blue-600 transition-all"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <span className="text-base font-bold text-slate-900 capitalize min-w-[160px] text-center">
                                    {view === 'agenda'
                                        ? selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
                                        : selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                                    }
                                </span>
                                <button
                                    onClick={handleNext}
                                    className="p-1 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-blue-600 transition-all"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-2 p-1 bg-slate-50 rounded-xl border border-slate-100">
                            <button
                                onClick={() => setView('agenda')}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                    view === 'agenda' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                Agenda
                            </button>
                            <button
                                onClick={() => setView('month')}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                    view === 'month' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                Mes
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                        {view === 'agenda' ? (
                            filteredActivities && filteredActivities.length > 0 ? (
                                <div className="space-y-4">
                                    {filteredActivities.map((act) => {
                                        const opp = opportunities?.find(o => o.id === act.opportunity_id);
                                        return (
                                            <div
                                                key={act.id}
                                                className={cn(
                                                    "group p-4 bg-white rounded-2xl border transition-all hover:shadow-md cursor-pointer",
                                                    act.is_completed
                                                        ? "border-slate-100 opacity-75"
                                                        : act.tipo_actividad === 'TAREA'
                                                            ? "border-emerald-200 hover:border-emerald-300 hover:shadow-emerald-100"
                                                            : "border-blue-200 hover:border-blue-300 hover:shadow-blue-100"
                                                )}
                                                onClick={() => {
                                                    setSelectedActivity(act);
                                                    setIsModalOpen(true);
                                                }}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleComplete(act.id, !act.is_completed);
                                                        }}
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
                                                            {act.tipo_actividad === 'EVENTO' ? (
                                                                <div className="flex items-center gap-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                                                    <Clock className="w-3.5 h-3.5" />
                                                                    {new Date(act.fecha_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                                                    <ListTodo className="w-3.5 h-3.5" />
                                                                    Tarea
                                                                </div>
                                                            )}
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
                            )
                        ) : (
                            /* Month View Grid */
                            <div className="h-full flex flex-col">
                                <div className="grid grid-cols-7 mb-2 text-center text-xs font-bold text-slate-400 uppercase">
                                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => <div key={d} className="py-2">{d}</div>)}
                                </div>
                                <div className="grid grid-cols-7 flex-1 auto-rows-fr gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                                    {(() => {
                                        const year = selectedDate.getFullYear();
                                        const month = selectedDate.getMonth();
                                        const firstDay = new Date(year, month, 1);
                                        const lastDay = new Date(year, month + 1, 0);

                                        const days = [];
                                        const startPadding = firstDay.getDay();

                                        // Padding days from prev month
                                        for (let i = 0; i < startPadding; i++) {
                                            days.push(<div key={`pad-${i}`} className="bg-slate-50/50" />);
                                        }

                                        // Actual days
                                        for (let i = 1; i <= lastDay.getDate(); i++) {
                                            const currentDate = new Date(year, month, i);
                                            const dayActivities = activities?.filter(a => {
                                                const d = new Date(a.fecha_inicio);
                                                return d.getDate() === i && d.getMonth() === month && d.getFullYear() === year;
                                            }) || [];

                                            const isToday = new Date().toDateString() === currentDate.toDateString();
                                            const isSelected = selectedDate.getDate() === i && selectedDate.getMonth() === month;
                                            const hasTasks = dayActivities.some(a => a.tipo_actividad === 'TAREA');
                                            const hasEvents = dayActivities.some(a => a.tipo_actividad === 'EVENTO');

                                            days.push(
                                                <div
                                                    key={`day-${i}`}
                                                    onClick={() => { setSelectedDate(currentDate); setView('agenda'); }}
                                                    className={cn(
                                                        "group relative bg-white p-1.5 min-h-[90px] transition-all cursor-pointer flex flex-col",
                                                        isSelected ? "bg-blue-50 ring-2 ring-inset ring-blue-500" : "hover:bg-slate-50",
                                                        isToday && !isSelected && "bg-amber-50/50"
                                                    )}
                                                >
                                                    {/* Day Header */}
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className={cn(
                                                            "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                                                            isToday
                                                                ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                                                                : isSelected
                                                                    ? "bg-blue-100 text-blue-700"
                                                                    : "text-slate-600"
                                                        )}>
                                                            {i}
                                                        </span>
                                                        {/* Activity Count Badge */}
                                                        {dayActivities.length > 0 && (
                                                            <div className="flex items-center gap-0.5">
                                                                {hasTasks && <div className="w-2 h-2 rounded-full bg-emerald-400" title="Tareas" />}
                                                                {hasEvents && <div className="w-2 h-2 rounded-full bg-blue-400" title="Eventos" />}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Activity Preview */}
                                                    <div className="flex-1 overflow-hidden space-y-0.5">
                                                        {dayActivities.slice(0, 2).map(act => (
                                                            <div key={act.id} className={cn(
                                                                "text-[10px] px-1.5 py-0.5 rounded truncate font-medium border-l-2",
                                                                act.is_completed
                                                                    ? "bg-slate-50 text-slate-400 border-slate-300 line-through"
                                                                    : act.tipo_actividad === 'TAREA'
                                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-400"
                                                                        : "bg-blue-50 text-blue-700 border-blue-400"
                                                            )}>
                                                                {act.asunto}
                                                            </div>
                                                        ))}
                                                        {dayActivities.length > 2 && (
                                                            <div className="text-[9px] text-slate-400 font-medium pl-1">
                                                                +{dayActivities.length - 2} más
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Hover Tooltip */}
                                                    {dayActivities.length > 0 && (
                                                        <div className={cn(
                                                            "absolute left-1/2 -translate-x-1/2 z-50 w-56 bg-white rounded-lg shadow-2xl border border-slate-200 p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none",
                                                            i > 15 ? "bottom-full mb-2" : "top-full mt-1"
                                                        )}>
                                                            <div className="text-xs font-bold text-slate-900 mb-2 pb-2 border-b border-slate-100 flex justify-between items-center">
                                                                <span>{currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                                                                <span className="text-slate-400 font-normal text-[10px]">({dayActivities.length})</span>
                                                            </div>
                                                            <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                                                {dayActivities.map(act => (
                                                                    <div key={act.id} className={cn(
                                                                        "text-[11px] p-1.5 rounded border-l-2",
                                                                        act.is_completed
                                                                            ? "bg-slate-50 text-slate-400 border-slate-300"
                                                                            : act.tipo_actividad === 'TAREA'
                                                                                ? "bg-emerald-50 text-emerald-800 border-emerald-400"
                                                                                : "bg-blue-50 text-blue-800 border-blue-400"
                                                                    )}>
                                                                        <div className="font-medium truncate">{act.asunto}</div>
                                                                        <div className="text-[10px] opacity-70 mt-0.5">
                                                                            {new Date(act.fecha_inicio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                                            {act.is_completed && ' • Completada'}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        return days;
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal for Creating Activity */}
            {isModalOpen && (
                <CreateActivityModal
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedActivity(null);
                    }}
                    onSubmit={(data: any) => {
                        if (selectedActivity) {
                            updateActivity(selectedActivity.id, data);
                        } else {
                            createActivity(data);
                        }
                        setIsModalOpen(false);
                        setSelectedActivity(null);
                    }}
                    opportunities={opportunities}
                    initialData={selectedActivity}
                />
            )}
        </div>
    );
}

export default function ActivitiesPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando actividades...</div>}>
            <ActivitiesContent />
        </Suspense>
    );
}



