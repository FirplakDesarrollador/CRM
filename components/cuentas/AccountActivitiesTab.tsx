"use client";

import { useActivitiesServer } from "@/lib/hooks/useActivitiesServer";
import { useActivities } from "@/lib/hooks/useActivities";
import { useState } from "react";
import { CreateActivityModal } from "@/components/activities/CreateActivityModal";
import { 
    Calendar as CalendarIcon, 
    ListTodo, 
    Clock, 
    Circle, 
    CheckCircle2,
    Briefcase,
    Building2,
    Plus
} from "lucide-react";
import { cn } from "@/components/ui/utils";

export default function AccountActivitiesTab({ accountId }: { accountId: string }) {
    const {
        data: activities,
        loading,
        hasMore,
        loadMore,
        refresh
    } = useActivitiesServer({ accountId, pageSize: 15 });

    const { toggleComplete, createActivity, updateActivity } = useActivities();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<any>(null);

    if (loading && activities.length === 0) {
        return <div className="p-4 text-center text-slate-400 font-medium">Cargando actividades...</div>;
    }

    return (
        <div className="pt-4 space-y-3">
            <div className="flex justify-between items-center mb-4 px-1">
                <h3 className="text-sm font-bold text-slate-900">Actividades Vinculadas</h3>
                <button 
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors border border-blue-100"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Nueva Actividad
                </button>
            </div>

            {activities.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <ListTodo className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No hay actividades vinculadas a esta cuenta.</p>
                </div>
            ) : (
                <div className="grid gap-2">
                    {activities.map(act => {
                        const actDate = new Date(act.fecha_inicio);
                        actDate.setHours(0, 0, 0, 0);
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const isOverdue = !act.is_completed && actDate < today;

                        return (
                            <div 
                                key={act.id} 
                                onClick={() => setSelectedActivity(act)}
                                className={cn(
                                    "bg-white p-3 rounded-xl border transition-all flex items-start gap-3 shadow-sm cursor-pointer",
                                    act.is_completed 
                                        ? "border-slate-100 opacity-75"
                                        : isOverdue 
                                            ? "border-red-200 bg-red-50/30"
                                            : "border-slate-200 hover:border-blue-300"
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleComplete(act.id, !act.is_completed);
                                    }}
                                    className="mt-0.5 transition-colors shrink-0"
                                >
                                    {act.is_completed ? (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    ) : isOverdue ? (
                                        <div className="w-5 h-5 flex items-center justify-center">
                                            <Circle className="w-5 h-5 text-red-500" />
                                        </div>
                                    ) : (
                                        <Circle className="w-5 h-5 text-slate-300 hover:text-blue-400" />
                                    )}
                                </button>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-2">
                                        <h4 className={cn(
                                            "font-bold text-sm truncate",
                                            act.is_completed ? "text-slate-500 line-through" : isOverdue ? "text-red-700" : "text-slate-800"
                                        )}>
                                            {act.asunto}
                                        </h4>
                                        
                                        {act.tipo_actividad === 'EVENTO' ? (
                                            <div className={cn(
                                                "flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0",
                                                isOverdue ? "text-red-600 bg-red-100" : "text-blue-600 bg-blue-50"
                                            )}>
                                                <Clock className="w-3 h-3" />
                                                {new Date(act.fecha_inicio).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                            </div>
                                        ) : (
                                            <div className={cn(
                                                "flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0",
                                                isOverdue ? "text-red-600 bg-red-100" : "text-emerald-600 bg-emerald-50"
                                            )}>
                                                <ListTodo className="w-3 h-3" />
                                                Tarea
                                            </div>
                                        )}
                                    </div>
                                    
                                    {act.descripcion && (
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">{act.descripcion}</p>
                                    )}

                                    <div className="mt-2 flex items-center gap-2">
                                        {act.opportunity?.nombre && (
                                            <div className="flex items-center gap-1 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-bold truncate max-w-[150px]">
                                                <Briefcase className="w-2.5 h-2.5 shrink-0" />
                                                <span className="truncate">{act.opportunity.nombre}</span>
                                            </div>
                                        )}
                                        {act.user?.full_name && (
                                            <div className="text-[10px] text-slate-400 font-medium ml-auto">
                                                {act.user.full_name}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    
                    {hasMore && (
                        <div className="flex justify-center pt-2">
                            <button
                                type="button"
                                onClick={() => loadMore()}
                                className="text-xs font-bold text-blue-600 hover:text-blue-800 py-1"
                            >
                                Cargar más
                            </button>
                        </div>
                    )}
                </div>
            )}

            {(isCreateModalOpen || selectedActivity) && (
                <CreateActivityModal
                    initialAccountId={accountId}
                    initialData={selectedActivity}
                    onClose={() => {
                        setIsCreateModalOpen(false);
                        setSelectedActivity(null);
                        refresh();
                    }}
                    onSubmit={async (data: any) => {
                        if (selectedActivity) {
                            await updateActivity(selectedActivity.id, data);
                        } else {
                            await createActivity(data);
                        }
                        setIsCreateModalOpen(false);
                        setSelectedActivity(null);
                        refresh();
                    }}
                />
            )}
        </div>
    );
}
