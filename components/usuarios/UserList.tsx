"use client";

import React, { useState } from 'react';
import { useUsers, User } from '@/lib/hooks/useUsers';
import { UserRole } from '@/lib/hooks/useCurrentUser';
import { UserForm } from '@/components/usuarios/UserForm';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Search, UserPlus, Edit, Power, Shield, Users as UsersIcon } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { includesNormalized } from '@/lib/utils';
import { SALES_CHANNELS } from '@/lib/salesChannels';

const ROLE_LABELS: Record<UserRole, string> = {
    ADMIN: 'Administrador',
    COORDINADOR: 'Coordinador',
    VENDEDOR: 'Vendedor',
};

const ROLE_COLORS: Record<UserRole, string> = {
    ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
    COORDINADOR: 'bg-blue-100 text-blue-800 border-blue-200',
    VENDEDOR: 'bg-green-100 text-green-800 border-green-200',
};

export function UserList() {
    const { users, isLoading, error, toggleUserStatus, fetchUsers } = useUsers();
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
    const [showUserForm, setShowUserForm] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [confirmAction, setConfirmAction] = useState<{
        show: boolean;
        user: User | null;
        action: 'activate' | 'deactivate' | null;
    }>({ show: false, user: null, action: null });

    // Filter users
    const filteredUsers = users.filter(user => {
        const matchesSearch =
            !searchTerm.trim() ||
            includesNormalized(user.email, searchTerm) ||
            includesNormalized(user.full_name, searchTerm);

        const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;

        return matchesSearch && matchesRole;
    });

    const handleToggleStatus = async () => {
        if (!confirmAction.user) return;

        const newStatus = confirmAction.action === 'activate';
        const result = await toggleUserStatus(confirmAction.user.id, newStatus);

        if (result.success) {
            setConfirmAction({ show: false, user: null, action: null });
        } else {
            alert(result.error || 'Error al cambiar estado del usuario');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-slate-500">Cargando usuarios...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-red-600">Error: {error}</div>
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestión de Usuarios</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Administra todos los usuarios del sistema CRM
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingUser(null);
                        setShowUserForm(true);
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#254153] text-white rounded-xl hover:bg-[#1a2f3d] transition-all font-semibold shadow-sm active:scale-[0.98]"
                >
                    <UserPlus className="w-4 h-4" />
                    Crear Usuario
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex-1 relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#254153]/10 focus:border-[#254153] transition-all"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as UserRole | 'ALL')}
                    className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#254153]/10 focus:border-[#254153] transition-all text-slate-700"
                >
                    <option value="ALL">Todos los roles</option>
                    <option value="ADMIN">Administrador</option>
                    <option value="COORDINADOR">Coordinador</option>
                    <option value="VENDEDOR">Vendedor</option>
                </select>
            </div>

            {/* User Count */}
            <div className="flex items-center gap-2 text-sm text-slate-600 px-1">
                <UsersIcon className="w-4 h-4 text-slate-400" />
                <span>{filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''}</span>
            </div>

            {filteredUsers.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 text-center py-12 text-slate-500 shadow-sm">
                    No se encontraron usuarios
                </div>
            ) : (
                <>
                    {/* VISTA MÓVIL: Tarjetas */}
                    <div className="grid grid-cols-1 gap-3 md:hidden">
                        {filteredUsers.map((user) => (
                            <div key={user.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-4 gap-3">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-900 text-sm truncate">
                                            {user.full_name || 'Sin nombre'}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate">{user.email}</div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <span className={cn(
                                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap",
                                            ROLE_COLORS[user.role]
                                        )}>
                                            <Shield className="w-3 h-3" />
                                            {ROLE_LABELS[user.role]}
                                        </span>
                                        <span className={cn(
                                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap",
                                            user.is_active
                                                ? "bg-green-100 text-green-800"
                                                : "bg-gray-100 text-gray-800"
                                        )}>
                                            <Power className="w-2.5 h-2.5" />
                                            {user.is_active ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>
                                </div>

                                {user.canales && user.canales.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-full mb-0.5">Canales:</span>
                                        {user.canales.map(ch => (
                                            <span key={ch} className="inline-block px-2 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded-md font-medium border border-slate-200">
                                                {SALES_CHANNELS.find(sc => sc.id === ch)?.nombre || ch}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs text-slate-500">
                                    <span>Creado: {new Date(user.created_at).toLocaleDateString('es-ES')}</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setEditingUser(user);
                                                setShowUserForm(true);
                                            }}
                                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
                                        >
                                            <Edit className="w-3.5 h-3.5" />
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => {
                                                setConfirmAction({
                                                    show: true,
                                                    user,
                                                    action: user.is_active ? 'deactivate' : 'activate'
                                                });
                                            }}
                                            className={cn(
                                                "px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors",
                                                user.is_active
                                                    ? "text-red-700 bg-red-50 hover:bg-red-100"
                                                    : "text-green-700 bg-green-50 hover:bg-green-100"
                                            )}
                                        >
                                            <Power className="w-3.5 h-3.5" />
                                            {user.is_active ? 'Desactivar' : 'Activar'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* VISTA DESKTOP: Tabla */}
                    <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-sm">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Usuario
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Rol
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Estado
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Fecha de Creación
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900">
                                                    {user.full_name || 'Sin nombre'}
                                                </span>
                                                <span className="text-sm text-slate-500">{user.email}</span>
                                                {user.canales && user.canales.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {user.canales.map(ch => (
                                                            <span key={ch} className="inline-block px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600 rounded font-medium border border-slate-200">
                                                                {SALES_CHANNELS.find(sc => sc.id === ch)?.nombre || ch}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border",
                                                ROLE_COLORS[user.role]
                                            )}>
                                                <Shield className="w-3 h-3" />
                                                {ROLE_LABELS[user.role]}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold",
                                                user.is_active
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-gray-100 text-gray-800"
                                            )}>
                                                <Power className="w-3 h-3" />
                                                {user.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {new Date(user.created_at).toLocaleDateString('es-ES')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingUser(user);
                                                        setShowUserForm(true);
                                                    }}
                                                    className="p-2 text-slate-600 hover:text-[#254153] hover:bg-slate-100 rounded-lg transition-colors"
                                                    title="Editar usuario"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setConfirmAction({
                                                            show: true,
                                                            user,
                                                            action: user.is_active ? 'deactivate' : 'activate'
                                                        });
                                                    }}
                                                    className={cn(
                                                        "p-2 rounded-lg transition-colors",
                                                        user.is_active
                                                            ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            : "text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    )}
                                                    title={user.is_active ? 'Desactivar usuario' : 'Activar usuario'}
                                                >
                                                    <Power className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* User Form Modal */}
            {showUserForm && (
                <UserForm
                    user={editingUser}
                    onClose={() => {
                        setShowUserForm(false);
                        setEditingUser(null);
                    }}
                    onSuccess={() => {
                        setShowUserForm(false);
                        setEditingUser(null);
                        fetchUsers();
                    }}
                />
            )}

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={confirmAction.show}
                onClose={() => setConfirmAction({ show: false, user: null, action: null })}
                onConfirm={handleToggleStatus}
                title={confirmAction.action === 'activate' ? 'Activar Usuario' : 'Desactivar Usuario'}
                message={
                    confirmAction.action === 'activate'
                        ? `¿Estás seguro de que deseas activar a ${confirmAction.user?.full_name || confirmAction.user?.email}?`
                        : `¿Estás seguro de que deseas desactivar a ${confirmAction.user?.full_name || confirmAction.user?.email}? El usuario no podrá acceder al sistema.`
                }
                confirmLabel={confirmAction.action === 'activate' ? 'Activar' : 'Desactivar'}
                variant={'danger'}
            />
        </div>
    );
}
