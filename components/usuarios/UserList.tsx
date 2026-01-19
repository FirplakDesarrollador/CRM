"use client";

import React, { useState } from 'react';
import { useUsers, User, UpdateUserData } from '@/lib/hooks/useUsers';
import { UserRole } from '@/lib/hooks/useCurrentUser';
import { UserForm } from '@/components/usuarios/UserForm';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Search, UserPlus, Edit, Power, Shield, Users as UsersIcon } from 'lucide-react';
import { cn } from '@/components/ui/utils';

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
    const { users, isLoading, error, updateUserRole, toggleUserStatus, fetchUsers } = useUsers();
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
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.full_name?.toLowerCase().includes(searchTerm.toLowerCase());

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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Gestión de Usuarios</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Administra todos los usuarios del sistema CRM
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingUser(null);
                        setShowUserForm(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#254153] text-white rounded-lg hover:bg-[#1a2f3d] transition-colors"
                >
                    <UserPlus className="w-4 h-4" />
                    Crear Usuario
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-4 items-center bg-white p-4 rounded-lg border border-slate-200">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#254153] focus:border-transparent"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as UserRole | 'ALL')}
                    className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#254153] focus:border-transparent"
                >
                    <option value="ALL">Todos los roles</option>
                    <option value="ADMIN">Administrador</option>
                    <option value="COORDINADOR">Coordinador</option>
                    <option value="VENDEDOR">Vendedor</option>
                </select>
            </div>

            {/* User Count */}
            <div className="flex items-center gap-2 text-sm text-slate-600">
                <UsersIcon className="w-4 h-4" />
                <span>{filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
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

                {filteredUsers.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        No se encontraron usuarios
                    </div>
                )}
            </div>

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
