import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Filter, X, CircleDot, Trophy, XCircle } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useFullCatalog } from "@/lib/hooks/useProducts";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

type Channel = {
    id: string;
    nombre?: string;
};

type Subclasificacion = {
    id: number;
    nombre: string;
    canal_id: string;
};

type Segment = {
    id: number;
    nombre: string;
    subclasificacion_id: number;
};

type Phase = {
    id: number;
    nombre: string;
    canal_id: string;
    probability?: number;
};

type Origin = {
    id: string;
    codigo: string;
    nombre: string;
    orden?: number;
    is_active?: boolean;
};

// Status filter type - includes both open stages and closed states
type StatusFilter = 'all' | 'open' | 'won' | 'lost';

interface OpportunityFiltersProps {
    onFilterChange: (filters: {
        channelId: string | null;
        subclassificationId: number | null;
        segmentId: number | null;
        phaseId: number | null;
        statusFilter: StatusFilter;
        startDate: string | null;
        endDate: string | null;
        startClosingDate: string | null;
        endClosingDate: string | null;
        origin: string | null;
        planta?: string | null;
        familia?: string | null;
    }) => void;
    initialChannelId?: string | null;
    initialSubclassId?: number | null;
    initialSegmentId?: number | null;
    initialPhaseId?: number | null;
    initialStatusFilter?: StatusFilter;
    initialOrigin?: string | null;
    initialPlanta?: string | null;
    initialFamilia?: string | null;
    initialDates?: {
        startDate: string | null;
        endDate: string | null;
        startClosingDate: string | null;
        endClosingDate: string | null;
    };
}

