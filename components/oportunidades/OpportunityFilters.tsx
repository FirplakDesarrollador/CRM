import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Filter, X } from "lucide-react";
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
};

interface OpportunityFiltersProps {
    onFilterChange: (filters: {
        channelId: string | null;
        segmentId: number | null;
        phaseId: number | null;
    }) => void;
}

export function OpportunityFilters({ onFilterChange }: OpportunityFiltersProps) {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [subclasses, setSubclasses] = useState<Subclasificacion[]>([]);
    const [segments, setSegments] = useState<Segment[]>([]);
    const [phases, setPhases] = useState<Phase[]>([]);

    // Selection state
    const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
    const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
    const [selectedPhase, setSelectedPhase] = useState<number | null>(null);

    const [loadingMetadata, setLoadingMetadata] = useState(true);

    // Initial Load
    useEffect(() => {
        const loadMetadata = async () => {
            try {
                // Fetch Channels (Distinct from Fases or predefined)
                // We'll infer channels from Fases or define them if they are static.
                // Assuming we can get 'CRM_Subclasificaciones' distinct 'canal_id' or similar.

                // Let's fetch all relevant metadata once
                const [phasesRes, subRes, segRes] = await Promise.all([
                    supabase.from('CRM_FasesOportunidad').select('id, nombre, canal_id').eq('is_active', true),
                    supabase.from('CRM_Subclasificaciones').select('*'),
                    supabase.from('CRM_Segmentos').select('*')
                ]);

                if (phasesRes.data) setPhases(phasesRes.data);
                if (subRes.data) setSubclasses(subRes.data);
                if (segRes.data) setSegments(segRes.data);

                // Extract unique channels from phases
                const uniqueChannels = Array.from(new Set(phasesRes.data?.map(p => p.canal_id))).filter(Boolean);
                // Create basic channel objects (could be improved if we have a channels table)
                setChannels(uniqueChannels.map(c => ({ id: c, nombre: c })));

            } catch (err) {
                console.error("Error loading filter metadata", err);
            } finally {
                setLoadingMetadata(false);
            }
        };

        loadMetadata();
    }, []);

    // Derived options based on selection
    const availableSegments = useMemo(() => {
        if (!selectedChannel) return [];

        // Channel -> Subclass -> Segment
        const classIds = subclasses
            .filter(s => s.canal_id === selectedChannel)
            .map(s => s.id);

        return segments.filter(seg => classIds.includes(seg.subclasificacion_id));
    }, [selectedChannel, subclasses, segments]);

    const availablePhases = useMemo(() => {
        if (!selectedChannel) return [];
        return phases.filter(p => p.canal_id === selectedChannel);
    }, [selectedChannel, phases]);

    // Handle Changes
    const handleChannelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value || null;
        setSelectedChannel(val);
        setSelectedSegment(null); // Reset child
        setSelectedPhase(null); // Reset child

        onFilterChange({
            channelId: val,
            segmentId: null,
            phaseId: null
        });
    };

    const handleSegmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value ? Number(e.target.value) : null;
        setSelectedSegment(val);
        onFilterChange({
            channelId: selectedChannel,
            segmentId: val,
            phaseId: selectedPhase
        });
    };

    const handlePhaseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value ? Number(e.target.value) : null;
        setSelectedPhase(val);
        onFilterChange({
            channelId: selectedChannel,
            segmentId: selectedSegment,
            phaseId: val
        });
    };

    const clearFilters = () => {
        setSelectedChannel(null);
        setSelectedSegment(null);
        setSelectedPhase(null);
        onFilterChange({ channelId: null, segmentId: null, phaseId: null });
    };

    if (loadingMetadata) return <div className="text-xs text-slate-400">Cargando filtros...</div>;

    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
                <Filter className="w-4 h-4 text-slate-400" />

                {/* Channel Select */}
                <select
                    className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer text-slate-700 font-medium max-w-[140px]"
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
                    <span className="text-slate-300">|</span>
                )}

                {/* Segment Select */}
                {selectedChannel && (
                    <select
                        className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer text-slate-700 max-w-[140px]"
                        value={selectedSegment || ""}
                        onChange={handleSegmentChange}
                    >
                        <option value="">Todos los Segmentos</option>
                        {availableSegments.map(s => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                    </select>
                )}

                {/* Separator if Channel Selected */}
                {selectedChannel && (
                    <span className="text-slate-300">|</span>
                )}

                {/* Phase Select */}
                {selectedChannel && (
                    <select
                        className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer text-slate-700 max-w-[140px]"
                        value={selectedPhase || ""}
                        onChange={handlePhaseChange}
                    >
                        <option value="">Todas las Fases</option>
                        {availablePhases.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                    </select>
                )}
            </div>

            {(selectedChannel || selectedSegment || selectedPhase) && (
                <button
                    onClick={clearFilters}
                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                    <X className="w-3 h-3" />
                    Limpiar
                </button>
            )}
        </div>
    );
}
