import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Filter, X, ChevronDown } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { matchesSearchTokens } from "@/lib/utils";
import { useFullCatalog } from "@/lib/hooks/useProducts";
import { buildPhaseFilterOptions } from "@/lib/opportunityPhaseListFilter";
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
    orden?: number | null;
    is_active?: boolean | null;
    probability?: number;
};

type Origin = {
    id: string;
    codigo: string;
    nombre: string;
    orden?: number;
    is_active?: boolean;
};

interface OpportunityFiltersProps {
    onFilterChange: (filters: {
        channelId: string | null;
        subclassificationId: number | null;
        segmentId: number | null;
        phaseIds: number[];
        startDate: string | null;
        endDate: string | null;
        startClosingDate: string | null;
        endClosingDate: string | null;
        origin: string | null;
        planta?: string | null;
        familia?: string | null;
        idFilter?: string | null;
    }) => void;
    initialChannelId?: string | null;
    initialSubclassId?: number | null;
    initialSegmentId?: number | null;
    initialPhaseIds?: number[];
    initialOrigin?: string | null;
    initialPlanta?: string | null;
    initialFamilia?: string | null;
    initialIdFilter?: string | null;
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
    initialPhaseIds,
    initialOrigin,
    initialPlanta,
    initialFamilia,
    initialIdFilter,
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
    const [selectedPhaseIds, setSelectedPhaseIds] = useState<number[]>(initialPhaseIds || []);
    const [phaseMenuOpen, setPhaseMenuOpen] = useState(false);
    const [phaseSearch, setPhaseSearch] = useState("");
    const phaseMenuRef = useRef<HTMLDivElement>(null);
    const [selectedOrigin, setSelectedOrigin] = useState<string | null>(initialOrigin || null);
    const [selectedPlanta, setSelectedPlanta] = useState<string | null>(initialPlanta || null);
    const [selectedFamilia, setSelectedFamilia] = useState<string | null>(initialFamilia || null);
    const [idFilter, setIdFilter] = useState<string | null>(initialIdFilter || null);
    const { products } = useFullCatalog();

    const [startDate, setStartDate] = useState<string | null>(initialDates?.startDate || null);
    const [endDate, setEndDate] = useState<string | null>(initialDates?.endDate || null);
    const [startClosingDate, setStartClosingDate] = useState<string | null>(initialDates?.startClosingDate || null);
    const [endClosingDate, setEndClosingDate] = useState<string | null>(initialDates?.endClosingDate || null);

    const [loadingMetadata, setLoadingMetadata] = useState(true);

