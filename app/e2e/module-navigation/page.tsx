"use client";

import { notFound, useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import { SYSTEM_NAV_ITEMS, getVisibleNavItems, sanitizeStateForSessionStorage } from "@/lib/navigationRules";

function ModuleNavigationHarness() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [simulatedRole, setSimulatedRole] = useState<string>('ASESOR');
    const [sessionFilterSaved, setSessionFilterSaved] = useState<string>("");

    // Derive editingEntityId directly from searchParams
    const editingEntityId = searchParams.get('id');

    const handleOpenEntity = (id: string) => {
        const params = new URLSearchParams(Array.from(searchParams.entries()));
        params.set('id', id);
        params.set('channel', 'DIST_NAC');
        const query = params.toString();
        
        // Save to session without ID
        const sanitized = sanitizeStateForSessionStorage(query);
        setSessionFilterSaved(sanitized);

        router.replace(`?${query}`, { scroll: false });
    };

    const handleNavigateClean = () => {
        // Clic en sidebar hacia módulo limpio
        const params = new URLSearchParams(Array.from(searchParams.entries()));
        params.delete('id');
        const query = params.toString();
        router.replace(query ? `?${query}` : '/e2e/module-navigation', { scroll: false });
    };

    const visibleItems = getVisibleNavItems(SYSTEM_NAV_ITEMS, simulatedRole);

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">E2E Module Navigation & Role Harness</h1>

            {/* Role Switcher */}
            <div className="flex items-center gap-4 bg-slate-100 p-4 rounded-xl">
                <span className="font-semibold text-slate-700">Rol Simulado:</span>
                <button
                    onClick={() => setSimulatedRole('ADMIN')}
                    data-testid="role-admin-btn"
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold ${simulatedRole === 'ADMIN' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
                >
                    ADMIN
                </button>
                <button
                    onClick={() => setSimulatedRole('ASESOR')}
                    data-testid="role-asesor-btn"
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold ${simulatedRole === 'ASESOR' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
                >
                    ASESOR
                </button>
            </div>

            {/* Simulated Navigation Sidebar */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Módulos Visibles en Sidebar</h2>
                <div className="flex flex-wrap gap-2" data-testid="sidebar-modules">
                    {visibleItems.map((item) => (
                        <button
                            key={item.href}
                            data-testid={`nav-item-${item.href.replace('/', '') || 'home'}`}
                            onClick={handleNavigateClean}
                            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 text-slate-800"
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Entity Actions */}
            <div className="space-y-4">
                <div className="flex gap-4">
                    <button
                        onClick={() => handleOpenEntity('cuenta-test-uuid')}
                        data-testid="open-account-btn"
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700"
                    >
                        Abrir Cuenta (con ID)
                    </button>
                    <button
                        onClick={handleNavigateClean}
                        data-testid="sidebar-cuentas-btn"
                        className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold text-sm hover:bg-slate-900"
                    >
                        Clic en Sidebar &apos;Cuentas&apos;
                    </button>
                </div>

                {/* Form Panel (Conditional on editingEntityId) */}
                {editingEntityId ? (
                    <div data-testid="form-panel-active" className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-blue-900">Formulario Abierto: {editingEntityId}</span>
                            <button
                                onClick={handleNavigateClean}
                                data-testid="close-form-x-btn"
                                className="text-blue-600 font-bold px-2 py-1 hover:bg-blue-100 rounded"
                            >
                                ✕ Cerrar
                            </button>
                        </div>
                    </div>
                ) : (
                    <div data-testid="list-view-active" className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
                        Vista de Lista General Activa (Sin Formulario)
                    </div>
                )}

                {/* Persisted Session State Display */}
                <div className="p-3 bg-slate-100 rounded-lg text-xs font-mono text-slate-600">
                    <span>Filtros Persistidos en Session: </span>
                    <span data-testid="session-storage-state">{sessionFilterSaved || 'ninguno'}</span>
                </div>
            </div>
        </div>
    );
}

export default function E2EModuleNavigationPage() {
    if (process.env.NODE_ENV === "production") {
        notFound();
    }

    return (
        <Suspense fallback={<div className="p-6">Cargando harness...</div>}>
            <ModuleNavigationHarness />
        </Suspense>
    );
}
