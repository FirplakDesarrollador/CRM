"use client";

import { useSyncStore } from '@/lib/stores/useSyncStore';
import { syncEngine } from '@/lib/sync';
import { db, OutboxItem } from '@/lib/db';
import {
    Settings,
    RefreshCw,
    Database,
    Cloud,
    Trash2,
    Info,
    AlertCircle,
    CheckCircle2,
    HardDrive
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/components/ui/utils';

interface Stats {
    opportunities: number;
    accounts: number;
    quotes: number;
    activities: number;
    outbox: number;
}

export default function ConfigPage() {
    const { isSyncing, pendingCount, lastSyncTime, error } = useSyncStore();
    const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);

    const fetchDebugInfo = async () => {
        const items = await db.outbox.toArray();
        setOutboxItems(items);

        const s = {
            opportunities: await db.opportunities.count(),
            accounts: await db.accounts.count(),
            quotes: await db.quotes.count(),
            activities: await db.activities.count(),
            outbox: items.length
        };
        setStats(s);
    };

    useEffect(() => {
        fetchDebugInfo();
        const interval = setInterval(fetchDebugInfo, 3000);
        return () => clearInterval(interval);
    }, []);

    const clearOutbox = async () => {
        if (confirm('¿Estás seguro de limpiar la cola de sincronización? Los cambios locales no sincronizados se perderán.')) {
            await db.outbox.clear();
            await fetchDebugInfo();
        }
    };

    const resetLocalData = async () => {
        if (confirm('PELIGRO: Esto borrará TODOS los datos locales y reiniciará la aplicación. Usar solo si hay errores persistentes que no se resuelven sincronizando.\n\n¿Desea continuar?')) {
            try {
                await db.delete();
                alert('Base de datos eliminada. La aplicación se recargará para resincronizar datos limpios.');
                window.location.href = '/';
            } catch (e) {
                alert('Error al borrar DB: ' + e);
            }
        }
    };

    const forceSync = () => {
        syncEngine.triggerSync();
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <div className="bg-slate-900 p-3 rounded-2xl text-white">
                    <Settings className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Configuración</h1>
                    <p className="text-slate-500 font-medium">Estado del sistema y herrmientas de diagnóstico</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sync Status Card */}
                <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-2">
                            <RefreshCw className={cn("w-5 h-5 text-blue-600", isSyncing && "animate-spin")} />
                            <h3 className="font-bold text-slate-900 text-lg">Sincronización</h3>
                        </div>
                        <button
                            onClick={forceSync}
                            disabled={isSyncing}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-blue-100 transition-all flex items-center gap-2"
                        >
                            {isSyncing ? "Sincronizando..." : "Sincronizar Ahora"}
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Última Sincronización</p>
                                <p className="text-lg font-bold text-slate-900">
                                    {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Nunca'}
                                </p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Pendientes de Envío</p>
                                <p className={cn(
                                    "text-lg font-bold",
                                    pendingCount > 0 ? "text-blue-600" : "text-emerald-600"
                                )}>
                                    {pendingCount} registros
                                </p>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-red-900">Error detectado</p>
                                    <p className="text-xs text-red-700 leading-relaxed">{error}</p>
                                </div>
                            </div>
                        )}

                        {!error && !isSyncing && pendingCount === 0 && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                <p className="text-sm font-bold text-emerald-900">Todo el contenido está sincronizado con la nube.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Storage Stats */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-slate-600" />
                        <h3 className="font-bold text-slate-900">Base de Datos Local</h3>
                    </div>

                    <div className="space-y-4">
                        <StatRow label="Oportunidades" value={stats?.opportunities || 0} icon={Cloud} />
                        <StatRow label="Cuentas" value={stats?.accounts || 0} icon={Info} />
                        <StatRow label="Cotizaciones" value={stats?.quotes || 0} icon={Info} />
                        <StatRow label="Actividades" value={stats?.activities || 0} icon={Info} />
                    </div>


                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <button
                            onClick={async () => {
                                if (confirm("Esto forzará la recarga de la configuración (Fases, Canales) desde el servidor. ¿Continuar?")) {
                                    await db.phases.clear();
                                    await syncEngine.triggerSync();
                                    alert("Sincronización forzada iniciada. Por favor espera a que termine.");
                                }
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-3 text-blue-600 hover:bg-blue-50 rounded-xl text-sm font-bold transition-colors border border-blue-100"
                        >
                            <RefreshCw className="w-4 h-4" /> Recargar Fases
                        </button>

                        <button
                            onClick={clearOutbox}
                            className="flex items-center justify-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl text-sm font-bold transition-colors border border-red-100"
                        >
                            <Trash2 className="w-4 h-4" /> Limpiar Cola
                        </button>
                    </div>

                    <button
                        onClick={resetLocalData}
                        className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 rounded-xl text-sm font-bold transition-colors border border-red-200"
                    >
                        <AlertCircle className="w-4 h-4" />
                        Resetear Datos Locales (Hard Reset)
                    </button>
                </div>
            </div>

            {/* Outbox Debug Table */}
            {outboxItems.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center gap-2">
                        <HardDrive className="w-5 h-5 text-slate-600" />
                        <h3 className="font-bold text-slate-900 text-lg">Cola de Cambios (Outbox)</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                                <tr>
                                    <th className="px-6 py-4">Entidad</th>
                                    <th className="px-6 py-4">Campo</th>
                                    <th className="px-6 py-4">Nuevo Valor</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4">Fecha</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {outboxItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-slate-900">{item.entity_type}</span>
                                            <p className="text-[10px] text-slate-400 font-mono">{item.entity_id}</p>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">{item.field_name}</td>
                                        <td className="px-6 py-4">
                                            <div className="max-w-[150px] truncate text-xs bg-slate-100 px-2 py-1 rounded">
                                                {JSON.stringify(item.new_value)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                                                item.status === 'PENDING' ? "bg-amber-100 text-amber-700" :
                                                    item.status === 'SYNCING' ? "bg-blue-100 text-blue-700" :
                                                        "bg-red-100 text-red-700"
                                            )}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-400 text-xs">
                                            {new Date(item.field_timestamp).toLocaleTimeString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

interface StatRowProps {
    label: string;
    value: string | number;
    icon: React.ElementType;
}

function StatRow({ label, value, icon: Icon }: StatRowProps) {
    return (
        <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
                <div className="bg-slate-50 p-2 rounded-lg text-slate-500">
                    <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-slate-600">{label}</span>
            </div>
            <span className="text-sm font-bold text-slate-900">{value || 0}</span>
        </div>
    );
}
