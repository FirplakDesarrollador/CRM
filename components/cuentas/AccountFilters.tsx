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

    const [selectedChannel, setSelectedChannel] = useState<string | null>(initialChannelId || null);
    const [selectedSubclass, setSelectedSubclass] = useState<number | null>(null);
    const [selectedNivel, setSelectedNivel] = useState<string | null>(initialNivelPremium || null);

    const [startDate, setStartDate] = useState<string | null>(initialDates?.startDate || null);
    const [endDate, setEndDate] = useState<string | null>(initialDates?.endDate || null);

    const [loadingMetadata, setLoadingMetadata] = useState(true);

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
        <div data-testid="accounts-filters" className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(360px,max-content)_minmax(290px,360px)_minmax(260px,1fr)_auto] lg:items-end">
                <div className="space-y-1">
                    <span className="block px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Nivel</span>
                    <div className="grid h-10 grid-cols-4 rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
                        <button
                            onClick={() => handleNivelChange(null)}
                            className={cn(
                                "flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-semibold transition-all",
                                selectedNivel === null
                                    ? "bg-slate-900 text-white shadow-sm"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                            )}
                        >
                            <CircleDot className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">Todos</span>
                        </button>
                        <button
                            onClick={() => handleNivelChange('PREMIUM')}
                            className={cn(
                                "flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-semibold transition-all",
                                selectedNivel === 'PREMIUM'
                                    ? "bg-amber-500 text-white shadow-sm"
                                    : "text-slate-500 hover:bg-amber-50 hover:text-amber-700"
                            )}
                        >
                            <Medal className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">Premium</span>
                        </button>
                        <button
                            onClick={() => handleNivelChange('DESTACADO')}
                            className={cn(
                                "flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-semibold transition-all",
                                selectedNivel === 'DESTACADO'
                                    ? "bg-slate-500 text-white shadow-sm"
                                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            )}
                        >
                            <Medal className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">Destacado</span>
                        </button>
                        <button
                            onClick={() => handleNivelChange('ACTIVO')}
                            className={cn(
                                "flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-semibold transition-all",
                                selectedNivel === 'ACTIVO'
                                    ? "bg-orange-500 text-white shadow-sm"
                                    : "text-slate-500 hover:bg-orange-50 hover:text-orange-700"
                            )}
                        >
                            <Medal className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">Activo</span>
                        </button>
                    </div>
                </div>

                <div className="space-y-1">
                    <span className="block px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Creacion</span>
                    <div className="flex h-10 items-center gap-2 rounded-lg bg-white px-2 shadow-sm ring-1 ring-slate-200">
                        <input
                            type="date"
                            className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-slate-50 px-2 text-sm text-slate-700 outline-none focus:border-blue-200 focus:bg-white focus:ring-1 focus:ring-blue-500"
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
                        <span className="text-xs text-slate-300">a</span>
                        <input
                            type="date"
                            className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-slate-50 px-2 text-sm text-slate-700 outline-none focus:border-blue-200 focus:bg-white focus:ring-1 focus:ring-blue-500"
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
                </div>

                <div className="space-y-1">
                    <span className="block px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Canal y tipo</span>
                    <div className="grid h-10 grid-cols-[1fr_1px_1fr] items-center rounded-lg bg-white px-2 shadow-sm ring-1 ring-slate-200">
                        <div className="flex min-w-0 items-center gap-2 pr-2">
                            <Filter className="h-4 w-4 shrink-0 text-slate-400" />
                            <select
                                className="min-w-0 flex-1 cursor-pointer border-none bg-transparent text-sm font-semibold text-slate-700 focus:ring-0"
                                value={selectedChannel || ""}
                                onChange={handleChannelChange}
                            >
                                <option value="">Todos los Canales</option>
                                {channels.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <span className="h-6 bg-slate-200" />
                        <select
                            className="min-w-0 cursor-pointer border-none bg-transparent pl-2 text-sm font-medium text-slate-700 focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-400"
                            value={selectedSubclass || ""}
                            onChange={handleSubclassChange}
                            disabled={!selectedChannel}
                        >
                            <option value="">Todos los Tipos</option>
                            {availableSubclasses.map(s => (
                                <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex h-full items-end">
                    {hasActiveFilters ? (
                        <button
                            onClick={clearFilters}
                            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 lg:w-auto"
                        >
                            <X className="h-3.5 w-3.5" />
                            Limpiar
                        </button>
                    ) : (
                        <div className="hidden h-10 min-w-20 lg:block" />
                    )}
                </div>
            </div>
        </div>
    );
}
