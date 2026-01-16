"use client";

import { useState } from 'react';
import { useUsers, CRMUser } from '@/lib/hooks/useUsers';
import { useSyncStore } from '@/lib/stores/useSyncStore';
import {
    Users,
    Search,
    Shield,
    ShieldAlert,
    UserCheck,
    UserX,
    MoreVertical,
    Save,
    RotateCcw
} from 'lucide-react';
import { cn } from '@/components/ui/utils';

export default function UsersPage() {
    const { users, loading, error, updateUser, fetchUsers } = useUsers();
    const { userRole } = useSyncStore();
    const [searchTerm, setSearchTerm] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<CRMUser>>({});

    // Authorization Check
    if (userRole !== 'ADMIN' && !loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
                <ShieldAlert className="w-16 h-16 mb-4 text-red-500 opacity-50" />
                <h2 className="text-xl font-bold text-slate-900">Acceso Restringido</h2>
                <p>No tienes permisos para ver esta página.</p>
            </div>
        );
    }

    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.full_name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleEdit = (user: CRMUser) => {
        setEditingId(user.id);
        setEditForm({ role: user.role, is_active: user.is_active });
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditForm({});
    };

    const handleSave = async (id: string) => {
        await updateUser(id, editForm);
        setEditingId(null);
        setEditForm({});
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-xl">
                        <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Gestión de Usuarios</h1>
                        <p className="text-sm text-slate-500">Administra roles y permisos del equipo</p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar por nombre o email..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-semibold text-xs">
                            <tr>
                                <th className="px-6 py-4">Usuario</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Rol</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [1, 2, 3].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-32"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-16"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-12"></div></td>
                                        <td className="px-6 py-4"></td>
                                    </tr>
                                ))
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        No se encontraron usuarios
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map(user => {
                                    const isEditing = editingId === user.id;

                                    return (
                                        <tr key={user.id} className={cn(
                                            "hover:bg-slate-50/50 transition-colors",
                                            isEditing ? "bg-blue-50/30" : ""
                                        )}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                                                        {(user.full_name || user.email).substring(0, 2)}
                                                    </div>
                                                    <span className="font-medium text-slate-900">
                                                        {user.full_name || "Sin nombre"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                                                {user.email}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <select
                                                        className="px-2 py-1 rounded border border-blue-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        value={editForm.role}
                                                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                                    >
                                                        <option value="VENDEDOR">Vendedor</option>
                                                        <option value="ADMIN">Administrador</option>
                                                        <option value="GERENTE">Gerente</option>
                                                        <option value="EDITOR">Editor</option>
                                                        <option value="SOPORTE">Soporte</option>
                                                    </select>
                                                ) : (
                                                    <span className={cn(
                                                        "px-2 py-1 rounded text-xs font-bold uppercase",
                                                        user.role === 'ADMIN' ? "bg-purple-100 text-purple-700" :
                                                            user.role === 'GERENTE' ? "bg-indigo-100 text-indigo-700" :
                                                                "bg-blue-100 text-blue-700"
                                                    )}>
                                                        {user.role}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <button
                                                        onClick={() => setEditForm(prev => ({ ...prev, is_active: !prev.is_active }))}
                                                        className={cn(
                                                            "px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors",
                                                            editForm.is_active
                                                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                                                : "bg-red-100 text-red-700 hover:bg-red-200"
                                                        )}
                                                    >
                                                        {editForm.is_active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                                                        {editForm.is_active ? "Activo" : "Inactivo"}
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn(
                                                            "w-2 h-2 rounded-full",
                                                            user.is_active ? "bg-green-500" : "bg-red-500"
                                                        )} />
                                                        <span className={cn(
                                                            "text-xs font-medium",
                                                            user.is_active ? "text-green-700" : "text-red-700"
                                                        )}>
                                                            {user.is_active ? "Activo" : "Inactivo"}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {isEditing ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleSave(user.id)}
                                                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                                            title="Guardar"
                                                        >
                                                            <Save className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={handleCancel}
                                                            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"
                                                            title="Cancelar"
                                                        >
                                                            <RotateCcw className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleEdit(user)}
                                                        className="text-slate-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition-colors"
                                                        title="Editar"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
