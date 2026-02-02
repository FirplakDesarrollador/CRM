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
    HardDrive,
    LogOut,
    Target
} from 'lucide-react';
import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/components/ui/utils';
import { supabase } from '@/lib/supabase';
import { useConfig } from '@/lib/hooks/useConfig';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { PriceListUploader } from '@/components/config/PriceListUploader';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ActivityClassificationManager } from '@/components/config/ActivityClassificationManager';
import { useSearchParams } from 'next/navigation';
import packageJson from '../../package.json';

const CRM_VERSION = packageJson.version;

const getFriendlyErrorMessage = (error: string | undefined | null) => {
    if (!error) return "Error desconocido";
    if (error.includes("invalid input syntax for type date")) return "Formato de fecha inválido. Se esperaba AAAA-MM-DD.";
    if (error.includes("violates not-null constraint")) return "Datos imcompletos. Faltan campos obligatorios.";
    if (error.includes("duplicate key value")) return "Registro duplicado. Ya existe en la base de datos.";
    if (error.includes("Failed to fetch")) return "Problema de conexión. Verifica tu internet.";
    if (error.includes("JWT expired")) return "Tu sesión ha expirado. Por favor inicia sesión nuevamente.";
    return error; // Fallback to raw error if no match
};

interface Stats {
    opportunities: number;
    accounts: number;
    quotes: number;
    activities: number;
    outbox: number;
}

interface ModalConfig {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
    confirmLabel?: string;
    isLoading?: boolean;
}

