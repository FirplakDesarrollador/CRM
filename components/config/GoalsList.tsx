"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Trash2, TrendingUp, User, Target, Calendar } from "lucide-react";
import { cn } from "@/components/ui/utils";

interface Goal {
    id: string;
    description: string;
    goal_type: string;
    target_value: number;
    status: string;
    created_at: string;
    user: {
        full_name: string;
        email: string;
    } | null; // Joined
    opportunity: {
        nombre: string;
    } | null; // Joined
}

export function GoalsList() {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchGoals = async () => {
        setIsLoading(true);
        try {
            // Note: Supabase JS join syntax for 1:1 relationships
            const { data, error } = await supabase
                .from('CRM_Metas')
                .select(`
                    id, 
                    description, 
                    goal_type, 
                    target_value, 
                    status, 
                    created_at,
                    user:CRM_Usuarios(full_name, email),
                    opportunity:CRM_Oportunidades(nombre)
                `)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Transform data to match interface if needed (Supabase returns arrays for joins sometimes depending on setup, but 1:1 should be object)
            // Casting safely
            setGoals((data as any) || []);

        } catch (err) {
            console.error("Error loading goals:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const deleteGoal = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar esta meta?")) return;

        try {
            const { error } = await supabase
                .from('CRM_Metas')
                .update({ is_deleted: true })
                .eq('id', id);

            if (error) throw error;
            fetchGoals(); // Refresh
        } catch (err) {
            console.error("Error deleting goal:", err);
            alert("Error al eliminar");
        }
    };

    useEffect(() => {
        fetchGoals();

        // Listen to realtime changes? Optional. 
        // For simple admin view, relying on manual refresh (or re-mount) is often enough. 
        // Adding a basic subscription or simpler: exposing a refresh method if parent needs it.
        // For now, self-contained.
    }, []);

    if (isLoading) return <div className="p-8 text-center text-slate-400">Cargando metas...</div>;

    if (goals.length === 0) {
        return (
            <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                <Target className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium">No hay metas configuradas aún.</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs font-bold">
                    <tr>
                        <th className="px-6 py-4">Asignado A</th>
                        <th className="px-6 py-4">Tipo / Detalle</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4">Fecha</th>
                        <th className="px-6 py-4">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {goals.map((goal) => (
                        <tr key={goal.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900">{goal.user?.full_name || 'Desconocido'}</p>
                                        <p className="text-xs text-slate-400">{goal.user?.email}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Target className="w-3 h-3 text-slate-400" />
                                        <span className="font-medium text-slate-700">
                                            {goal.goal_type === 'SPECIFIC_OPPORTUNITY' ? 'Oportunidad Específica' :
                                                goal.goal_type === 'WON_COUNT' ? `Ventas Ganadas (${goal.target_value})` :
                                                    goal.goal_type === 'CONTACT_COUNT' ? `Nuevos Contactos (${goal.target_value})` :
                                                        `Oportunidades (${goal.target_value})`}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500">{goal.description}</p>
                                    {goal.opportunity && (
                                        <p className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded inline-block">
                                            Opp: {goal.opportunity.nombre}
                                        </p>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={cn(
                                    "px-2.5 py-1 rounded-full text-xs font-bold",
                                    goal.status === 'Terminado' ? "bg-emerald-100 text-emerald-700" :
                                        goal.status === 'Fracasada' ? "bg-red-100 text-red-700" :
                                            "bg-blue-100 text-blue-700"
                                )}>
                                    {goal.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-slate-400">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(goal.created_at).toLocaleDateString()}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <button
                                    onClick={() => deleteGoal(goal.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Eliminar Meta"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
