import { NotificationRule } from '@/lib/types/notifications';
import { Edit2, Trash2, Power, PowerOff, Activity, UserPlus, FilePlus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface RuleListProps {
    rules: NotificationRule[];
    onEdit: (rule: NotificationRule) => void;
    onRefresh: () => void;
}

const ICONS: Record<string, any> = {
    'INACTIVE_CLIENT': Activity,
    'NEW_ACCOUNT': UserPlus,
    'NEW_OPPORTUNITY': FilePlus,
    'BUDGET_MISS': AlertCircle,
};

export function RuleList({ rules, onEdit, onRefresh }: RuleListProps) {

    const toggleActive = async (rule: NotificationRule) => {
        await supabase
            .from('CRM_NotificationRules')
            .update({ is_active: !rule.is_active })
            .eq('id', rule.id);
        onRefresh();
    };

    const deleteRule = async (rule: NotificationRule) => {
        if (!confirm('¿Estás seguro de eliminar esta regla?')) return;
        await supabase
            .from('CRM_NotificationRules')
            .delete()
            .eq('id', rule.id);
        onRefresh();
    };

    if (rules.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-200">
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-slate-900 font-bold text-lg mb-1">Sin Reglas Configuradas</h3>
                <p className="text-slate-500 text-sm">Crea una nueva regla para empezar a recibir notificaciones.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {rules.map((rule) => {
                const Icon = ICONS[rule.type] || AlertCircle;
                return (
                    <div
                        key={rule.id}
                        className={cn(
                            "group flex items-center justify-between p-4 rounded-2xl border transition-all hover:shadow-md",
                            rule.is_active ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100 opacity-75"
                        )}
                    >
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "p-3 rounded-xl",
                                rule.is_active ? "bg-blue-50 text-blue-600" : "bg-slate-200 text-slate-400"
                            )}>
                                <Icon className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className={cn("font-bold text-base", rule.is_active ? "text-slate-900" : "text-slate-500")}>
                                    {rule.name}
                                </h4>
                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                                        {rule.type}
                                    </span>
                                    <span>•</span>
                                    <span>{rule.channels.join(', ')}</span>
                                    <span>•</span>
                                    <span>{rule.recipients.join(', ')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => toggleActive(rule)}
                                className={cn(
                                    "p-2 rounded-lg transition-colors",
                                    rule.is_active ? "text-slate-400 hover:text-red-500 hover:bg-red-50" : "text-slate-400 hover:text-emerald-500 hover:bg-emerald-50"
                                )}
                                title={rule.is_active ? "Desactivar" : "Activar"}
                            >
                                {rule.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={() => onEdit(rule)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Editar"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => deleteRule(rule)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
