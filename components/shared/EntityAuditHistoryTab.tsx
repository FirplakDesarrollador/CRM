import React, { useState } from 'react';
import { useEntityAuditHistory } from '@/lib/hooks/useEntityAuditHistory';
import { History, ArrowRight, User, Calendar, RefreshCw, Filter, Search } from 'lucide-react';

function formatTimestamp(isoString: string): string {
    try {
        const date = new Date(isoString);
        return date.toLocaleString('es-CO', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    } catch {
        return isoString;
    }
}

function getRelativeTime(isoString: string, now: number): string {
    try {
        const past = new Date(isoString).getTime();
        const diffSeconds = Math.floor((now - past) / 1000);

        if (diffSeconds < 60) return 'Hace unos segundos';
        const diffMinutes = Math.floor(diffSeconds / 60);
        if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `Hace ${diffHours} h`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 30) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
        return formatTimestamp(isoString);
    } catch {
        return isoString;
    }
}

interface EntityAuditHistoryTabProps {
    entityType: 'OPORTUNIDAD' | 'CUENTA' | 'CONTACTO';
    entityId: string;
    entityName?: string;
}

export function EntityAuditHistoryTab({
    entityType,
    entityId,
    entityName
}: EntityAuditHistoryTabProps) {
    const [now] = useState(() => Date.now());
    const { entries, isLoading, error, refetch } = useEntityAuditHistory({
        entityType,
        entityId,
        limit: 100
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedField, setSelectedField] = useState<string>('ALL');

    const fieldsList = Array.from(new Set(entries.map(e => e.field_label || e.field_name)));

    const filteredEntries = entries.filter(e => {
        const matchesField = selectedField === 'ALL' || (e.field_label || e.field_name) === selectedField;
        const matchesSearch = !searchTerm || 
            (e.field_label || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (e.changed_by_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (e.old_value || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (e.new_value || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesField && matchesSearch;
    });

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                        <History className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-800">
                            Historial de Modificaciones
                        </h3>
                        <p className="text-xs text-slate-500">
                            Trazabilidad y auditoría de cambios realizados en este registro
                            {entityName ? ` (${entityName})` : ''}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                        {entries.length} {entries.length === 1 ? 'cambio' : 'cambios'}
                    </span>
                    <button
                        onClick={() => refetch()}
                        disabled={isLoading}
                        title="Actualizar historial"
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                    {error}
                </div>
            )}

            {/* Controls */}
            {entries.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por usuario, campo o valor..."
                            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-700"
                        />
                    </div>

                    {fieldsList.length > 1 && (
                        <div className="relative flex items-center">
                            <Filter className="w-3.5 h-3.5 absolute left-2.5 text-slate-400" />
                            <select
                                value={selectedField}
                                onChange={(e) => setSelectedField(e.target.value)}
                                className="pl-8 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium cursor-pointer"
                            >
                                <option value="ALL">Todos los campos ({fieldsList.length})</option>
                                {fieldsList.map((f) => (
                                    <option key={f} value={f}>{f}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {/* Content List */}
            {isLoading && entries.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-xs text-slate-400 font-medium">Cargando trazabilidad de cambios...</p>
                </div>
            ) : filteredEntries.length === 0 ? (
                <div className="py-12 border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <div className="p-3 bg-slate-50 rounded-full text-slate-300">
                        <History className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                        {entries.length === 0 ? 'Sin modificaciones registradas' : 'No hay cambios que coincidan con la búsqueda'}
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm">
                        {entries.length === 0 
                            ? 'Los cambios futuros en estados, fases, vendedor asignado, importes o datos de contacto quedarán registrados aquí automáticamente con usuario, fecha y hora.'
                            : 'Prueba cambiando los términos del filtro o seleccionando "Todos los campos".'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredEntries.map((entry) => {
                        const relativeTime = getRelativeTime(entry.changed_at, now);
                        return (
                            <div 
                                key={entry.id}
                                className="p-4 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50/50 transition-colors shadow-xs space-y-3"
                            >
                                {/* Top metadata */}
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 uppercase tracking-wider">
                                            {entry.field_label || entry.field_name}
                                        </span>
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                            <User className="w-3.5 h-3.5 text-slate-400" />
                                            <span>{entry.changed_by_name || 'Usuario del sistema'}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        <span>{formatTimestamp(entry.changed_at)}</span>
                                        {relativeTime && (
                                            <span className="text-slate-400">({relativeTime})</span>
                                        )}
                                    </div>
                                </div>

                                {/* Value comparison */}
                                <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200/60 font-medium line-through max-w-md break-all">
                                        <span>{entry.old_value !== null && entry.old_value !== '' ? entry.old_value : '(Vacío)'}</span>
                                    </div>

                                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold max-w-md break-all">
                                        <span>{entry.new_value !== null && entry.new_value !== '' ? entry.new_value : '(Vacío)'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
