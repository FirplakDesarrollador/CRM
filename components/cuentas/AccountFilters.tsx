import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Filter, X, CircleDot, Medal } from "lucide-react";
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

interface AccountFiltersProps {
    onFilterChange: (filters: {
        channelId: string | null;
        subclassificationId: number | null;
        nivelPremium: string | null;
        startDate: string | null;
        endDate: string | null;
    }) => void;
    initialChannelId?: string | null;
    initialNivelPremium?: string | null;
    initialDates?: {
        startDate: string | null;
        endDate: string | null;
    };
}

export function AccountFilters({ onFilterChange, initialChannelId, initialNivelPremium, initialDates }: AccountFiltersProps) {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [subclasses, setSubclasses] = useState<Subclasificacion[]>([]);

    // Selection state
    const [selectedChannel, setSelectedChannel] = useState<string | null>(initialChannelId || null);
    const [selectedSubclass, setSelectedSubclass] = useState<number | null>(null);
    const [selectedNivel, setSelectedNivel] = useState<string | null>(initialNivelPremium || null);

    const [startDate, setStartDate] = useState<string | null>(initialDates?.startDate || null);
    const [endDate, setEndDate] = useState<string | null>(initialDates?.endDate || null);

    const [loadingMetadata, setLoadingMetadata] = useState(true);

    // Initial Load
    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const [chanRes, subRes] = await Promise.all([
                    supabase.from('CRM_Canales').select('id, nombre').order('nombre'),
                    supabase.from('CRM_Subclasificacion').select('*')
                ]);

                if (chanRes.data) setChannels(chanRes.data);
                if (subRes.data) setSubclasses(subRes.data);

                if (initialChannelId || initialNivelPremium || initialDates) {
                    onFilterChange({
                        channelId: initialChannelId || null,
                        subclassificationId: null,
                        nivelPremium: initialNivelPremium || null,
                        startDate: initialDates?.startDate || null,
                        endDate: initialDates?.endDate || null
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

    const availableSubclasses = useMemo(() => {
        if (!selectedChannel) return [];
        return subclasses.filter(s => s.canal_id === selectedChannel);
    }, [selectedChannel, subclasses]);

    const handleChannelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value || null;
        setSelectedChannel(val);
        setSelectedSubclass(null);

        onFilterChange({
            channelId: val,
            subclassificationId: null,
            nivelPremium: selectedNivel,
            startDate,
            endDate
        });
    };

    const handleSubclassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value ? Number(e.target.value) : null;
        setSelectedSubclass(val);

        onFilterChange({
            channelId: selectedChannel,
            subclassificationId: val,
            nivelPremium: selectedNivel,
            startDate,
            endDate
        });
    };

    const handleNivelChange = (nivel: string | null) => {
        setSelectedNivel(nivel);
        onFilterChange({
            channelId: selectedChannel,
            subclassificationId: selectedSubclass,
            nivelPremium: nivel,
            startDate,
            endDate
        });
    };

    const clearFilters = () => {
        setSelectedChannel(null);
        setSelectedSubclass(null);
        setSelectedNivel(null);
        setStartDate(null);
        setEndDate(null);
        onFilterChange({ 
            channelId: null, 
            subclassificationId: null, 
            nivelPremium: null,
            startDate: null,
            endDate: null
        });
    };

    const hasActiveFilters = selectedChannel || selectedSubclass || selectedNivel || startDate || endDate;

    if (loadingMetadata) return <div className="text-xs text-slate-400">Cargando filtros...</div>;

    return (
        <div data-testid="accounts-filters" className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
                {/* Nivel Premium Pills */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                        onClick={() => handleNivelChange(null)}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                            selectedNivel === null
                                ? "bg-white text-slate-800 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <CircleDot className="w-3 h-3" />
                        Todos
                    </button>
                    <button
                        onClick={() => handleNivelChange('PREMIUM')}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                            selectedNivel === 'PREMIUM'
                                ? "bg-amber-500 text-white shadow-sm"
                                : "text-slate-500 hover:text-amber-600"
                        )}
                    >
                        <Medal className="w-3 h-3" />
                        Premium
                    </button>
                    <button
                        onClick={() => handleNivelChange('DESTACADO')}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                            selectedNivel === 'DESTACADO'
                                ? "bg-slate-500 text-white shadow-sm"
                                : "text-slate-500 hover:text-slate-600"
                        )}
                    >
                        <Medal className="w-3 h-3" />
                        Destacado
                    </button>
                    <button
                        onClick={() => handleNivelChange('ACTIVO')}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                            selectedNivel === 'ACTIVO'
                                ? "bg-orange-500 text-white shadow-sm"
                                : "text-slate-500 hover:text-orange-600"
                        )}
                    >
                        <Medal className="w-3 h-3" />
                        Activo
                    </button>
                </div>

                {/* Date Filters */}
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 bg-white shadow-sm">
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
                                nivelPremium: selectedNivel,
                                startDate: val,
                                endDate
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
                                nivelPremium: selectedNivel,
                                startDate,
                                endDate: val
                            });
                        }}
                    />
                </div>

                {/* Hierarchical Filters */}
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                        className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer text-slate-700 font-medium max-w-[180px]"
                        value={selectedChannel || ""}
                        onChange={handleChannelChange}
                    >
                        <option value="">Todos los Canales</option>
                        {channels.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                    </select>

                    {selectedChannel && (
                        <>
                            <span className="text-slate-300">|</span>
                            <select
                                className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer text-slate-700 max-w-[160px]"
                                value={selectedSubclass || ""}
                                onChange={handleSubclassChange}
                            >
                                <option value="">Todos los Tipos</option>
                                {availableSubclasses.map(s => (
                                    <option key={s.id} value={s.id}>{s.nombre}</option>
                                ))}
                            </select>
                        </>
                    )}
                </div>

                {/* Clear Button */}
                {hasActiveFilters && (
                    <button
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
