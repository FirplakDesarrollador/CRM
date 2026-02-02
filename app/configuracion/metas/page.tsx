"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
    ChevronLeft,
    Search,
    User,
    Target,
    Plus,
    TrendingUp,
    BarChart3,
    MoreHorizontal,
    Trash2,
    CheckCircle2,
    XCircle,
    Clock,
    Flag
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { GoalsConfigModal } from "@/components/config/GoalsConfigModal";
import { OpportunityQuickView } from "@/components/opportunities/OpportunityQuickView";
import { GoalDetailModal } from "@/components/config/GoalDetailModal";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";

// Types
interface UserItem {
    id: string;
    full_name: string;
    email: string;
    role: string;
    avatar_url?: string;
}

interface GoalItem {
    id: string;
    description: string;
    goal_type: string;
    target_value: number;
    status: string;
    created_at: string;
    due_date?: string;
    opportunity?: {
        id: string;
        nombre: string;
    };
}

export default function GoalsManagerPage() {
    const router = useRouter();
    const { isAdmin } = useCurrentUser(); // Get permission
    const [users, setUsers] = useState<UserItem[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
    const [userGoals, setUserGoals] = useState<GoalItem[]>([]);

    // UI States
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [isLoadingGoals, setIsLoadingGoals] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
    const [quickViewOppId, setQuickViewOppId] = useState("");

    // Detail Modal State
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedGoalId, setSelectedGoalId] = useState("");

    // Fetch Users
    useEffect(() => {
        const fetchUsers = async () => {
            setIsLoadingUsers(true);
            const { data, error } = await supabase
                .from('CRM_Usuarios')
                .select('*')
                .eq('is_active', true)
                .order('full_name');

            if (!error && data) {
                setUsers(data);
            }
            setIsLoadingUsers(false);
        };
        fetchUsers();
    }, []);

    // Fetch Goals when User Selected
    useEffect(() => {
        if (selectedUser) {
            fetchUserGoals(selectedUser.id);
        } else {
            setUserGoals([]);
        }
    }, [selectedUser]);

    const fetchUserGoals = async (userId: string) => {
        setIsLoadingGoals(true);
        const { data, error } = await supabase
            .from('CRM_Metas')
            .select(`
                *,
                opportunity:CRM_Oportunidades(id, nombre)
            `)
            .eq('user_id', userId)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setUserGoals(data as any);
        }
        setIsLoadingGoals(false);
    };

    const deleteGoal = async (goalId: string) => {
        if (!confirm("¿Eliminar esta meta?")) return;

        const { error } = await supabase
            .from('CRM_Metas')
            .update({ is_deleted: true })
            .eq('id', goalId);

        if (!error && selectedUser) {
            fetchUserGoals(selectedUser.id);
        }
    };

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Top Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Target className="w-5 h-5 text-indigo-600" />
                            Gestión de Metas
                        </h1>
                        <p className="text-sm text-slate-500">Asigna y monitorea objetivos por asesor</p>
                    </div>
                </div>
            </div>

            {/* Main Content - Master Detail Layout */}
            <div className="flex-1 max-w-[1600px] w-full mx-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6 h-[calc(100vh-80px)]">

                {/* LEFT: User List */}
                <div className="md:col-span-4 lg:col-span-3 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-full">
                    <div className="p-4 border-b border-slate-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar asesor..."
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border-none font-medium text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {isLoadingUsers ? (
                            <div className="p-8 text-center text-slate-400 text-sm">Cargando asesores...</div>
                        ) : (
                            filteredUsers.map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => setSelectedUser(user)}
                                    className={cn(
                                        "w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-all",
                                        selectedUser?.id === user.id
                                            ? "bg-indigo-50 ring-1 ring-indigo-200 shadow-sm"
                                            : "hover:bg-slate-50"
                                    )}
                                >
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2",
                                        selectedUser?.id === user.id ? "bg-indigo-100 text-indigo-600 border-indigo-200" : "bg-slate-100 text-slate-500 border-slate-100"
                                    )}>
                                        {user.full_name?.charAt(0) || user.email.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={cn(
                                            "font-bold text-sm truncate",
                                            selectedUser?.id === user.id ? "text-indigo-900" : "text-slate-700"
                                        )}>
                                            {user.full_name || 'Sin Nombre'}
                                        </p>
                                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT: Detail View */}
                <div className="md:col-span-8 lg:col-span-9 flex flex-col h-full bg-slate-50/50">
                    {selectedUser ? (
                        <div className="flex flex-col h-full space-y-6">
                            {/* Detail Header */}
                            <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-500">
                                        {selectedUser.full_name?.charAt(0) || "U"}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900">{selectedUser.full_name}</h2>
                                        <p className="text-slate-500">{selectedUser.email} • {selectedUser.role || 'VENDEDOR'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
                                >
                                    <Plus className="w-5 h-5" />
                                    Crear Meta Nueva
                                </button>
                            </div>

                            {/* Goals Grid */}
                            <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                                <div className="p-6 border-b border-slate-100 font-bold text-slate-900 flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-slate-400" />
                                    Metas Activas ({userGoals.length})
                                </div>
                                <div className="overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {isLoadingGoals ? (
                                        <div className="col-span-full py-12 text-center text-slate-400">Cargando metas...</div>
                                    ) : userGoals.length === 0 ? (
                                        <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                            <Target className="w-12 h-12 mb-3 opacity-20" />
                                            <p className="font-medium">Este usuario no tiene metas asignadas</p>
                                        </div>
                                    ) : (
                                        userGoals.map(goal => (
                                            <div
                                                key={goal.id}
                                                onClick={() => {
                                                    setSelectedGoalId(goal.id);
                                                    setIsDetailModalOpen(true);
                                                }}
                                                className="p-5 rounded-2xl border border-slate-100 bg-slate-50 hover:border-indigo-100 hover:shadow-md transition-all group relative cursor-pointer hover:bg-indigo-50/30"
                                            >
                                                {/* Delete Button - Only for Admin */}
                                                {isAdmin && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Prevent card click
                                                            deleteGoal(goal.id);
                                                        }}
                                                        className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all z-10"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}

                                                <div className="flex items-start gap-4 pr-6">
                                                    <div className={cn(
                                                        "p-3 rounded-xl",
                                                        goal.status === 'Terminado' ? "bg-emerald-100 text-emerald-600" :
                                                            goal.status === 'Fracasada' ? "bg-red-100 text-red-600" :
                                                                "bg-blue-100 text-blue-600"
                                                    )}>
                                                        {goal.goal_type === 'SPECIFIC_OPPORTUNITY' ? <Target className="w-6 h-6" /> :
                                                            goal.goal_type === 'WON_COUNT' ? <TrendingUp className="w-6 h-6" /> :
                                                                <BarChart3 className="w-6 h-6" />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                                                {goal.goal_type.replace('_', ' ')}
                                                            </span>
                                                            <span className={cn(
                                                                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                                                goal.status === 'Terminado' ? "bg-emerald-100 text-emerald-700" :
                                                                    goal.status === 'Fracasada' ? "bg-red-100 text-red-700" :
                                                                        "bg-blue-100 text-blue-700"
                                                            )}>
                                                                {goal.status}
                                                            </span>
                                                        </div>
                                                        <p className="font-medium text-slate-900 leading-snug mb-2">
                                                            {goal.description}
                                                        </p>
                                                        {goal.opportunity && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); // Prevent card click opening detail
                                                                    setQuickViewOppId(goal.opportunity!.id);
                                                                    setIsQuickViewOpen(true);
                                                                }}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all cursor-pointer relative z-20"
                                                            >
                                                                <Target className="w-3 h-3 text-indigo-500" />
                                                                <span className="font-bold underline decoration-dotted">{goal.opportunity.nombre}</span>
                                                            </button>
                                                        )}
                                                        <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                                                            <div className="flex items-center gap-1.5">
                                                                <Clock className="w-3 h-3" />
                                                                Creado: {new Date(goal.created_at).toLocaleDateString()}
                                                            </div>
                                                            {goal.due_date && (
                                                                <div className="flex items-center gap-1.5 text-orange-400 font-medium">
                                                                    <Flag className="w-3 h-3" />
                                                                    Vence: {new Date(goal.due_date).toLocaleDateString()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100/50 rounded-3xl border-2 border-dashed border-slate-200">
                            <User className="w-16 h-16 mb-4 opacity-20" />
                            <h3 className="text-xl font-bold text-slate-500">Selecciona un Asesor</h3>
                            <p>Elige un usuario de la lista izquierda para ver sus metas</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Reuse Existing Modal with improvements */}
            <GoalsConfigModal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    if (selectedUser) fetchUserGoals(selectedUser.id);
                }}
                initialUserId={selectedUser?.id}
            />

            <OpportunityQuickView
                isOpen={isQuickViewOpen}
                onClose={() => setIsQuickViewOpen(false)}
                opportunityId={quickViewOppId}
                onUpdate={() => {
                    // Ideally refresh goals if status changed affecting goal display (rare but possible)
                    if (selectedUser) fetchUserGoals(selectedUser.id);
                }}
            />

            <GoalDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                goalId={selectedGoalId}
                canDelete={!!isAdmin}
                onUpdate={() => {
                    if (selectedUser) fetchUserGoals(selectedUser.id);
                }}
            />
        </div>
    );
}