export default function ConfigPage() {
    const router = useRouter();
    const { isSyncing, pendingCount, lastSyncTime, error, isPaused, setPaused } = useSyncStore();
    const { user, role } = useCurrentUser();
    const searchParams = useSearchParams();
    const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
    const [msConnected, setMsConnected] = useState<boolean | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);

    const [modalConfig, setModalConfig] = useState<ModalConfig>({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => { },
    });

    const handleLogout = async () => {
        setModalConfig(prev => ({ ...prev, isLoading: true }));

        // Clear ALL local data FIRST
        localStorage.removeItem('cachedUserId');
        sessionStorage.removeItem('crm_initialSyncDone');

        // Clear Supabase cookies (critical for mobile)
        document.cookie.split(';').forEach(cookie => {
            const name = cookie.split('=')[0].trim();
            if (name.includes('sb-')) {
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
            }
        });

        // Fire signOut in background (don't wait for it)
        supabase.auth.signOut().catch(err => {
            console.warn('[Config] SignOut background error (ignored):', err);
        });

        // Redirect IMMEDIATELY - don't wait for Supabase
        console.log('[Config] Redirecting to login immediately');
        window.location.replace('/login');
    };

    const confirmLogout = () => {
        setModalConfig({
            isOpen: true,
            title: "Cerrar Sesión",
            message: "¿Estás seguro de que deseas cerrar sesión? Asegúrate de haber sincronizado tus cambios.",
            confirmLabel: "Cerrar Sesión",
            variant: "danger",
            onConfirm: handleLogout
        });
    };

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

    const checkMicrosoftStatus = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('CRM_MicrosoftTokens')
                .select('user_id')
                .eq('user_id', user.id)
                .maybeSingle();

            setMsConnected(!!data);
        } catch (e) {
            setMsConnected(false);
        }
    };

    useEffect(() => {
        checkMicrosoftStatus();
    }, [user]);

    useEffect(() => {
        const syncStatus = searchParams.get('ms_sync');
        const msError = searchParams.get('ms_error');

        if (syncStatus === 'success') {
            setModalConfig({
                isOpen: true,
                title: "Microsoft Sincronizado",
                message: "Tu cuenta de Microsoft ha sido vinculada correctamente. Ahora puedes usar Planner y Calendario.",
                confirmLabel: "Excelente",
                onConfirm: () => {
                    setModalConfig(prev => ({ ...prev, isOpen: false }));
                    router.replace('/configuracion');
                },
                variant: 'info'
            });
            checkMicrosoftStatus();
        } else if (msError) {
            setModalConfig({
                isOpen: true,
                title: "Error de Sincronización",
                message: `No se pudo vincular la cuenta de Microsoft: ${msError}`,
                confirmLabel: "Cerrar",
                onConfirm: () => {
                    setModalConfig(prev => ({ ...prev, isOpen: false }));
                    router.replace('/configuracion');
                },
                variant: 'danger'
            });
        }
    }, [searchParams]);

    const handleMicrosoftSync = () => {
        window.location.href = '/api/microsoft/login';
    };

    const clearOutbox = async () => {
        setModalConfig({
            isOpen: true,
            title: "Limpiar Cola de Sincronización",
            message: "¿Estás seguro de limpiar la cola de sincronización? Los cambios locales no sincronizados se perderán permanentemente.",
            confirmLabel: "Limpiar Ahora",
            variant: "danger",
            onConfirm: async () => {
                await db.outbox.clear();
                await fetchDebugInfo();
                setModalConfig(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const resetLocalData = async () => {
        setModalConfig({
            isOpen: true,
            title: "¡PELIGRO! Reset Total",
            message: "Esto borrará TODOS los datos locales y reiniciará la aplicación. Solo usa esto si hay errores persistentes que no se resuelven sincronizando. ¿Deseas continuar?",
            confirmLabel: "Borrar Todo",
            variant: "danger",
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, isLoading: true }));
                try {
                    await db.delete();
                    setModalConfig({
                        isOpen: true,
                        title: "Base de Datos Eliminada",
                        message: "La aplicación se recargará para resincronizar datos limpios.",
                        confirmLabel: "Entendido",
                        onConfirm: () => window.location.href = '/',
                        variant: "info"
                    });
                } catch (e) {
                    setModalConfig({
                        isOpen: true,
                        title: "Error al borrar DB",
                        message: String(e),
                        confirmLabel: "Cerrar",
                        onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false })),
                        variant: "danger"
                    });
                }
            }
        });
    };

    const forceSync = () => {
        if (isPaused) {
            setModalConfig({
                isOpen: true,
                title: "Sincronización Pausada",
                message: "La sincronización está pausada. Reanúdala para poder sincronizar manualmente.",
                confirmLabel: "Entendido",
                onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false })),
                variant: "warning"
            });
            return;
        }
        syncEngine.triggerSync();
    };

    const togglePause = () => {
        const newState = !isPaused;
        setPaused(newState);
        if (!newState) {
            // If resuming, trigger a sync
            setTimeout(() => syncEngine.triggerSync(), 500);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-900 p-3 rounded-2xl text-white">
                        <Settings className="w-8 h-8" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-slate-900">Configuración</h1>
                            <span className="px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                                v{CRM_VERSION}
                            </span>
                        </div>
                        <p className="text-slate-500 font-medium">Estado del sistema y herramientas de diagnóstico</p>
                    </div>
                </div>

                <button
                    onClick={handleMicrosoftSync}
                    className={cn(
                        "flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all shadow-lg active:scale-95",
                        msConnected
                            ? "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                            : "bg-[#00a1f1] text-white hover:bg-[#008ad8] shadow-[#00a1f1]/20"
                    )}
                >
                    <svg className="w-5 h-5" viewBox="0 0 23 23" fill="currentColor">
                        <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z" />
                    </svg>
                    {msConnected ? 'Cuenta Microsoft Vinculada' : 'Sincronizar cuenta Microsoft'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sync Status Card */}
                <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-2">
                            <RefreshCw className={cn("w-5 h-5 text-blue-600", isSyncing && "animate-spin")} />
                            <h3 className="font-bold text-slate-900 text-lg">Sincronización</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={togglePause}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border",
                                    isPaused
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                        : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                )}
                            >
                                {isPaused ? (
                                    <> <RefreshCw className="w-4 h-4" /> Reanudar </>
                                ) : (
                                    <> <RefreshCw className="w-4 h-4" /> Pausar </>
                                )}
                            </button>
                            <button
                                onClick={forceSync}
                                disabled={isSyncing || isPaused}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-blue-100 transition-all flex items-center gap-2"
                            >
                                {isSyncing ? "Sincronizando..." : "Sincronizar Ahora"}
                            </button>
                        </div>
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
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Estado</p>
                                <p className={cn(
                                    "text-lg font-bold",
                                    isPaused ? "text-amber-600" : "text-emerald-600"
                                )}>
                                    {isPaused ? 'Pausado' : 'Activo'}
                                </p>
                            </div>
                        </div>

                        {isPaused && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-amber-900">Sincronización Pausada</p>
                                    <p className="text-xs text-amber-700 leading-relaxed">
                                        Los cambios locales se guardarán pero no se enviarán a la nube hasta que reanudes la sincronización.
                                    </p>
                                </div>
                            </div>
                        )}

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
                                setModalConfig({
                                    isOpen: true,
                                    title: "Recargar Fases de Venta",
                                    message: "Esto forzará la recarga de la configuración (Fases, Canales) desde el servidor. ¿Deseas continuar?",
                                    confirmLabel: "Recargar",
                                    variant: "info",
                                    onConfirm: async () => {
                                        setModalConfig(prev => ({ ...prev, isLoading: true }));
                                        await db.phases.clear();
                                        await syncEngine.triggerSync();
                                        setModalConfig({
                                            isOpen: true,
                                            title: "Recarga Iniciada",
                                            message: "La sincronización forzada ha comenzado. Por favor espera a que termine de procesar las fases.",
                                            confirmLabel: "Entendido",
                                            onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false })),
                                            variant: "info"
                                        });
                                    }
                                });
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

                {/* Session Card */}
                <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <LogOut className="w-5 h-5 text-slate-600" />
                        <h3 className="font-bold text-slate-900">Sesión</h3>
                    </div>
                    <p className="text-sm text-slate-500 mb-6">Administra tu acceso a la aplicación.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* User Info */}
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-md">
                                    {user?.email?.substring(0, 2).toUpperCase() || '??'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">{user?.email || 'Usuario'}</p>
                                    <span className={cn(
                                        "inline-block mt-1 px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full",
                                        role === 'ADMIN' ? "bg-purple-100 text-purple-700" :
                                            role === 'COORDINADOR' ? "bg-blue-100 text-blue-700" :
                                                "bg-slate-100 text-slate-600"
                                    )}>
                                        {role || 'Vendedor'}
                                    </span>
                                </div>
                            </div>
                            <div className="text-xs text-slate-400 pt-2 border-t border-slate-200">
                                Sesión activa desde: {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                        </div>

                        {/* Logout Button */}
                        <div className="flex flex-col justify-center">
                            <button
                                onClick={confirmLogout}
                                className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl text-sm font-bold transition-colors border border-red-200"
                            >
                                <LogOut className="w-4 h-4" />
                                Cerrar Sesión
                            </button>
                            <p className="text-xs text-slate-400 text-center mt-3">Asegúrate de sincronizar antes de salir.</p>
                        </div>
                    </div>
                </div>

                {/* Microsoft Integration Card */}
                <div className="md:col-span-1 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Cloud className="w-5 h-5 text-[#00a1f1]" />
                            <h3 className="font-bold text-slate-900">Integración Microsoft</h3>
                        </div>
                        <p className="text-sm text-slate-500 mb-6">
                            Sincroniza tus tareas con Planner y eventos con Outlook.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className={cn(
                            "p-4 rounded-2xl border flex items-center gap-3",
                            msConnected === true ? "bg-emerald-50 border-emerald-100" :
                                msConnected === false ? "bg-slate-50 border-slate-100" :
                                    "bg-slate-50/50 border-slate-100 animate-pulse"
                        )}>
                            <div className={cn(
                                "w-2 h-2 rounded-full",
                                msConnected === true ? "bg-emerald-500" : "bg-slate-300"
                            )} />
                            <span className="text-sm font-bold text-slate-700">
                                {msConnected === true ? 'Cuenta Vinculada' :
                                    msConnected === false ? 'No Conectado' : 'Verificando...'}
                            </span>
                        </div>

                        <button
                            onClick={handleMicrosoftSync}
                            className={cn(
                                "w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl text-sm font-bold transition-all shadow-md",
                                msConnected
                                    ? "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                                    : "bg-[#00a1f1] text-white hover:bg-[#008ad8] shadow-[#00a1f1]/20"
                            )}
                        >
                            <svg className="w-4 h-4" viewBox="0 0 23 23" fill="currentColor">
                                <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z" />
                            </svg>
                            {msConnected ? 'Volver a Sincronizar' : 'Sincronizar Microsoft'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Outbox Debug Table */}
            {outboxItems.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <HardDrive className="w-5 h-5 text-slate-600" />
                            <h3 className="font-bold text-slate-900 text-lg">Cola de Cambios (Outbox)</h3>
                        </div>
                        <button
                            onClick={() => {
                                const report = outboxItems.map(item =>
                                    `[${item.status}] ${item.entity_type} (${item.field_name}): ${item.error || 'OK'}`
                                ).join('\n');
                                const fullReport = `=== REPORTE DE SINCRONIZACIÓN ===\nFecha: ${new Date().toLocaleString()}\nPending Items: ${outboxItems.length}\n\n${report}`;
                                navigator.clipboard.writeText(fullReport);
                                setModalConfig({
                                    isOpen: true,
                                    title: "Reporte Copiado",
                                    message: "El reporte técnico ha sido copiado al portapapeles. Puedes pegarlo en el chat de soporte.",
                                    confirmLabel: "Entendido",
                                    onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false })),
                                    variant: "info"
                                });
                            }}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors border border-blue-100 flex items-center gap-1"
                        >
                            <Info className="w-3 h-3" />
                            Copiar Info Técnica
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                                <tr>
                                    <th className="px-6 py-4">Entidad</th>
                                    <th className="px-6 py-4">Campo</th>
                                    <th className="px-6 py-4">Nuevo Valor</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4">Error / Detalle</th>
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
                                        <td className="px-6 py-4 max-w-[200px]">
                                            {item.status === 'FAILED' ? (
                                                <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
                                                    <strong>Error:</strong> {getFriendlyErrorMessage(item.error)}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">-</span>
                                            )}
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

            {/* Price List Uploader - Admin Only */}
            {role === 'ADMIN' && (
                <>
                    <PriceListUploader />
                    <ActivityClassificationManager />
                </>
            )}

            {/* Goals Configuration - Admin Only */}
            {/* Goals Configuration - Admin Only */}
            {role === 'ADMIN' && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-100 p-3 rounded-2xl text-indigo-600">
                            <Target className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg">Metas y Objetivos</h3>
                            <p className="text-sm text-slate-500">Configurar y asignar metas comerciales a los usuarios</p>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push('/configuracion/metas')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                    >
                        <Target className="w-4 h-4" />
                        Configurar Metas
                    </button>
                </div>
            )}

            <AdminSettings setModalConfig={setModalConfig} />

            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={modalConfig.onConfirm}
                title={modalConfig.title}
                message={modalConfig.message}
                confirmLabel={modalConfig.confirmLabel}
                variant={modalConfig.variant}
                isLoading={modalConfig.isLoading}
            />


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

function AdminSettings({ setModalConfig }: { setModalConfig: Dispatch<SetStateAction<ModalConfig>> }) {
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
            confirmLabel: "Aceptar",
            onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false })),
            variant: "info"
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
                {/* Min Premium Order */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        Pedido Mínimo Cliente Premium (COP)
                    </label>
                    <p className="text-xs text-slate-500 mb-3">
                        Valor mínimo requerido en cotizaciones para clientes marcados como Premium. Si no se cumple, no podrán generar pedido.
                    </p>
                    <input
                        type="number"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 mb-2"
                        value={minValue}
                        onChange={(e) => setMinValue(e.target.value)}
                    />
                </div>

                {/* Inactive Client Alert */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        Alerta Inactividad Cliente (Días)
                    </label>
                    <p className="text-xs text-slate-500 mb-3">
                        Días sin interacción (actividades u oportunidades) para considerar un cliente como inactivo y generar alerta.
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