export function OpportunityFilters({
    onFilterChange,
    initialChannelId,
    initialSubclassId,
    initialSegmentId,
    initialPhaseId,
    initialStatusFilter,
    initialOrigin,
    initialPlanta,
    initialFamilia,
    initialDates
}: OpportunityFiltersProps) {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [subclasses, setSubclasses] = useState<Subclasificacion[]>([]);
    const [segments, setSegments] = useState<Segment[]>([]);
    const [phases, setPhases] = useState<Phase[]>([]);
    const [origins, setOrigins] = useState<Origin[]>([]);

    // Selection state
    const [selectedChannel, setSelectedChannel] = useState<string | null>(initialChannelId || null);
    const [selectedSubclass, setSelectedSubclass] = useState<number | null>(initialSubclassId || null);
    const [selectedSegment, setSelectedSegment] = useState<number | null>(initialSegmentId || null);
    const [selectedPhase, setSelectedPhase] = useState<number | null>(initialPhaseId || null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter || 'open');
    const [selectedOrigin, setSelectedOrigin] = useState<string | null>(initialOrigin || null);
    const [selectedPlanta, setSelectedPlanta] = useState<string | null>(initialPlanta || null);
    const [selectedFamilia, setSelectedFamilia] = useState<string | null>(initialFamilia || null);
    const { products } = useFullCatalog();

    const [startDate, setStartDate] = useState<string | null>(initialDates?.startDate || null);
    const [endDate, setEndDate] = useState<string | null>(initialDates?.endDate || null);
    const [startClosingDate, setStartClosingDate] = useState<string | null>(initialDates?.startClosingDate || null);
    const [endClosingDate, setEndClosingDate] = useState<string | null>(initialDates?.endClosingDate || null);

    const [loadingMetadata, setLoadingMetadata] = useState(true);

    useEffect(() => {
        if (initialOrigin !== undefined) {
            setSelectedOrigin(initialOrigin || null);
        }
    }, [initialOrigin]);

    useEffect(() => {
        if (initialPlanta !== undefined) {
            setSelectedPlanta(initialPlanta || null);
        }
    }, [initialPlanta]);

    useEffect(() => {
        if (initialFamilia !== undefined) {
            setSelectedFamilia(initialFamilia || null);
        }
    }, [initialFamilia]);

    useEffect(() => {
        setSelectedChannel(initialChannelId || null);
    }, [initialChannelId]);

    useEffect(() => {
        setSelectedSubclass(initialSubclassId || null);
    }, [initialSubclassId]);

    useEffect(() => {
        setSelectedSegment(initialSegmentId || null);
    }, [initialSegmentId]);

    useEffect(() => {
        setSelectedPhase(initialPhaseId || null);
    }, [initialPhaseId]);

    useEffect(() => {
        if (initialStatusFilter) {
            setStatusFilter(initialStatusFilter);
        }
    }, [initialStatusFilter]);

    useEffect(() => {
        setStartDate(initialDates?.startDate || null);
        setEndDate(initialDates?.endDate || null);
        setStartClosingDate(initialDates?.startClosingDate || null);
        setEndClosingDate(initialDates?.endClosingDate || null);
    }, [initialDates?.startDate, initialDates?.endDate, initialDates?.startClosingDate, initialDates?.endClosingDate]);

    // Initial Load
    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const [phasesRes, chanRes, subRes, segRes, origRes] = await Promise.all([
                    supabase.from('CRM_FasesOportunidad').select('id, nombre, canal_id, probability').eq('is_active', true),
                    supabase.from('CRM_Canales').select('id, nombre').order('nombre'),
                    supabase.from('CRM_Subclasificacion').select('*'),
                    supabase.from('CRM_Segmentos').select('*'),
                    supabase.from('CRM_OrigenesOportunidad').select('id, codigo, nombre, orden').eq('is_active', true).order('orden').order('nombre')
                ]);

                if (phasesRes.data) setPhases(phasesRes.data);
                if (subRes.data) setSubclasses(subRes.data);
                if (segRes.data) setSegments(segRes.data);
                if (origRes.data) setOrigins(origRes.data);

                if (chanRes.data && chanRes.data.length > 0) {
                    setChannels(chanRes.data);
                } else {
                    // Fallback to extraction sequence if CRM_Canales is empty
                    const uniqueChannels = Array.from(new Set(phasesRes.data?.map(p => p.canal_id))).filter(Boolean);
                    const channelNames: Record<string, string> = {
                        'OBRAS_INT': 'Obras Internacional',
                        'OBRAS_NAC': 'Obras Nacional',
                        'DIST_INT': 'Distribución Internacional',
                        'DIST_NAC': 'Distribución Nacional',
                        'PROPIO': 'Canal Propio'
                    };
                    setChannels(uniqueChannels.map(c => ({ id: c, nombre: channelNames[c] || c })));
                }

                // If initial filters were set (e.g., from URL on back navigation),
                // notify the parent so the hook fetches with correct filters
                if (initialChannelId || initialSubclassId || initialSegmentId || initialPhaseId || initialOrigin || initialPlanta || initialFamilia || (initialStatusFilter && initialStatusFilter !== 'open') || initialDates) {
                    onFilterChange({
                        channelId: initialChannelId || null,
                        subclassificationId: initialSubclassId || null,
                        segmentId: initialSegmentId || null,
                        phaseId: initialPhaseId || null,
                        statusFilter: initialStatusFilter || 'open',
                        startDate: initialDates?.startDate || null,
                        endDate: initialDates?.endDate || null,
                        startClosingDate: initialDates?.startClosingDate || null,
                        endClosingDate: initialDates?.endClosingDate || null,
                        origin: initialOrigin || null,
                        planta: initialPlanta || null,
                        familia: initialFamilia || null
                    });
                }

            } catch (err) {
                console.error("Error loading filter metadata", err);
            } finally {
                setLoadingMetadata(false);
            }
        };

        loadMetadata();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Derived options based on selection
    const availableSubclasses = useMemo(() => {
        if (!selectedChannel) return [];
        return subclasses.filter(s => s.canal_id === selectedChannel);
    }, [selectedChannel, subclasses]);

    const availableSegments = useMemo(() => {
        if (!selectedSubclass) return [];
        return segments.filter(seg => seg.subclasificacion_id === selectedSubclass);
    }, [selectedSubclass, segments]);

    // Get phases for selected channel, excluding closed phases for the phase dropdown
    // (closed phases are handled via statusFilter)
    const availablePhases = useMemo(() => {
        if (!selectedChannel) return [];
        return phases
            .filter(p => p.canal_id === selectedChannel)
            .filter(p => {
                const nombre = p.nombre.toLowerCase();
                // Exclude closed phases from the phase dropdown
                return !nombre.includes('cerrada');
            });
    }, [selectedChannel, phases]);

    const availablePlants = useMemo(() => {
        const list = Array.from(new Set(products.map(p => p.planta).filter(Boolean))).sort() as string[];
        return list.length > 0 ? list : ['FVHMP', 'MBL', 'PC'];
    }, [products]);

    const availableFamilies = useMemo(() => {
        const filtered = selectedPlanta
            ? products.filter(p => p.planta?.toLowerCase() === selectedPlanta.toLowerCase())
            : products;
        return Array.from(new Set(filtered.map(p => p.familia).filter(Boolean))).sort() as string[];
    }, [products, selectedPlanta]);

    // Handle Status Filter Change
    const handleStatusChange = (status: StatusFilter) => {
        setStatusFilter(status);
        // When changing status filter, reset phase selection if not compatible
        if (status === 'won' || status === 'lost') {
            setSelectedPhase(null);
        }
        onFilterChange({
            channelId: selectedChannel,
            subclassificationId: selectedSubclass,
            segmentId: selectedSegment,
            phaseId: null,
            statusFilter: status,
            startDate,
            endDate,
            startClosingDate,
            endClosingDate,
            origin: selectedOrigin,
            planta: selectedPlanta,
            familia: selectedFamilia
        });
    };

    // Handle Changes
    const handleChannelChange = (valRaw: string) => {
        const val = valRaw || null;
        setSelectedChannel(val);
        setSelectedSubclass(null);
        setSelectedSegment(null);
        setSelectedPhase(null);

        onFilterChange({
            channelId: val,
            subclassificationId: null,
            segmentId: null,
            phaseId: null,
            statusFilter,
            startDate,
            endDate,
            startClosingDate,
            endClosingDate,
            origin: selectedOrigin,
            planta: selectedPlanta,
            familia: selectedFamilia
        });
    };

    const handleSubclassChange = (valRaw: string) => {
        const val = valRaw ? Number(valRaw) : null;
        setSelectedSubclass(val);
        setSelectedSegment(null);

        onFilterChange({
            channelId: selectedChannel,
            subclassificationId: val,
            segmentId: null,
            phaseId: selectedPhase,
            statusFilter,
            startDate,
            endDate,
            startClosingDate,
            endClosingDate,
            origin: selectedOrigin,
            planta: selectedPlanta,
            familia: selectedFamilia
        });
    };

    const handleSegmentChange = (valRaw: string) => {
        const val = valRaw ? Number(valRaw) : null;
        setSelectedSegment(val);
        onFilterChange({
            channelId: selectedChannel,
            subclassificationId: selectedSubclass,
            segmentId: val,
            phaseId: selectedPhase,
            statusFilter,
            startDate,
            endDate,
            startClosingDate,
            endClosingDate,
            origin: selectedOrigin,
            planta: selectedPlanta,
            familia: selectedFamilia
        });
    };

    const handlePhaseChange = (valRaw: string) => {
        const val = valRaw ? Number(valRaw) : null;
        setSelectedPhase(val);
        // When selecting a specific phase, set status to all or open
        if (val) {
            setStatusFilter('open');
        }
        onFilterChange({
            channelId: selectedChannel,
            subclassificationId: selectedSubclass,
            segmentId: selectedSegment,
            phaseId: val,
            statusFilter: val ? 'open' : statusFilter,
            startDate,
            endDate,
            startClosingDate,
            endClosingDate,
            origin: selectedOrigin,
            planta: selectedPlanta,
            familia: selectedFamilia
        });
    };

    const handleOriginChange = (valRaw: string) => {
        const val = valRaw || null;
        setSelectedOrigin(val);
        onFilterChange({
            channelId: selectedChannel,
            subclassificationId: selectedSubclass,
            segmentId: selectedSegment,
            phaseId: selectedPhase,
            statusFilter,
            startDate,
            endDate,
            startClosingDate,
            endClosingDate,
            origin: val,
            planta: selectedPlanta,
            familia: selectedFamilia
        });
    };

    const handlePlantaChange = (valRaw: string) => {
        const val = valRaw || null;
        setSelectedPlanta(val);
        let nextFamilia = selectedFamilia;
        if (val && selectedFamilia) {
            const familyBelongs = products.some(p => p.planta?.toLowerCase() === val.toLowerCase() && p.familia?.toLowerCase() === selectedFamilia.toLowerCase());
            if (!familyBelongs) {
                nextFamilia = null;
                setSelectedFamilia(null);
            }
        }
        onFilterChange({
            channelId: selectedChannel,
            subclassificationId: selectedSubclass,
            segmentId: selectedSegment,
            phaseId: selectedPhase,
            statusFilter,
            startDate,
            endDate,
            startClosingDate,
            endClosingDate,
            origin: selectedOrigin,
            planta: val,
            familia: nextFamilia
        });
    };

    const handleFamiliaChange = (valRaw: string) => {
        const val = valRaw || null;
        setSelectedFamilia(val);
        onFilterChange({
            channelId: selectedChannel,
            subclassificationId: selectedSubclass,
            segmentId: selectedSegment,
            phaseId: selectedPhase,
            statusFilter,
            startDate,
            endDate,
            startClosingDate,
            endClosingDate,
            origin: selectedOrigin,
            planta: selectedPlanta,
            familia: val
        });
    };

    const clearFilters = () => {
        setSelectedChannel(null);
        setSelectedSubclass(null);
        setSelectedSegment(null);
        setSelectedPhase(null);
        setStatusFilter('open');
        setSelectedOrigin(null);
        setSelectedPlanta(null);
        setSelectedFamilia(null);
        setStartDate(null);
        setEndDate(null);
        setStartClosingDate(null);
        setEndClosingDate(null);
        onFilterChange({
            channelId: null,
            subclassificationId: null,
            segmentId: null,
            phaseId: null,
            statusFilter: 'open',
            startDate: null,
            endDate: null,
            startClosingDate: null,
            endClosingDate: null,
            origin: null,
            planta: null,
            familia: null
        });
    };

    const hasActiveFilters = selectedChannel || selectedSubclass || selectedSegment || selectedPhase || selectedOrigin || selectedPlanta || selectedFamilia || statusFilter !== 'open' || startDate || endDate || startClosingDate || endClosingDate;

    if (loadingMetadata) return <div className="text-xs text-slate-400">Cargando filtros...</div>;

    return (
        <div data-testid="opportunities-filters" className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
                {/* Status Filter Pills - Quick access to closed states */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                        data-testid="opportunities-filter-status-all"
                        onClick={() => handleStatusChange('all')}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                            statusFilter === 'all'
                                ? "bg-white text-slate-800 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <CircleDot className="w-3 h-3" />
                        Todas
                    </button>
                    <button
                        data-testid="opportunities-filter-status-open"
                        onClick={() => handleStatusChange('open')}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                            statusFilter === 'open'
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <CircleDot className="w-3 h-3" />
                        Abiertas
                    </button>
                    <button
                        data-testid="opportunities-filter-status-won"
                        onClick={() => handleStatusChange('won')}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                            statusFilter === 'won'
                                ? "bg-emerald-500 text-white shadow-sm"
                                : "text-slate-500 hover:text-emerald-600"
                        )}
                    >
                        <Trophy className="w-3 h-3" />
                        Ganadas
                    </button>
                    <button
                        data-testid="opportunities-filter-status-lost"
                        onClick={() => handleStatusChange('lost')}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                            statusFilter === 'lost'
                                ? "bg-red-500 text-white shadow-sm"
                                : "text-slate-500 hover:text-red-600"
                        )}
                    >
                        <XCircle className="w-3 h-3" />
                        Perdidas
                    </button>
                </div>

                {/* Date Filters */}
                <div className="flex flex-wrap items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 bg-white shadow-sm overflow-x-auto whitespace-nowrap">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Creación:</span>
                        <input
                            type="date"
                            className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                            value={startDate || ""}
                            onChange={(e) => {
                                const val = e.target.value || null;
                                setStartDate(val);
                                onFilterChange({
                                    channelId: selectedChannel,
                                    subclassificationId: selectedSubclass,
                                    segmentId: selectedSegment,
                                    phaseId: selectedPhase,
                                    statusFilter,
                                    startDate: val,
                                    endDate,
                                    startClosingDate,
                                    endClosingDate,
                                    origin: selectedOrigin,
                                    planta: selectedPlanta,
                                    familia: selectedFamilia
                                });
                            }}
                        />
                        <span className="text-slate-300 text-xs text-center min-w-[12px]">-</span>
                        <input
                            type="date"
                            className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                            value={endDate || ""}
                            onChange={(e) => {
                                const val = e.target.value || null;
                                setEndDate(val);
                                onFilterChange({
                                    channelId: selectedChannel,
                                    subclassificationId: selectedSubclass,
                                    segmentId: selectedSegment,
                                    phaseId: selectedPhase,
                                    statusFilter,
                                    startDate,
                                    endDate: val,
                                    startClosingDate,
                                    endClosingDate,
                                    origin: selectedOrigin,
                                    planta: selectedPlanta,
                                    familia: selectedFamilia
                                });
                            }}
                        />
                    </div>

                    <div className="w-px h-6 bg-slate-200 mx-1"></div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Cierre:</span>
                        <input
                            type="date"
                            className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                            value={startClosingDate || ""}
                            onChange={(e) => {
                                const val = e.target.value || null;
                                setStartClosingDate(val);
                                onFilterChange({
                                    channelId: selectedChannel,
                                    subclassificationId: selectedSubclass,
                                    segmentId: selectedSegment,
                                    phaseId: selectedPhase,
                                    statusFilter,
                                    startDate,
                                    endDate,
                                    startClosingDate: val,
                                    endClosingDate,
                                    origin: selectedOrigin,
                                    planta: selectedPlanta,
                                    familia: selectedFamilia
                                });
                            }}
                        />
                        <span className="text-slate-300 text-xs text-center min-w-[12px]">-</span>
                        <input
                            type="date"
                            className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                            value={endClosingDate || ""}
                            onChange={(e) => {
                                const val = e.target.value || null;
                                setEndClosingDate(val);
                                onFilterChange({
                                    channelId: selectedChannel,
                                    subclassificationId: selectedSubclass,
                                    segmentId: selectedSegment,
                                    phaseId: selectedPhase,
                                    statusFilter,
                                    startDate,
                                    endDate,
                                    startClosingDate,
                                    endClosingDate: val,
                                    origin: selectedOrigin,
                                    planta: selectedPlanta,
                                    familia: selectedFamilia
                                });
                            }}
                        />
                    </div>
                </div>

                {/* Hierarchical Filters */}
                <div className="flex flex-wrap items-center gap-2 border border-slate-200 rounded-lg px-2.5 py-1 bg-white shadow-sm">
                    <Filter className="w-4 h-4 text-slate-400 shrink-0" />

                    {/* Channel Select */}
                    <div className="w-[175px]">
                        <SearchableSelect
                            compact
                            dataTestId="opportunities-filter-channel"
                            value={selectedChannel || ""}
                            onChange={handleChannelChange}
                            placeholder="Todos los Canales"
                            searchPlaceholder="Buscar canal..."
                            triggerClassName="min-h-0 h-8 border-none bg-transparent px-1 py-0 text-sm font-medium text-slate-700 focus:ring-0 shadow-none"
                            options={channels.map(c => ({
                                value: c.id,
                                label: c.nombre || c.id,
                                searchValue: c.id,
                            }))}
                        />
                    </div>

                    {/* Separator if Channel Selected */}
                    {selectedChannel && (
                        <>
                            <span className="text-slate-300">|</span>

                            {/* Subclassification Select */}
                            <div className="w-[155px]">
                                <SearchableSelect
                                    compact
                                    dataTestId="opportunities-filter-subclass"
                                    value={selectedSubclass ? String(selectedSubclass) : ""}
                                    onChange={handleSubclassChange}
                                    placeholder="Todos los Tipos"
                                    searchPlaceholder="Buscar tipo..."
                                    triggerClassName="min-h-0 h-8 border-none bg-transparent px-1 py-0 text-sm text-slate-700 focus:ring-0 shadow-none"
                                    options={availableSubclasses.map(s => ({
                                        value: String(s.id),
                                        label: s.nombre,
                                    }))}
                                />
                            </div>

                            <span className="text-slate-300">|</span>

                            {/* Segment Select */}
                            <div className="w-[160px]">
                                <SearchableSelect
                                    compact
                                    dataTestId="opportunities-filter-segment"
                                    value={selectedSegment ? String(selectedSegment) : ""}
                                    onChange={handleSegmentChange}
                                    placeholder="Todos los Segmentos"
                                    searchPlaceholder="Buscar segmento..."
                                    triggerClassName="min-h-0 h-8 border-none bg-transparent px-1 py-0 text-sm text-slate-700 focus:ring-0 shadow-none"
                                    options={availableSegments.map(s => ({
                                        value: String(s.id),
                                        label: s.nombre,
                                    }))}
                                />
                            </div>

                            <span className="text-slate-300">|</span>

                            {/* Phase Select - Only show when status is 'all' or 'open' */}
                            {(statusFilter === 'all' || statusFilter === 'open') && (
                                <div className="w-[165px]">
                                    <SearchableSelect
                                        compact
                                        dataTestId="opportunities-filter-phase"
                                        value={selectedPhase ? String(selectedPhase) : ""}
                                        onChange={handlePhaseChange}
                                        placeholder="Todas las Etapas"
                                        searchPlaceholder="Buscar etapa..."
                                        triggerClassName="min-h-0 h-8 border-none bg-transparent px-1 py-0 text-sm text-slate-700 focus:ring-0 shadow-none"
                                        options={availablePhases.map(p => ({
                                            value: String(p.id),
                                            label: p.nombre,
                                        }))}
                                    />
                                </div>
                            )}

                            {/* Show closed status badge when won/lost selected */}
                            {(statusFilter === 'won' || statusFilter === 'lost') && (
                                <span className={cn(
                                    "px-2 py-0.5 rounded text-xs font-medium",
                                    statusFilter === 'won' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                )}>
                                    {statusFilter === 'won' ? 'Cerrada Ganada' : 'Cerrada Perdida'}
                                </span>
                            )}
                        </>
                    )}
                </div>

                {/* Origin Filter */}
                <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1 bg-white shadow-sm">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-tight shrink-0">Origen:</span>
                    <div className="w-[165px]">
                        <SearchableSelect
                            compact
                            dataTestId="opportunities-filter-origin"
                            value={selectedOrigin || ""}
                            onChange={handleOriginChange}
                            placeholder="Todos los Orígenes"
                            searchPlaceholder="Buscar origen..."
                            triggerClassName="min-h-0 h-8 border-none bg-transparent px-1 py-0 text-sm font-medium text-slate-700 focus:ring-0 shadow-none"
                            options={origins.map(o => ({
                                value: o.codigo,
                                label: o.nombre,
                                searchValue: o.codigo,
                            }))}
                        />
                    </div>
                </div>

                {/* Planta Filter */}
                <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1 bg-white shadow-sm">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-tight shrink-0">Planta:</span>
                    <div className="w-[155px]">
                        <SearchableSelect
                            compact
                            dataTestId="opportunities-filter-planta"
                            value={selectedPlanta || ""}
                            onChange={handlePlantaChange}
                            placeholder="Todas las Plantas"
                            searchPlaceholder="Buscar planta..."
                            triggerClassName="min-h-0 h-8 border-none bg-transparent px-1 py-0 text-sm font-medium text-slate-700 focus:ring-0 shadow-none"
                            options={availablePlants.map(p => ({
                                value: p,
                                label: p,
                            }))}
                        />
                    </div>
                </div>

                {/* Familia Filter */}
                <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1 bg-white shadow-sm">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-tight shrink-0">Familia:</span>
                    <div className="w-[185px]">
                        <SearchableSelect
                            compact
                            dataTestId="opportunities-filter-familia"
                            value={selectedFamilia || ""}
                            onChange={handleFamiliaChange}
                            placeholder="Todas las Familias"
                            searchPlaceholder="Buscar familia..."
                            triggerClassName="min-h-0 h-8 border-none bg-transparent px-1 py-0 text-sm font-medium text-slate-700 focus:ring-0 shadow-none"
                            options={availableFamilies.map(f => ({
                                value: f,
                                label: f,
                            }))}
                        />
                    </div>
                </div>

                {/* Clear Button */}
                {hasActiveFilters && (
                    <button
                        data-testid="opportunities-filter-clear"
                        onClick={clearFilters}
                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                        <X className="w-3 h-3" />
                        Limpiar filtros
                    </button>
                )}
            </div>
        </div>
    );
}
