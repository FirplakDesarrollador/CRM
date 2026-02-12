"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { NotificationRule } from "@/lib/types/notifications";
import { RuleForm } from "@/components/notifications/RuleForm";
import { RuleList } from "@/components/notifications/RuleList";
import { Bell, Plus, ArrowLeft, Settings, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useConfig } from "@/lib/hooks/useConfig";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { Dispatch, SetStateAction } from 'react';

export default function NotificationsPage() {
    const router = useRouter();
    const { role } = useCurrentUser();
    const [rules, setRules] = useState<NotificationRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [currentRule, setCurrentRule] = useState<NotificationRule | undefined>(undefined);
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => { },
    });

    const fetchRules = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('CRM_NotificationRules')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching rules:', error);
        } else {
            setRules(data as NotificationRule[]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchRules();
    }, []);

    const handleEdit = (rule: NotificationRule) => {
        setCurrentRule(rule);
        setIsEditing(true);
    };

    const handleCreate = () => {
        setCurrentRule(undefined);
        setIsEditing(true);
    };

    const handleClose = () => {
        setIsEditing(false);
        setCurrentRule(undefined);
    };

    const handleSave = () => {
        handleClose();
        fetchRules();
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-10">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-3 rounded-2xl shadow-sm text-blue-600">
                            <Bell className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Reglas de Notificación</h1>
                            <p className="text-slate-500">Configura cuándo y cómo se envían las alertas</p>
                        </div>
                    </div>
                    <div className="ml-auto">
                        {(role === 'ADMIN' || role === 'COORDINADOR') && (
                            <button
                                onClick={handleCreate}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
                            >
                                <Plus className="w-5 h-5" />
                                Nueva Regla
                            </button>
                        )}
                    </div>
                </div>

                {isEditing ? (
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-in slide-in-from-bottom-5 duration-300">
                        <h2 className="text-xl font-bold text-slate-900 mb-6">
                            {currentRule ? 'Editar Regla' : 'Nueva Regla'}
                        </h2>
                        <RuleForm
                            existingRule={currentRule}
                            onSave={handleSave}
                            onCancel={handleClose}
                        />
                    </div>
                ) : (
                    <>
                        {isLoading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                            </div>
                        ) : (
                            <RuleList
                                rules={rules}
                                onEdit={handleEdit}
                                onRefresh={fetchRules}
                            />
                        )}
                    </>
                )}

                {(role === 'ADMIN' || role === 'COORDINADOR') && (
                    <div className="pt-8 border-t border-slate-200">
                        <AdminSettings setModalConfig={setModalConfig as any} />
                    </div>
                )}
            </div>

            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={modalConfig.onConfirm}
                title={modalConfig.title}
                message={modalConfig.message}
                confirmLabel="Aceptar"
                variant="info"
            />
        </div>
    );
}

function AdminSettings({ setModalConfig }: { setModalConfig: Dispatch<SetStateAction<any>> }) {
    const { config, isAdmin, updateConfig, isLoading } = useConfig();
    const [minValue, setMinValue] = useState("");
    const [minInactiveDays, setMinInactiveDays] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (config.min_premium_order_value) {
            setMinValue(config.min_premium_order_value);
        }
        if (config.inactive_account_days) {
            setMinInactiveDays(config.inactive_account_days);
        } else {
            setMinInactiveDays('90'); // default
        }
    }, [config]);

    if (isLoading) return null;
    if (!isAdmin) return null;

    const handleSave = async () => {
        setIsSaving(true);
        const p1 = updateConfig('min_premium_order_value', minValue);
        const p2 = updateConfig('inactive_account_days', minInactiveDays);
        await Promise.all([p1, p2]);
        setModalConfig({
            isOpen: true,
            title: "Configuración Guardada",
            message: "Los parámetros globales han sido actualizados correctamente.",
            onConfirm: () => setModalConfig((prev: any) => ({ ...prev, isOpen: false })),
        });
        setIsSaving(false);
    };

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
            <div className="flex items-center gap-2">
                <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                    <Settings className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 text-lg">Configuración de Administrador</h3>
                    <p className="text-sm text-slate-500">Parámetros globales del sistema</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        Pedido Mínimo Cliente Premium (COP)
                    </label>
                    <p className="text-xs text-slate-500 mb-3">
                        Valor mínimo requerido en cotizaciones para clientes marcados como Premium.
                    </p>
                    <input
                        type="number"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 mb-2"
                        value={minValue}
                        onChange={(e) => setMinValue(e.target.value)}
                    />
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        Alerta Inactividad Cliente (Días)
                    </label>
                    <p className="text-xs text-slate-500 mb-3">
                        Días sin interacción para considerar un cliente como inactivo y generar alerta.
                    </p>
                    <input
                        type="number"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 mb-2"
                        value={minInactiveDays}
                        onChange={(e) => setMinInactiveDays(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-purple-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-purple-700 disabled:opacity-50 shadow-md shadow-purple-200 flex items-center gap-2"
                >
                    {isSaving ? (
                        <>Guardando...</>
                    ) : (
                        <>
                            <CheckCircle2 className="w-4 h-4" />
                            Guardar Cambios
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
