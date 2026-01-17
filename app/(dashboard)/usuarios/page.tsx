"use client";

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { UserList } from '@/components/usuarios/UserList';

export default function UsuariosPage() {
    return (
        <PermissionGuard
            permission="manage_users"
            fallback={
                <div className="flex items-center justify-center h-screen">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">
                            Acceso Denegado
                        </h1>
                        <p className="text-slate-600">
                            No tienes permisos para acceder a este módulo.
                        </p>
                    </div>
                </div>
            }
        >
            <div className="p-6">
                <UserList />
            </div>
        </PermissionGuard>
    );
}
