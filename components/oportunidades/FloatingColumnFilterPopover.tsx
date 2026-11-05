"useclient";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';
import {
    Search,
    X,
    Check,
    Filter,
    User as UserIcon,
    MapPin,
    Building2,
    Layers,
    Tag,
    CircleDot,
    Trophy,
    XCircle,
    Activity,
    RotateCcw
} from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import {
    SALES_CHANNEL_OPTIONS,
    OPPORTUNITY_STATUS_OPTIONS,
    ACTIVITY_STATUS_OPTIONS,
    PROSPECTO_PHASE_ID,
    getAvailablePhasesForChannel,
    PhaseCatalogItem
} from '@/lib/opportunityColumnFilterHelpers';

export interface FloatingColumnFilterAnchor {
    top: number;
    left: number;
    title: string;
    colKey: string;
}

export interface FloatingColumnFilterPopoverProps {
    anchor: FloatingColumnFilterAnchor | null;
    onClose: () => void;
    // Current filter states
    selectedChannel: string | null;
    onSelectChannel: (channel: string | null) => void;
    selectedPhase: number | null;
    onSelectPhase: (phaseId: number | null) => void;
    selectedAccountOwnerIds: string[];
    onSelectAccountOwners: (ownerIds: string[]) => void;
    statusFilter: 'all' | 'open' | 'won' | 'lost';
    onSelectStatus: (status: 'all' | 'open' | 'won' | 'lost') => void;
    selectedOrigin: string | null;
    onSelectOrigin: (origin: string | null) => void;
    selectedCountry: number | null;
    onSelectCountry: (countryId: number | null) => void;
    selectedCity: string | null;
    onSelectCity: (city: string | null) => void;
    // Catalogs
    displayCountries: Array<{ id: number; nombre: string }>;
}

