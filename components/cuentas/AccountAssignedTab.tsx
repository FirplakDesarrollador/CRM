import { useState, useEffect } from "react";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { Loader2, User, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface AccountAssignedTabProps {
    accountId: string;
    currentOwnerId: string | null;
}

interface User {
    id: string;
    full_name: string;
    email: string;
    role: string;
}

export function AccountAssignedTab({ accountId, currentOwnerId }: AccountAssignedTabProps) {
    const { updateAccount } = useAccounts();
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>(currentOwnerId || "");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const { data, error } = await supabase
                    .from('CRM_Usuarios')
                    .select('id, full_name, email, role')
                    .eq('is_active', true)
                    .order('full_name');

                if (error) throw error;
                if (data) setUsers(data);
            } catch (error) {
                console.error("Error fetching users:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUsers();
    }, []);

    useEffect(() => {
        if (currentOwnerId) {
            setSelectedUserId(currentOwnerId);
        }
    }, [currentOwnerId]);

    const handleAssign = async () => {
        if (!selectedUserId) return;

        setIsSaving(true);
        setSuccessMessage(null);

        try {
            // Accounts now use 'owner_user_id' as the owner field
            await updateAccount(accountId, { owner_user_id: selectedUserId });
            setSuccessMessage("Cuenta reasignada correctamente.");
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error) {
            console.error("Error assigning account:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const selectedUser = users.find(u => u.id === selectedUserId);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                        <User className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 text-lg">Reasignar Cuenta</h3>
                        <p className="text-xs text-slate-500">Cambiar el propietario de esta cuenta</p>
                    </div>
                </div>

                <div className="max-w-md space-y-4">
                    <div>
                        <label className="text-sm font-bold text-slate-700 block mb-2">Comercial Asignado</label>
                        <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none"
                        >
                            <option value="">Seleccionar usuario...</option>
                            {users.map(user => (
                                <option key={user.id} value={user.id}>
                                    {user.full_name || user.email} ({user.role})
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedUser && (
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Detalles del Propietario</p>
                            <p className="text-sm font-bold text-slate-900">{selectedUser.full_name}</p>
                            <p className="text-xs text-slate-500">{selectedUser.email}</p>
                            <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">
                                {selectedUser.role}
                            </span>
                        </div>
                    )}

                    <button
                        onClick={handleAssign}
                        disabled={isSaving || !selectedUserId || selectedUserId === currentOwnerId}
                        className={cn(
                            "w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
                            isSaving || !selectedUserId || selectedUserId === currentOwnerId
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                : "bg-purple-600 text-white hover:bg-purple-700 shadow-sm hover:shadow-md"
                        )}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                Confirmar Reasignación
                            </>
                        )}
                    </button>

                    {successMessage && (
                        <div className="p-3 bg-green-50 text-green-700 text-sm font-medium rounded-xl flex items-center gap-2">
                            <Check className="w-4 h-4" />
                            {successMessage}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
