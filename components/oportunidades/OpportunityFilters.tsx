import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Filter, X, ChevronDown, Check, CircleDot, Trophy, XCircle } from "lucide-react";
import { cn } from "@/components/ui/utils";

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

// Status filter type - includes both open stages and closed states
type StatusFilter = 'all' | 'open' | 'won' | 'lost';

interface OpportunityFiltersProps {
    onFilterChange: (filters: {
        channelId: string | null;
        subclassificationId: number | null;
        segmentId: number | null;
        phaseId: number | null;
        statusFilter: StatusFilter;
    }) => void;
}

export function OpportunityFilters({ onFilterChange }: OpportunityFiltersProps) {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [subclasses, setSubclasses] = useState<Subclasificacion[]>([]);
    const [segments, setSegments] = useState<Segment[]>([]);
    const [phases, setPhases] = useState<Phase[]>([]);

    // Selection state
    const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
    const [selectedSubclass, setSelectedSubclass] = useState<number | null>(null);
    const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
    const [selectedPhase, setSelectedPhase] = useState<number | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    const [loadingMetadata, setLoadingMetadata] = useState(true);

    // Initial Load
    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const [phasesRes, chanRes, subRes, segRes] = await Promise.all([
                    supabase.from('CRM_FasesOportunidad').select('id, nombre, canal_id, probability').eq('is_active', true),
                    supabase.from('CRM_Canales').select('id, nombre').order('nombre'),
                    supabase.from('CRM_Subclasificacion').select('*'),
                    supabase.from('CRM_Segmentos').select('*')
                ]);

                if (phasesRes.data) setPhases(phasesRes.data);
                if (subRes.data) setSubclasses(subRes.data);
                if (segRes.data) setSegments(segRes.data);

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

            } catch (err) {
                console.error("Error loading filter metadata", err);
            } finally {
                setLoadingMetadata(false);
            }
        };

        loadMetadata();
    }, []);

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
            statusFilter: status
        });
    };

    // Handle Changes
    const handleChannelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value || null;
        setSelectedChannel(val);
        setSelectedSubclass(null);
        setSelectedSegment(null);
        setSelectedPhase(null);

        onFilterChange({
            channelId: val,
            subclassificationId: null,
            segmentId: null,
            phaseId: null,
            statusFilter
        });
    };

    const handleSubclassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value ? Number(e.target.value) : null;
        setSelectedSubclass(val);
        setSelectedSegment(null);

        onFilterChange({
            channelId: selectedChannel,
            subclassificationId: val,
            segmentId: null,
            phaseId: selectedPhase,
            statusFilter
        });
    };

    const handleSegmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value ? Number(e.target.value) : null;
        setSelectedSegment(val);
        onFilterChange({
            channelId: selectedChannel,
            subclassificationId: selectedSubclass,
            segmentId: val,
            phaseId: selectedPhase,
            statusFilter
        });
    };

    const handlePhaseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value ? Number(e.target.value) : null;
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
            statusFilter: val ? 'open' : statusFilter
        });
    };

    const clearFilters = () => {
        setSelectedChannel(null);
        setSelectedSubclass(null);
        setSelectedSegment(null);
        setSelectedPhase(null);
        setStatusFilter('all');
        onFilterChange({ channelId: null, subclassificationId: null, segmentId: null, phaseId: null, statusFilter: 'all' });
    };

    const hasActiveFilters = selectedChannel || selectedSubclass || selectedSegment || selectedPhase || statusFilter !== 'all';

    if (loadingMetadata) return <div className="text-xs text-slate-400">Cargando filtros...</div>;

    return (
        <div data-testid="opportunities-filters" className="flex flex-wrap items-center gap-3">
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

            {/* Hierarchical Filters */}
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
                <Filter className="w-4 h-4 text-slate-400" />

                {/* Channel Select */}
                <select
                    data-testid="opportunities-filter-channel"
                    className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer text-slate-700 font-medium max-w-[180px]"
                    value={selectedChannel || ""}
                    onChange={handleChannelChange}
                >
                    <option value="">Todos los Canales</option>
                    {channels.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                </select>

                {/* Separator if Channel Selected */}
                {selectedChannel && (
                    <>
                        <span className="text-slate-300">|</span>

                        {/* Subclassification Select */}
                        <select
                            data-testid="opportunities-filter-subclass"
                            className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer text-slate-700 max-w-[160px]"
                            value={selectedSubclass || ""}
                            onChange={handleSubclassChange}
                        >
                            <option value="">Todos los Tipos</option>
                            {availableSubclasses.map(s => (
                                <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                        </select>

                        <span className="text-slate-300">|</span>

                        {/* Segment Select */}
                        <select
                            data-testid="opportunities-filter-segment"
                            className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer text-slate-700 max-w-[160px]"
                            value={selectedSegment || ""}
                            onChange={handleSegmentChange}
                        >
                            <option value="">Todos los Segmentos</option>
                            {availableSegments.map(s => (
                                <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                        </select>

                        <span className="text-slate-300">|</span>

                        {/* Phase Select - Only show when status is 'all' or 'open' */}
                        {(statusFilter === 'all' || statusFilter === 'open') && (
                            <select
                                data-testid="opportunities-filter-phase"
                                className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer text-slate-700 max-w-[160px]"
                                value={selectedPhase || ""}
                                onChange={handlePhaseChange}
                            >
                                <option value="">Todas las Etapas</option>
                                {availablePhases.map(p => (
                                    <option key={p.id} value={p.id}>{p.nombre}</option>
                                ))}
                            </select>
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
    );
}