export function FloatingColumnFilterPopover({
    anchor,
    onClose,
    selectedChannel,
    onSelectChannel,
    selectedPhase,
    onSelectPhase,
    selectedAccountOwnerIds,
    onSelectAccountOwners,
    statusFilter,
    onSelectStatus,
    selectedOrigin,
    onSelectOrigin,
    selectedCountry,
    onSelectCountry,
    selectedCity,
    onSelectCity,
    displayCountries
}: FloatingColumnFilterPopoverProps) {
    const popoverRef = useRef<HTMLDivElement>(null);

    // Catalogs state loaded on-demand
    const [phases, setPhases] = useState<PhaseCatalogItem[]>([]);
    const [users, setUsers] = useState<Array<{ id: string; full_name: string; email?: string }>>([]);
    const [origins, setOrigins] = useState<Array<{ id: string; nombre: string }>>([]);
    const [loadingCatalog, setLoadingCatalog] = useState(false);

    // Current user assigned channels (vendors only see their channel phases)
    const { user } = useCurrentUser();
    const userCanales = useMemo(() => {
        if (!user?.canales || !Array.isArray(user.canales) || user.canales.length === 0) return null;
        return user.canales as string[];
    }, [user?.canales]);

    const [selectedChannelOverride, setSelectedChannelOverride] = useState<string | null>(null);

    useEffect(() => {
        if (selectedChannel) {
            setSelectedChannelOverride(selectedChannel);
        }
    }, [selectedChannel]);

    // Active funnel channel: explicit selectedChannel > override > user's single assigned channel > null
    const activeFunnelChannel = selectedChannel || selectedChannelOverride || (userCanales && userCanales.length === 1 ? userCanales[0] : null);

    // Filter available phases strictly for the active channel, excluding closed phases and deduplicating by name
    const channelPhases = useMemo(() => {
        if (!activeFunnelChannel) return [];
        return getAvailablePhasesForChannel(phases, activeFunnelChannel);
    }, [phases, activeFunnelChannel]);

    // Internal search term for lists inside the popover
    const [searchText, setSearchText] = useState('');
    const [cityInput, setCityInput] = useState(selectedCity || '');

    // Temporary owner selection for multi-select
    const [tempOwnerIds, setTempOwnerIds] = useState<string[]>(selectedAccountOwnerIds);

    useEffect(() => {
        setTempOwnerIds(selectedAccountOwnerIds);
    }, [selectedAccountOwnerIds]);

    useEffect(() => {
        setCityInput(selectedCity || '');
    }, [selectedCity]);

    // Handle outside click & escape key
    useEffect(() => {
        if (!anchor) return;

        function handleClickOutside(event: MouseEvent) {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onClose();
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [anchor, onClose]);

    // Load necessary catalog depending on active colKey
    useEffect(() => {
        if (!anchor) return;
        setSearchText('');
        const col = anchor.colKey;

        const loadCatalog = async () => {
            if (col === 'fase' && phases.length === 0) {
                setLoadingCatalog(true);
                try {
                    const { data } = await supabase
                        .from('CRM_FasesOportunidad')
                        .select('id, nombre, canal_id, orden')
                        .eq('is_active', true)
                        .order('orden', { ascending: true });
                    if (data && data.length > 0) setPhases(data);
                } catch {
                    // ignore error
                } finally {
                    setLoadingCatalog(false);
                }
            } else if (col === 'vendedor' && users.length === 0) {
                setLoadingCatalog(true);
                try {
                    const { data } = await supabase
                        .from('CRM_Usuarios')
                        .select('id, full_name, email')
                        .eq('is_active', true)
                        .order('full_name', { ascending: true });
                    if (data && data.length > 0) setUsers(data);
                } catch {
                    // ignore error
                } finally {
                    setLoadingCatalog(false);
                }
            } else if (col === 'origen' && origins.length === 0) {
                setLoadingCatalog(true);
                try {
                    const { data } = await supabase
                        .from('CRM_OrigenesOportunidad')
                        .select('id, nombre')
                        .eq('is_active', true)
                        .order('orden', { ascending: true });
                    if (data && data.length > 0) setOrigins(data);
                } catch {
                    // ignore error
                } finally {
                    setLoadingCatalog(false);
                }
            }
        };

        loadCatalog();
    }, [anchor?.colKey]);

    if (!anchor) return null;

    // Filter phases if search text is applied
    const filteredPhases = channelPhases.filter(p => {
        if (!searchText.trim()) return true;
        return p.nombre.toLowerCase().includes(searchText.toLowerCase());
    });

    const filteredUsers = users.filter(u => {
        if (!searchText.trim()) return true;
        const q = searchText.toLowerCase();
        return (u.full_name && u.full_name.toLowerCase().includes(q)) || (u.email && u.email.toLowerCase().includes(q));
    });

    const filteredOrigins = origins.filter(o => {
        if (!searchText.trim()) return true;
        return o.nombre && o.nombre.toLowerCase().includes(searchText.toLowerCase());
    });

    const filteredCountries = displayCountries.filter(c => {
        if (!searchText.trim()) return true;
        return c.nombre && c.nombre.toLowerCase().includes(searchText.toLowerCase());
    });

    const POPULAR_CITIES = ['Medellín', 'Bogotá', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga', 'Pereira', 'Manizales'];

    return (
        <div
            ref={popoverRef}
            style={{
                position: 'fixed',
                top: `${anchor.top}px`,
                left: `${anchor.left}px`,
                zIndex: 9999
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col text-slate-800 animate-in fade-in zoom-in-95 duration-150"
        >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100/70 border-b border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        {anchor.title}
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content per colKey */}
            <div className="p-3 max-h-80 overflow-y-auto">
                {/* 1. CANAL */}
                {anchor.colKey === 'canal' && (
                    <div className="space-y-1.5">
                        <button
                            onClick={() => {
                                onSelectChannel(null);
                                onClose();
                            }}
                            className={cn(
                                "w-full px-3 py-2 text-left text-xs font-semibold rounded-xl transition-all flex items-center justify-between cursor-pointer",
                                !selectedChannel
                                    ? "bg-blue-50 text-blue-700 font-bold border border-blue-200/60"
                                    : "text-slate-600 hover:bg-slate-50 border border-transparent"
                            )}
                        >
                            <span>Todos los canales</span>
                            {!selectedChannel && <Check className="w-3.5 h-3.5 text-blue-600" />}
                        </button>
                        {SALES_CHANNEL_OPTIONS.map((ch) => {
                            const isSelected = selectedChannel === ch.id;
                            return (
                                <button
                                    key={ch.id}
                                    onClick={() => {
                                        onSelectChannel(isSelected ? null : ch.id);
                                        onClose();
                                    }}
                                    className={cn(
                                        "w-full px-3 py-2 text-left text-xs font-semibold rounded-xl transition-all flex items-center justify-between cursor-pointer border",
                                        isSelected
                                            ? "bg-blue-50 text-blue-700 font-bold border-blue-200"
                                            : "hover:bg-slate-50 text-slate-700 border-slate-100"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold border", ch.badgeClass)}>
                                            {ch.id}
                                        </span>
                                        <span>{ch.label}</span>
                                    </div>
                                    {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* 2. FASE */}
                {anchor.colKey === 'fase' && !activeFunnelChannel && (
                    <div className="space-y-3">
                        <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/70 text-xs text-amber-800">
                            <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-900">
                                <Filter className="w-3.5 h-3.5 text-amber-600" />
                                Fases por canal de venta
                            </p>
                            <p className="text-[11px] text-amber-800/90 leading-relaxed">
                                Cada canal comercial tiene su propio embudo. Selecciona un canal para explorar sus etapas:
                            </p>
                        </div>

                        {/* Botón directo para filtrar por Prospectos */}
                        <button
                            onClick={() => {
                                onSelectPhase(selectedPhase === PROSPECTO_PHASE_ID ? null : PROSPECTO_PHASE_ID);
                                onClose();
                            }}
                            className={cn(
                                "w-full px-3 py-2 text-left text-xs font-semibold rounded-xl transition-all flex items-center justify-between cursor-pointer border",
                                selectedPhase === PROSPECTO_PHASE_ID
                                    ? "bg-purple-50 text-purple-700 border-purple-200 font-bold"
                                    : "bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                                    Pros.
                                </span>
                                <span>Prospectos (Sin fase asignada)</span>
                            </div>
                            {selectedPhase === PROSPECTO_PHASE_ID && <Check className="w-4 h-4 text-purple-600 shrink-0" />}
                        </button>

                        {/* Canales disponibles para el usuario */}
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                Canales disponibles
                            </p>
                            {SALES_CHANNEL_OPTIONS
                                .filter(ch => !userCanales || userCanales.includes(ch.id))
                                .map(ch => (
                                    <button
                                        key={ch.id}
                                        onClick={() => {
                                            onSelectChannel(ch.id);
                                            setSelectedChannelOverride(ch.id);
                                        }}
                                        className="w-full px-3 py-2 text-left text-xs font-medium rounded-xl hover:bg-blue-50/70 hover:text-blue-700 transition-colors border border-slate-100 flex items-center justify-between cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold border", ch.badgeClass)}>
                                                {ch.id}
                                            </span>
                                            <span className="font-semibold text-slate-700">{ch.label}</span>
                                        </div>
                                        <span className="text-[10px] text-blue-600 font-bold">Ver etapas →</span>
                                    </button>
                                ))
                            }
                        </div>
                    </div>
                )}

                {anchor.colKey === 'fase' && activeFunnelChannel && (
                    <div className="space-y-2">
                        {/* Selector / indicador del canal activo */}
                        <div className="px-2.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Canal:</span>
                                <span className="font-bold text-blue-700">{activeFunnelChannel}</span>
                            </div>
                            {(!userCanales || userCanales.length > 1) && (
                                <button
                                    onClick={() => {
                                        setSelectedChannelOverride(null);
                                        onSelectChannel(null);
                                    }}
                                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                >
                                    Cambiar canal
                                </button>
                            )}
                        </div>

                        {/* Buscador de fases dentro del canal */}
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder={`Buscar fase en ${activeFunnelChannel}...`}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                            />
                        </div>

                        {loadingCatalog ? (
                            <div className="py-6 text-center text-xs text-slate-400">Cargando fases...</div>
                        ) : (
                            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                                {/* Opción: Todas las fases */}
                                <button
                                    onClick={() => {
                                        onSelectPhase(null);
                                        onClose();
                                    }}
                                    className={cn(
                                        "w-full px-2.5 py-1.5 text-left text-xs font-medium rounded-lg transition-colors flex items-center justify-between cursor-pointer",
                                        !selectedPhase ? "bg-blue-50 text-blue-700 font-bold" : "hover:bg-slate-50 text-slate-600"
                                    )}
                                >
                                    <span>Todas las etapas de {activeFunnelChannel}</span>
                                    {!selectedPhase && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                </button>

                                {/* Opción: Prospecto (Sin fase) */}
                                <button
                                    onClick={() => {
                                        onSelectPhase(selectedPhase === PROSPECTO_PHASE_ID ? null : PROSPECTO_PHASE_ID);
                                        onClose();
                                    }}
                                    className={cn(
                                        "w-full px-2.5 py-1.5 text-left text-xs font-medium rounded-lg transition-colors flex items-center justify-between cursor-pointer border border-transparent",
                                        selectedPhase === PROSPECTO_PHASE_ID
                                            ? "bg-purple-50 text-purple-700 font-bold border-purple-200/60"
                                            : "hover:bg-slate-50 text-slate-700"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700">
                                            Pros.
                                        </span>
                                        <span>Prospecto (Sin fase)</span>
                                    </div>
                                    {selectedPhase === PROSPECTO_PHASE_ID && <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                                </button>

                                {/* Etapas activas del embudo del canal */}
                                {filteredPhases.map((ph, idx) => {
                                    const isSelected = selectedPhase === ph.id;
                                    return (
                                        <button
                                            key={ph.id}
                                            onClick={() => {
                                                onSelectPhase(isSelected ? null : ph.id);
                                                onClose();
                                            }}
                                            className={cn(
                                                "w-full px-2.5 py-1.5 text-left text-xs font-medium rounded-lg transition-colors flex items-center justify-between cursor-pointer",
                                                isSelected ? "bg-blue-50 text-blue-700 font-bold" : "hover:bg-slate-50 text-slate-700"
                                            )}
                                        >
                                            <div className="flex items-center gap-2 truncate pr-2">
                                                <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <span className="truncate">{ph.nombre}</span>
                                            </div>
                                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* 3. VENDEDOR (ASIGNADO A) */}
                {anchor.colKey === 'vendedor' && (
                    <div className="space-y-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar asesor comercial..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                            />
                        </div>

                        {loadingCatalog ? (
                            <div className="py-6 text-center text-xs text-slate-400">Cargando asesores...</div>
                        ) : (
                            <>
                                <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                                    <button
                                        onClick={() => setTempOwnerIds([])}
                                        className={cn(
                                            "w-full px-2.5 py-1.5 text-left text-xs font-medium rounded-lg transition-colors flex items-center justify-between cursor-pointer",
                                            tempOwnerIds.length === 0 ? "bg-blue-50 text-blue-700 font-bold" : "hover:bg-slate-50 text-slate-600"
                                        )}
                                    >
                                        <span>Todos los asesores</span>
                                        {tempOwnerIds.length === 0 && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                    </button>
                                    {filteredUsers.map((u) => {
                                        const isSelected = tempOwnerIds.includes(u.id);
                                        return (
                                            <button
                                                key={u.id}
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setTempOwnerIds(tempOwnerIds.filter(id => id !== u.id));
                                                    } else {
                                                        setTempOwnerIds([...tempOwnerIds, u.id]);
                                                    }
                                                }}
                                                className={cn(
                                                    "w-full px-2.5 py-1.5 text-left text-xs font-medium rounded-lg transition-colors flex items-center justify-between cursor-pointer",
                                                    isSelected ? "bg-blue-50 text-blue-700 font-bold" : "hover:bg-slate-50 text-slate-700"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 truncate pr-2">
                                                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-600 font-bold shrink-0">
                                                        {u.full_name ? u.full_name[0].toUpperCase() : 'U'}
                                                    </div>
                                                    <span className="truncate">{u.full_name}</span>
                                                </div>
                                                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="pt-2 border-t border-slate-100 flex gap-2">
                                    <button
                                        onClick={() => {
                                            setTempOwnerIds([]);
                                            onSelectAccountOwners([]);
                                            onClose();
                                        }}
                                        className="flex-1 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                                    >
                                        Limpiar
                                    </button>
                                    <button
                                        onClick={() => {
                                            onSelectAccountOwners(tempOwnerIds);
                                            onClose();
                                        }}
                                        className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                                    >
                                        Aplicar ({tempOwnerIds.length})
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* 4. ESTADO */}
                {anchor.colKey === 'estado' && (
                    <div className="space-y-1.5">
                        {OPPORTUNITY_STATUS_OPTIONS.map((st) => {
                            const isSelected = statusFilter === st.id;
                            return (
                                <button
                                    key={st.id}
                                    onClick={() => {
                                        onSelectStatus(st.id as any);
                                        onClose();
                                    }}
                                    className={cn(
                                        "w-full px-3 py-2 text-left text-xs font-semibold rounded-xl transition-all flex items-center justify-between cursor-pointer border",
                                        isSelected
                                            ? "bg-blue-50 text-blue-700 font-bold border-blue-200"
                                            : "hover:bg-slate-50 text-slate-700 border-slate-100"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">{st.icon}</span>
                                        <div>
                                            <p className="font-bold text-slate-800">{st.label}</p>
                                            <p className="text-[10px] text-slate-400 font-normal">{st.description}</p>
                                        </div>
                                    </div>
                                    {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* 5. ORIGEN */}
                {anchor.colKey === 'origen' && (
                    <div className="space-y-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar origen..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                            />
                        </div>

                        {loadingCatalog ? (
                            <div className="py-6 text-center text-xs text-slate-400">Cargando orígenes...</div>
                        ) : (
                            <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                                <button
                                    onClick={() => {
                                        onSelectOrigin(null);
                                        onClose();
                                    }}
                                    className={cn(
                                        "w-full px-2.5 py-1.5 text-left text-xs font-medium rounded-lg transition-colors flex items-center justify-between cursor-pointer",
                                        !selectedOrigin ? "bg-blue-50 text-blue-700 font-bold" : "hover:bg-slate-50 text-slate-600"
                                    )}
                                >
                                    <span>Todos los orígenes</span>
                                    {!selectedOrigin && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                </button>
                                {filteredOrigins.map((orig) => {
                                    const isSelected = selectedOrigin === orig.nombre;
                                    return (
                                        <button
                                            key={orig.id}
                                            onClick={() => {
                                                onSelectOrigin(isSelected ? null : orig.nombre);
                                                onClose();
                                            }}
                                            className={cn(
                                                "w-full px-2.5 py-1.5 text-left text-xs font-medium rounded-lg transition-colors flex items-center justify-between cursor-pointer",
                                                isSelected ? "bg-blue-50 text-blue-700 font-bold" : "hover:bg-slate-50 text-slate-700"
                                            )}
                                        >
                                            <span className="truncate">{orig.nombre}</span>
                                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* 6. PAÍS */}
                {anchor.colKey === 'pais' && (
                    <div className="space-y-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar país..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                            />
                        </div>

                        <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                            <button
                                onClick={() => {
                                    onSelectCountry(null);
                                    onClose();
                                }}
                                className={cn(
                                    "w-full px-2.5 py-1.5 text-left text-xs font-medium rounded-lg transition-colors flex items-center justify-between cursor-pointer",
                                    !selectedCountry ? "bg-blue-50 text-blue-700 font-bold" : "hover:bg-slate-50 text-slate-600"
                                )}
                            >
                                <span>Todos los países</span>
                                {!selectedCountry && <Check className="w-3.5 h-3.5 text-blue-600" />}
                            </button>
                            {filteredCountries.map((c) => {
                                const isSelected = selectedCountry === c.id;
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => {
                                            onSelectCountry(isSelected ? null : c.id);
                                            onClose();
                                        }}
                                        className={cn(
                                            "w-full px-2.5 py-1.5 text-left text-xs font-medium rounded-lg transition-colors flex items-center justify-between cursor-pointer",
                                            isSelected ? "bg-blue-50 text-blue-700 font-bold" : "hover:bg-slate-50 text-slate-700"
                                        )}
                                    >
                                        <span className="truncate">{c.nombre}</span>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 7. CIUDAD */}
                {anchor.colKey === 'ciudad' && (
                    <div className="space-y-3">
                        <div className="relative">
                            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Escribir nombre de ciudad..."
                                value={cityInput}
                                onChange={(e) => setCityInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        onSelectCity(cityInput.trim() || null);
                                        onClose();
                                    }
                                }}
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                            />
                        </div>

                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Ciudades frecuentes</p>
                            <div className="flex flex-wrap gap-1.5">
                                {POPULAR_CITIES.map((city) => {
                                    const isSelected = selectedCity?.toLowerCase() === city.toLowerCase();
                                    return (
                                        <button
                                            key={city}
                                            onClick={() => {
                                                const next = isSelected ? null : city;
                                                setCityInput(next || '');
                                                onSelectCity(next);
                                                onClose();
                                            }}
                                            className={cn(
                                                "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer",
                                                isSelected
                                                    ? "bg-blue-50 border-blue-300 text-blue-700 font-bold"
                                                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                            )}
                                        >
                                            {city}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex gap-2">
                            <button
                                onClick={() => {
                                    setCityInput('');
                                    onSelectCity(null);
                                    onClose();
                                }}
                                className="flex-1 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                                Limpiar
                            </button>
                            <button
                                onClick={() => {
                                    onSelectCity(cityInput.trim() || null);
                                    onClose();
                                }}
                                className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                            >
                                Aplicar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer info */}
            <div className="px-4 py-2 bg-slate-50/70 border-t border-slate-200/60 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Consulta directa en Supabase</span>
                <span className="font-bold text-blue-600">Catálogo maestro</span>
            </div>
        </div>
    );
}
