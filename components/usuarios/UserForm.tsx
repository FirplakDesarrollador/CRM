"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUsers, User, CreateUserData, UpdateUserData } from '@/lib/hooks/useUsers';
import { UserRole } from '@/lib/hooks/useCurrentUser';
import { X, Loader2 } from 'lucide-react';

const userSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
    full_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    role: z.enum(['ADMIN', 'COORDINADOR', 'VENDEDOR']),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserFormProps {
    user: User | null;
    onClose: () => void;
    onSuccess: () => void;
}

export function UserForm({ user, onClose, onSuccess }: UserFormProps) {
    const { createUser, updateUser } = useUsers();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<UserFormData>({
        resolver: zodResolver(userSchema),
        defaultValues: user ? {
            email: user.email,
            full_name: user.full_name || '',
            role: user.role,
        } : {
            role: 'VENDEDOR',
        },
    });

    const onSubmit = async (data: UserFormData) => {
        setIsSubmitting(true);
        setError(null);

        try {
            if (user) {
                // Update existing user
                const updates: UpdateUserData = {
                    full_name: data.full_name,
                    role: data.role,
                };

                const result = await updateUser(user.id, updates);

                if (!result.success) {
                    setError(result.error || 'Error al actualizar usuario');
                    return;
                }
            } else {
                // Create new user
                if (!data.password) {
                    setError('La contraseña es requerida para crear un usuario');
                    return;
                }

                const createData: CreateUserData = {
                    email: data.email,
                    password: data.password,
                    full_name: data.full_name,
                    role: data.role,
                };

                const result = await createUser(createData);

                if (!result.success) {
                    setError(result.error || 'Error al crear usuario');
                    return;
                }
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Error inesperado');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-900">
                        {user ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                            {error}
                        </div>
                    )}

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Email Corporativo
                        </label>
                        <input
                            type="email"
                            {...register('email')}
                            disabled={!!user} // Can't change email for existing users
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#254153] focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
                            placeholder="usuario@firplak.com"
                        />
                        {errors.email && (
                            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                        )}
                    </div>

                    {/* Password (only for new users) */}
                    {!user && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Contraseña
                            </label>
                            <input
                                type="password"
                                {...register('password')}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#254153] focus:border-transparent"
                                placeholder="Mínimo 6 caracteres"
                            />
                            {errors.password && (
                                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                            )}
                        </div>
                    )}

                    {/* Full Name */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Nombre Completo
                        </label>
                        <input
                            type="text"
                            {...register('full_name')}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#254153] focus:border-transparent"
                            placeholder="Juan Pérez"
                        />
                        {errors.full_name && (
                            <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
                        )}
                    </div>

                    {/* Role */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Rol
                        </label>
                        <select
                            {...register('role')}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#254153] focus:border-transparent"
                        >
                            <option value="VENDEDOR">Vendedor</option>
                            <option value="COORDINADOR">Coordinador</option>
                            <option value="ADMIN">Administrador</option>
                        </select>
                        {errors.role && (
                            <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
                        )}
                        <p className="mt-1 text-xs text-slate-500">
                            Define los permisos y accesos del usuario en el sistema
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 bg-[#254153] text-white rounded-lg hover:bg-[#1a2f3d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            {user ? 'Guardar Cambios' : 'Crear Usuario'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
