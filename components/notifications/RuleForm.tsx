import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { NotificationRule, NotificationType, NotificationChannel, NotificationRecipient } from '@/lib/types/notifications';
import { Loader2, Save, X, Activity, UserPlus, FilePlus, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface RuleFormProps {
    existingRule?: NotificationRule;
    onSave: () => void;
    onCancel: () => void;
}

const RULE_TYPES: { id: NotificationType, label: string, icon: any }[] = [
    { id: 'INACTIVE_CLIENT', label: 'Cliente Inactivo', icon: Activity },
    { id: 'ACTIVITY_OVERDUE', label: 'Actividad Vencida', icon: AlertCircle },
    { id: 'NEW_ACCOUNT', label: 'Nueva Cuenta Asignada', icon: UserPlus },
    { id: 'NEW_OPPORTUNITY', label: 'Nueva Oportunidad Asignada', icon: FilePlus },
    { id: 'BUDGET_MISS', label: 'Fallo de Presupuesto', icon: AlertCircle },
];

const CHANNELS: { id: NotificationChannel, label: string }[] = [
    { id: 'APP', label: 'Aplicación (Campana)' },
    { id: 'EMAIL', label: 'Correo Electrónico' },
    { id: 'TEAMS', label: 'Microsoft Teams' },
];

export function RuleForm({ existingRule, onSave, onCancel }: RuleFormProps) {
    const [name, setName] = useState(existingRule?.name || '');
    const [type, setType] = useState<NotificationType>(existingRule?.type || 'INACTIVE_CLIENT');
    const [config, setConfig] = useState<any>(existingRule?.config || {});
    const [recipients, setRecipients] = useState<NotificationRecipient[]>(existingRule?.recipients || ['SELLER']);
    const [channels, setChannels] = useState<NotificationChannel[]>(existingRule?.channels || ['APP']);
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        const ruleData = {
            name,
            type,
            config,
            recipients,
            channels,
            is_active: existingRule ? existingRule.is_active : true
        };

        let error;
        if (existingRule) {
            const { error: err } = await supabase
                .from('CRM_NotificationRules')
                .update(ruleData)
                .eq('id', existingRule.id);
            error = err;
        } else {
            const { error: err } = await supabase
                .from('CRM_NotificationRules')
                .insert([ruleData]);
            error = err;
        }

        setIsSaving(false);
        if (error) {
            console.error('Error saving rule:', error);
            alert('Error al guardar la regla');
        } else {
            onSave();
        }
    };

    const toggleChannel = (channel: NotificationChannel) => {
        if (channels.includes(channel)) {
            setChannels(channels.filter(c => c !== channel));
        } else {
            setChannels([...channels, channel]);
        }
    };

    const toggleRecipient = (recipient: NotificationRecipient) => {
        if (recipients.includes(recipient)) {
            // Prevent removing the last recipient if desired, or just allow empty
            setRecipients(recipients.filter(r => r !== recipient));
        } else {
            setRecipients([...recipients, recipient]);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <Label>Nombre de la Regla</Label>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Notificar inactividad > 90 días"
                    required
                    className="mt-1"
                />
            </div>

            {!existingRule && (
                <div>
                    <Label className="mb-2 block">Tipo de Evento</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {RULE_TYPES.map(rt => (
                            <div
                                key={rt.id}
                                onClick={() => setType(rt.id)}
                                className={cn(
                                    "cursor-pointer p-3 rounded-xl border flex items-center gap-3 transition-all",
                                    type === rt.id
                                        ? "bg-blue-50 border-blue-200 ring-1 ring-blue-500"
                                        : "bg-white border-slate-200 hover:bg-slate-50"
                                )}
                            >
                                <div className={cn(
                                    "p-2 rounded-lg",
                                    type === rt.id ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
                                )}>
                                    <rt.icon className="w-5 h-5" />
                                </div>
                                <span className={cn(
                                    "text-sm font-medium",
                                    type === rt.id ? "text-blue-900" : "text-slate-700"
                                )}>{rt.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}


            {/* Dynamic Config Fields */}
            {type === 'INACTIVE_CLIENT' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <Label>Días de Inactividad</Label>
                    <p className="text-xs text-slate-500 mb-2">Notificar cuando un cliente no tenga interacción en:</p>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            min="1"
                            value={config.days || 90}
                            onChange={(e) => setConfig({ ...config, days: parseInt(e.target.value) })}
                            className="w-32"
                        />
                        <span className="text-sm font-medium text-slate-600">días</span>
                    </div>
                </div>
            )}

            {type === 'ACTIVITY_OVERDUE' && (
                <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                    <Label>Días después del vencimiento</Label>
                    <p className="text-xs text-slate-500 mb-2">Notificar cuando una actividad no se complete después de:</p>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            min="0"
                            value={config.days || 1}
                            onChange={(e) => setConfig({ ...config, days: parseInt(e.target.value) })}
                            className="w-32"
                        />
                        <span className="text-sm font-medium text-slate-600">días de vencimiento</span>
                    </div>
                    <p className="text-xs text-red-600 mt-2">
                        💡 Con 0 días se notifica el mismo día del vencimiento
                    </p>
                </div>
            )}

            {type === 'BUDGET_MISS' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div>
                        <Label>Monto Objetivo</Label>
                        <Input
                            type="number"
                            value={config.amount || ''}
                            onChange={(e) => setConfig({ ...config, amount: Number(e.target.value) })}
                            className="mt-1"
                            placeholder="0"
                        />
                    </div>
                    <div>
                        <Label>Fecha Límite</Label>
                        <Input
                            type="date"
                            value={config.date || ''}
                            onChange={(e) => setConfig({ ...config, date: e.target.value })}
                            className="mt-1"
                        />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Recipients */}
                <div>
                    <Label className="mb-2 block">Notificar a:</Label>
                    <div className="space-y-2">
                        <div
                            onClick={() => toggleRecipient('SELLER')}
                            className={cn(
                                "cursor-pointer p-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-between",
                                recipients.includes('SELLER')
                                    ? "bg-purple-50 border-purple-200 text-purple-900"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            Vendedor Asignado
                            {recipients.includes('SELLER') && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                        </div>
                        <div
                            onClick={() => toggleRecipient('COORDINATOR')}
                            className={cn(
                                "cursor-pointer p-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-between",
                                recipients.includes('COORDINATOR')
                                    ? "bg-purple-50 border-purple-200 text-purple-900"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            Coordinador / Gerente
                            {recipients.includes('COORDINATOR') && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                        </div>
                    </div>
                </div>

                {/* Channels */}
                <div>
                    <Label className="mb-2 block">Canales de envío:</Label>
                    <div className="space-y-2">
                        {CHANNELS.map(ch => (
                            <div
                                key={ch.id}
                                onClick={() => toggleChannel(ch.id)}
                                className={cn(
                                    "cursor-pointer p-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-between",
                                    channels.includes(ch.id)
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                {ch.label}
                                {channels.includes(ch.id) && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={isSaving || !name}
                    className={cn(
                        "px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-blue-700 transition-all flex items-center gap-2",
                        (isSaving || !name) && "opacity-50 cursor-not-allowed"
                    )}
                >
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Guardar Regla
                </button>
            </div>
        </form>
    );
}