    useEffect(() => {
        if (initialIdFilter !== undefined) {
            setIdFilter(initialIdFilter || null);
        }
    }, [initialIdFilter]);

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
        setSelectedPhaseIds(initialPhaseIds || []);
    }, [initialPhaseIds]);

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
                    supabase.from('CRM_FasesOportunidad').select('id, nombre, canal_id, orden, probability, is_active').eq('is_active', true),
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
                if (initialChannelId || initialSubclassId || initialSegmentId || (initialPhaseIds && initialPhaseIds.length > 0) || initialOrigin || initialPlanta || initialFamilia || initialIdFilter || initialDates) {
                    onFilterChange({
                        channelId: initialChannelId || null,
                        subclassificationId: initialSubclassId || null,
                        segmentId: initialSegmentId || null,
                        phaseIds: initialPhaseIds || [],
                        startDate: initialDates?.startDate || null,
                        endDate: initialDates?.endDate || null,
                        startClosingDate: initialDates?.startClosingDate || null,
                        endClosingDate: initialDates?.endClosingDate || null,
                        origin: initialOrigin || null,
                        planta: initialPlanta || null,
                        familia: initialFamilia || null,
                        idFilter: initialIdFilter || null
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

    const channelLabels = useMemo(() => {
        const labels: Record<string, string> = {};
        for (const channel of channels) {
            if (channel.id) labels[channel.id] = channel.nombre || channel.id;
        }
        return labels;
    }, [channels]);

    const phaseOptions = useMemo(
        () => buildPhaseFilterOptions(phases, selectedChannel, channelLabels),
        [phases, selectedChannel, channelLabels]
    );

    const visiblePhaseOptions = useMemo(() => {
        if (!phaseSearch.trim()) return phaseOptions;
        return phaseOptions.filter(option => matchesSearchTokens([option.label], phaseSearch));
    }, [phaseOptions, phaseSearch]);

    useEffect(() => {
        if (!phaseMenuOpen) return;
        const onPointerDown = (event: MouseEvent) => {
            if (phaseMenuRef.current && !phaseMenuRef.current.contains(event.target as Node)) {
                setPhaseMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [phaseMenuOpen]);

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

    const publishPhaseIds = (nextIds: number[]) => {
        setSelectedPhaseIds(nextIds);
        onFilterChange({
            channelId: selectedChannel,
            subclassificationId: selectedSubclass,
            segmentId: selectedSegment,
            phaseIds: nextIds,
            startDate,
            endDate,
            startClosingDate,
            endClosingDate,
            origin: selectedOrigin,
            planta: selectedPlanta,
            familia: selectedFamilia,
            idFilter
        });
    };

    const togglePhase = (phaseId: number) => {
        const nextIds = selectedPhaseIds.includes(phaseId)
            ? selectedPhaseIds.filter(id => id !== phaseId)
            : [...selectedPhaseIds, phaseId];
        publishPhaseIds(nextIds);
    };

    // Handle Changes
    const handleChannelChange = (valRaw: string) => {
        const val = valRaw || null;
        setSelectedChannel(val);
        setSelectedSubclass(null);
        setSelectedSegment(null);
        setSelectedPhaseIds([]);

        onFilterChange({
            channelId: val,
            subclassificationId: null,
            segmentId: null,
            phaseIds: [],
            startDate,
            endDate,
            startClosingDate,
            endClosingDate,
            origin: selectedOrigin,
            planta: selectedPlanta,
            familia: selectedFamilia,
            idFilter
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
            phaseIds: selectedPhaseIds,
            startDate,
            endDate,
            startClosingDate,
            endClosingDate,
            origin: selectedOrigin,
            planta: selectedPlanta,
            familia: selectedFamilia,
            idFilter
        });
    };

    const handleSegmentChange = (valRaw: string) => {
        const val = valRaw ? Number(valRaw) : null;
        setSelectedSegment(val);
        onFilterChange({
            channelId: selectedChannel,
            subclassificationId: selectedSubclass,
            segmentId: val,
            phaseIds: selectedPhaseIds,
            startDate,
            endDate,
            startClosingDate,
            endClosingDate,
            origin: selectedOrigin,
            planta: selectedPlanta,
            familia: selectedFamilia,
            idFilter
        });
    };

    const handleOriginChange = (valRaw: string) => {
        const val = valRaw || null;
        setSelectedOrigin(val);
        onFilterChange({
            channelId: selectedChannel,
            subclassificationId: selectedSubclass,
            segmentId: selectedSegment,
            phaseIds: selectedPhaseIds,
            startDate,
            endDate,
            startClosingDate,
            endClosingDate,
            origin: val,
            planta: selectedPlanta,
            familia: selectedFamilia,
            idFilter
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
            phaseIds: selectedPhaseIds,
            startDate,
            endDate,
            startClosingDate,
            endClosingDate,
            origin: selectedOrigin,
            planta: val,
            familia: nextFamilia,
            idFilter
        });
    };

    const handleFamiliaChange = (valRaw: string) => {
        const val = valRaw || null;
        setSelectedFamilia(val);
        onFilterChange({
            channelId: selectedChannel,
            subclassificationId: selectedSubclass,
            segmentId: selectedSegment,
            phaseIds: selectedPhaseIds,
            startDate,
            endDate,
            startClosingDate,
            endClosingDate,
            origin: selectedOrigin,
            planta: selectedPlanta,
            familia: val,
            idFilter
        });
    };

    const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value ? e.target.value.trim() : null;
        setIdFilter(val);
        onFilterChange({
            channelId: selectedChannel,
            subclassificationId: selectedSubclass,
            segmentId: selectedSegment,
            phaseIds: selectedPhaseIds,
            startDate,
            endDate,
            startClosingDate,
            endClosingDate,
            origin: selectedOrigin,
            planta: selectedPlanta,
            familia: selectedFamilia,
            idFilter: val
        });
    };

    const clearFilters = () => {
        setSelectedChannel(null);
        setSelectedSubclass(null);
        setSelectedSegment(null);
        setSelectedPhaseIds([]);
        setSelectedOrigin(null);
        setSelectedPlanta(null);
        setSelectedFamilia(null);
        setIdFilter(null);
        setStartDate(null);
        setEndDate(null);
        setStartClosingDate(null);
        setEndClosingDate(null);
        onFilterChange({
            channelId: null,
            subclassificationId: null,
            segmentId: null,
            phaseIds: [],
            startDate: null,
            endDate: null,
            startClosingDate: null,
            endClosingDate: null,
            origin: null,
            planta: null,
            familia: null,
            idFilter: null
        });
    };

    const hasActiveFilters = selectedChannel || selectedSubclass || selectedSegment || selectedPhaseIds.length > 0 || selectedOrigin || selectedPlanta || selectedFamilia || Boolean(idFilter) || startDate || endDate || startClosingDate || endClosingDate;

    if (loadingMetadata) return <div className="text-xs text-slate-400">Cargando filtros...</div>;

    return (
        <div data-testid="opportunities-filters" className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
            <div ref={phaseMenuRef} data-testid="opportunities-filter-phases" className="relative flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Fase:</span>
                <button
                    type="button"
                    data-testid="opportunities-filter-phase-trigger"
                    onClick={() => setPhaseMenuOpen(open => !open)}
                    className="text-sm font-medium text-slate-700 max-w-[220px] truncate flex items-center gap-1"
                >
                    <span className="truncate">
                        {selectedPhaseIds.length === 0
                            ? "Todas"
                            : phaseOptions
                                .filter(option => selectedPhaseIds.includes(option.id))
                                .map(option => option.label)
                                .join(", ") || `${selectedPhaseIds.length} fases`}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>
                {phaseMenuOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                        <input
                            type="text"
                            value={phaseSearch}
                            onChange={(e) => setPhaseSearch(e.target.value)}
                            placeholder="Buscar fase..."
                            className="mb-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
                        />
                        <div className="max-h-64 space-y-0.5 overflow-y-auto">
                            <button
                                type="button"
                                data-testid="opportunities-filter-phase-all"
                                onClick={() => publishPhaseIds([])}
                                className={cn(
                                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium",
                                    selectedPhaseIds.length === 0 ? "bg-blue-50 font-bold text-blue-700" : "text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <span>Todas</span>
                            </button>
                            {visiblePhaseOptions.map(option => {
                                const checked = selectedPhaseIds.includes(option.id);
                                return (
                                    <label
                                        key={option.id}
                                        className={cn(
                                            "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs",
                                            checked ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-700 hover:bg-slate-50"
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            data-testid={`opportunities-filter-phase-${option.id}`}
                                            checked={checked}
                                            onChange={() => togglePhase(option.id)}
                                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                                        />
                                        <span className="truncate">{option.label}</span>
                                    </label>
                                );
                            })}
                            {visiblePhaseOptions.length === 0 && (
                                <p className="px-2 py-3 text-center text-xs text-slate-400">No hay fases con ese nombre.</p>
                            )}
                        </div>
                    </div>
                )}
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

                {/* ID Filter */}
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">ID:</span>
                    <input
                        type="text"
                        data-testid="opportunities-filter-id"
                        placeholder="Buscar por ID..."
                        value={idFilter || ""}
                        onChange={handleIdChange}
                        className="text-sm bg-transparent border-none focus:ring-0 p-0 text-slate-700 font-medium w-36 placeholder:text-slate-400 placeholder:font-normal focus:outline-none"
                    />
                    {idFilter && (
                        <button
                            type="button"
                            onClick={() => {
                                setIdFilter(null);
                                onFilterChange({
                                    channelId: selectedChannel,
                                    subclassificationId: selectedSubclass,
                                    segmentId: selectedSegment,
                                    phaseIds: selectedPhaseIds,
                                    startDate,
                                    endDate,
                                    startClosingDate,
                                    endClosingDate,
                                    origin: selectedOrigin,
                                    planta: selectedPlanta,
                                    familia: selectedFamilia,
                                    idFilter: null
                                });
                            }}
                            className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Limpiar filtro de ID"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
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
