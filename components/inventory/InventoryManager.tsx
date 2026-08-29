"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    ArrowDownToLine,
    ArrowUpFromLine,
    Bookmark,
    Briefcase,
    ExternalLink,
    Loader2,
    Pencil,
    Plus,
    Save,
    Search,
    X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProductSearch, type PriceListProduct } from "@/lib/hooks/useProducts";
import {
    createInventoryMovement,
    enrichMovementsWithOpportunities,
    extractOpportunityIdsFromMovements,
    fetchOpportunitiesForMovements,
    type InventoryMovement,
    type InventoryMovementStatus,
    type InventoryOperation,
    useInventorySummary,
} from "@/lib/hooks/useInventory";

const OPERATION_META: Record<InventoryOperation, { label: string; icon: typeof Plus; className: string }> = {
    ENTRADA: { label: "Entrada", icon: ArrowDownToLine, className: "bg-emerald-100 text-emerald-700" },
    SALIDA: { label: "Salida", icon: ArrowUpFromLine, className: "bg-rose-100 text-rose-700" },
    RESERVA: { label: "Reserva", icon: Bookmark, className: "bg-amber-100 text-amber-700" },
};

interface OppSearchResult {
    id: string;
    nombre: string;
    canal_id?: string | null;
}

export function InventoryManager() {
    const [search, setSearch] = useState("");
    const [selectedProduct, setSelectedProduct] = useState<PriceListProduct | null>(null);
    const [operation, setOperation] = useState<InventoryOperation>("ENTRADA");
    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingMovements, setIsLoadingMovements] = useState(true);
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [movementFilter, setMovementFilter] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<{ operacion: InventoryOperation; cantidad: number; estado: InventoryMovementStatus } | null>(null);

    // Opportunity Selector state
    const [oppSearch, setOppSearch] = useState("");
    const [selectedOpp, setSelectedOpp] = useState<OppSearchResult | null>(null);
    const [oppSearchResults, setOppSearchResults] = useState<OppSearchResult[]>([]);
    const [isSearchingOpp, setIsSearchingOpp] = useState(false);

    const { products, isLoading: isSearching } = useProductSearch(search);
    const { summary, refresh: refreshSummary } = useInventorySummary();

    // Debounced search for opportunities
    useEffect(() => {
        if (!oppSearch || oppSearch.trim().length < 2) {
            setOppSearchResults([]);
            return;
        }

        let isCurrent = true;
        setIsSearchingOpp(true);

        const timer = setTimeout(async () => {
            try {
                const { data, error } = await supabase
                    .from("CRM_Oportunidades")
                    .select("id, nombre, canal_id")
                    .ilike("nombre", `%${oppSearch.trim()}%`)
                    .limit(8);

                if (!error && isCurrent && data) {
                    setOppSearchResults(
                        data.map(d => ({
                            id: d.id,
                            nombre: d.nombre || "Oportunidad sin nombre",
                            canal_id: d.canal_id,
                        }))
                    );
                }
            } catch (err) {
                console.error("Error buscando oportunidades:", err);
            } finally {
                if (isCurrent) setIsSearchingOpp(false);
            }
        }, 250);

        return () => {
            isCurrent = false;
            clearTimeout(timer);
        };
    }, [oppSearch]);

    const loadMovements = useCallback(async () => {
        setIsLoadingMovements(true);
        try {
            const { data, error } = await supabase
                .from("CRM_InventarioMovimientos")
                .select("id, producto_id, operacion, cantidad, estado, referencia_tipo, referencia_id, notas, created_at, updated_at, producto:CRM_ListaDePrecios(numero_articulo, descripcion)")
                .order("created_at", { ascending: false })
                .limit(200);

            if (error) {
                console.error("Error al cargar movimientos:", error);
                return;
            }

            const parsed = (data || []).map(row => ({
                ...row,
                cantidad: Number(row.cantidad) || 0,
                producto: Array.isArray(row.producto) ? row.producto[0] : row.producto,
            })) as unknown as InventoryMovement[];

            const oppIds = extractOpportunityIdsFromMovements(parsed);
            const oppMap = await fetchOpportunitiesForMovements(oppIds);
            const enriched = enrichMovementsWithOpportunities(parsed, oppMap);

            setMovements(enriched);
        } catch (err) {
            console.error("Excepción cargando movimientos:", err);
        } finally {
            setIsLoadingMovements(false);
        }
    }, []);

    useEffect(() => {
        void loadMovements();
    }, [loadMovements]);

    const saveMovement = async () => {
        if (!selectedProduct || quantity <= 0) return;
        setIsSaving(true);
        try {
            await createInventoryMovement({
                producto_id: selectedProduct.id,
                operacion: operation,
                cantidad: quantity,
                referencia_tipo: selectedOpp ? "OPORTUNIDAD" : null,
                referencia_id: selectedOpp ? selectedOpp.id : null,
                notas: notes || null,
            });
            setSelectedProduct(null);
            setSearch("");
            setSelectedOpp(null);
            setOppSearch("");
            setQuantity(1);
            setNotes("");
            await Promise.all([loadMovements(), refreshSummary()]);
        } catch (error) {
            alert(error instanceof Error ? error.message : "No se pudo registrar el movimiento");
        } finally {
            setIsSaving(false);
        }
    };

    const beginEdit = (movement: InventoryMovement) => {
        setEditingId(movement.id);
        setEditDraft({ operacion: movement.operacion || "ENTRADA", cantidad: movement.cantidad, estado: movement.estado || "ACTIVO" });
    };

    const saveEdit = async (movementId: string) => {
        if (!editDraft || editDraft.cantidad <= 0) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from("CRM_InventarioMovimientos")
                .update({ ...editDraft, updated_at: new Date().toISOString() })
                .eq("id", movementId);

            if (error) throw error;
            setEditingId(null);
            setEditDraft(null);
            await Promise.all([loadMovements(), refreshSummary()]);
        } catch (error) {
            alert(error instanceof Error ? error.message : "No se pudo editar el movimiento");
        } finally {
            setIsSaving(false);
        }
    };

    const activeSummary = useMemo(() => {
        return summary.filter(item => (item.existencia_fisica > 0 || item.reservas > 0 || item.disponible > 0 || item.entradas > 0 || item.salidas > 0));
    }, [summary]);

    // Map of product ID to linked opportunities
    const productOppsMap = useMemo(() => {
        const map = new Map<string, Array<{ id: string; nombre: string; operacion: InventoryOperation; cantidad: number }>>();
        for (const m of movements) {
            if (m.estado === "ACTIVO") {
                const oppId = m.oportunidad?.id || m.referencia_id;
                const oppNombre = m.oportunidad?.nombre || (m.referencia_id ? `Oportunidad (${m.referencia_id.slice(0, 8)})` : null);
                if (oppId && oppNombre) {
                    const list = map.get(m.producto_id) || [];
                    if (!list.some(item => item.id === oppId && item.operacion === m.operacion)) {
                        list.push({
                            id: oppId,
                            nombre: oppNombre,
                            operacion: m.operacion,
                            cantidad: m.cantidad,
                        });
                    }
                    map.set(m.producto_id, list);
                }
            }
        }
        return map;
    }, [movements]);

    // Filtered movements for the log table
    const filteredMovements = useMemo(() => {
        if (!movementFilter.trim()) return movements;
        const q = movementFilter.toLowerCase().trim();
        return movements.filter(m => {
            const prodDesc = m.producto?.descripcion?.toLowerCase() || "";
            const prodNum = m.producto?.numero_articulo?.toLowerCase() || "";
            const oppName = m.oportunidad?.nombre?.toLowerCase() || "";
            const note = m.notas?.toLowerCase() || "";
            return prodDesc.includes(q) || prodNum.includes(q) || oppName.includes(q) || note.includes(q);
        });
    }, [movements, movementFilter]);

    return (
        <div className="space-y-6">
            {/* Formulario de registro */}
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
                <h2 className="font-bold text-slate-900 text-lg">Registrar movimiento</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.3fr_1.1fr_130px_110px_1fr_auto] gap-3 items-end">
                    {/* Buscador de producto */}
                    <div className="relative">
                        <label className="text-xs font-bold text-slate-500">PRODUCTO *</label>
                        <div className="relative mt-1">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                value={selectedProduct ? `${selectedProduct.numero_articulo} - ${selectedProduct.descripcion}` : search}
                                onChange={event => { setSelectedProduct(null); setSearch(event.target.value); }}
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                                placeholder="Buscar producto..."
                            />
                            {selectedProduct && (
                                <button
                                    type="button"
                                    onClick={() => { setSelectedProduct(null); setSearch(""); }}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        {!selectedProduct && search.length >= 2 && (
                            <div className="absolute z-30 top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-auto mt-1">
                                {isSearching ? (
                                    <div className="p-3 text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Buscando...</div>
                                ) : products.length > 0 ? (
                                    products.map(product => (
                                        <button
                                            type="button"
                                            key={product.id}
                                            onClick={() => { setSelectedProduct(product); setSearch(""); }}
                                            className="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                                        >
                                            <div className="font-semibold text-sm text-slate-800">{product.descripcion}</div>
                                            <div className="font-mono text-xs text-cyan-700 font-bold">{product.numero_articulo}</div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-3 text-sm text-slate-400">No se encontraron productos</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Selector de oportunidad asociada */}
                    <div className="relative">
                        <label className="text-xs font-bold text-slate-500">OPORTUNIDAD ASOCIADA (OPCIONAL)</label>
                        <div className="relative mt-1">
                            <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                value={selectedOpp ? selectedOpp.nombre : oppSearch}
                                onChange={event => { setSelectedOpp(null); setOppSearch(event.target.value); }}
                                className="w-full pl-9 pr-7 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                placeholder="Vincular a oportunidad..."
                            />
                            {selectedOpp && (
                                <button
                                    type="button"
                                    onClick={() => { setSelectedOpp(null); setOppSearch(""); }}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        {!selectedOpp && oppSearch.trim().length >= 2 && (
                            <div className="absolute z-30 top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-auto mt-1">
                                {isSearchingOpp ? (
                                    <div className="p-3 text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Buscando oportunidad...</div>
                                ) : oppSearchResults.length > 0 ? (
                                    oppSearchResults.map(opp => (
                                        <button
                                            type="button"
                                            key={opp.id}
                                            onClick={() => { setSelectedOpp(opp); setOppSearch(""); }}
                                            className="w-full text-left p-2.5 hover:bg-indigo-50/50 border-b border-slate-100 last:border-0 transition-colors"
                                        >
                                            <div className="font-semibold text-sm text-slate-800">{opp.nombre}</div>
                                            {opp.canal_id && <div className="text-[10px] text-slate-400 uppercase font-medium">{opp.canal_id}</div>}
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-3 text-sm text-slate-400">No se encontraron oportunidades</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Operación */}
                    <label className="text-xs font-bold text-slate-500">
                        OPERACION *
                        <select value={operation} onChange={event => setOperation(event.target.value as InventoryOperation)} className="w-full mt-1 p-2 border border-slate-300 rounded-lg bg-white text-sm">
                            {Object.entries(OPERATION_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                        </select>
                    </label>

                    {/* Cantidad */}
                    <label className="text-xs font-bold text-slate-500">
                        CANTIDAD *
                        <input type="number" min="0.01" step="0.01" value={quantity} onChange={event => setQuantity(Number(event.target.value))} className="w-full mt-1 p-2 border border-slate-300 rounded-lg text-sm" />
                    </label>

                    {/* Notas */}
                    <label className="text-xs font-bold text-slate-500">
                        NOTAS
                        <input value={notes} onChange={event => setNotes(event.target.value)} className="w-full mt-1 p-2 border border-slate-300 rounded-lg text-sm" placeholder="Motivo o referencia" />
                    </label>

                    <button
                        onClick={() => void saveMovement()}
                        disabled={!selectedProduct || quantity <= 0 || isSaving}
                        className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold disabled:opacity-50 flex items-center gap-2 transition whitespace-nowrap"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Registrar
                    </button>
                </div>
            </section>

            {/* Resumen de inventario con Oportunidades asociadas */}
            {activeSummary.length > 0 && (
                <section className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Productos con existencias o reservas activas ({activeSummary.length})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        {activeSummary.map(item => {
                            const linkedOpps = productOppsMap.get(item.producto_id) || [];
                            return (
                                <div key={item.producto_id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow transition-shadow flex flex-col justify-between">
                                    <div>
                                        <div className="font-mono text-xs font-bold text-cyan-700">{item.numero_articulo}</div>
                                        <div className="font-semibold text-sm text-slate-800 line-clamp-2 min-h-10 mt-0.5">{item.descripcion}</div>
                                        <div className="grid grid-cols-3 gap-2 mt-3 text-center bg-slate-50 rounded-lg p-2">
                                            <div><b className="block text-emerald-700 text-base">{item.existencia_fisica}</b><span className="text-[10px] text-slate-500 font-medium">Físico</span></div>
                                            <div><b className="block text-amber-700 text-base">{item.reservas}</b><span className="text-[10px] text-slate-500 font-medium">Reserva</span></div>
                                            <div><b className="block text-blue-700 text-base">{item.disponible}</b><span className="text-[10px] text-slate-500 font-medium">Disponible</span></div>
                                        </div>
                                    </div>

                                    {/* Oportunidades vinculadas a este producto */}
                                    {linkedOpps.length > 0 && (
                                        <div className="mt-3 pt-2.5 border-t border-slate-100">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Oportunidades asociadas:</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {linkedOpps.map(oppItem => (
                                                    <Link
                                                        key={`${oppItem.id}-${oppItem.operacion}`}
                                                        href={`/oportunidades/${oppItem.id}`}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold border border-indigo-200/80 transition-colors group"
                                                        title={`Ver oportunidad: ${oppItem.nombre} (${oppItem.operacion}: ${oppItem.cantidad})`}
                                                    >
                                                        <Briefcase className="w-3 h-3 text-indigo-500 group-hover:text-indigo-700 shrink-0" />
                                                        <span className="truncate max-w-[130px]">{oppItem.nombre}</span>
                                                        <ExternalLink className="w-2.5 h-2.5 text-indigo-400 group-hover:text-indigo-600 shrink-0 opacity-70 group-hover:opacity-100" />
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Log de movimientos */}
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="font-bold text-slate-900 text-lg">Log de movimientos</h2>
                        <p className="text-sm text-slate-500">Historial de entradas, salidas y reservas con vinculación a oportunidades.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative w-64">
                            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                value={movementFilter}
                                onChange={e => setMovementFilter(e.target.value)}
                                placeholder="Filtrar por oportunidad o producto..."
                                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        {isLoadingMovements && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                            <tr>
                                <th className="p-3 text-left">Fecha</th>
                                <th className="p-3 text-left">Producto</th>
                                <th className="p-3 text-center">Operación</th>
                                <th className="p-3 text-center">Cantidad</th>
                                <th className="p-3 text-center">Estado</th>
                                <th className="p-3 text-left">Oportunidad / Referencia</th>
                                <th className="p-3 text-left">Notas</th>
                                <th className="p-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredMovements.map(movement => {
                                const meta = OPERATION_META[movement.operacion] || OPERATION_META["ENTRADA"];
                                const Icon = meta?.icon || Plus;
                                const isEditing = editingId === movement.id && editDraft;
                                const prod = movement.producto as { descripcion?: string; numero_articulo?: string } | undefined;

                                return (
                                    <tr key={movement.id} className={`hover:bg-slate-50/70 transition-colors ${movement.estado === "CANCELADO" ? "opacity-50" : ""}`}>
                                        <td className="p-3 whitespace-nowrap text-xs text-slate-500">
                                            {movement.created_at ? new Date(movement.created_at).toLocaleString("es-CO") : "-"}
                                        </td>
                                        <td className="p-3 max-w-sm">
                                            <div className="font-semibold text-slate-800 line-clamp-1">{prod?.descripcion || "Producto no identificado"}</div>
                                            <div className="font-mono text-xs text-cyan-700">{prod?.numero_articulo || movement.producto_id}</div>
                                        </td>
                                        <td className="p-3 text-center">
                                            {isEditing ? (
                                                <select
                                                    value={editDraft.operacion}
                                                    onChange={event => setEditDraft({ ...editDraft, operacion: event.target.value as InventoryOperation })}
                                                    className="border border-slate-300 rounded p-1 text-xs"
                                                >
                                                    {Object.entries(OPERATION_META).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
                                                </select>
                                            ) : (
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${meta.className}`}>
                                                    <Icon className="w-3 h-3" />{meta.label}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center font-bold text-slate-800">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    min="0.01"
                                                    step="0.01"
                                                    value={editDraft.cantidad}
                                                    onChange={event => setEditDraft({ ...editDraft, cantidad: Number(event.target.value) })}
                                                    className="w-20 border border-slate-300 rounded p-1 text-center text-xs"
                                                />
                                            ) : (
                                                movement.cantidad
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            {isEditing ? (
                                                <select
                                                    value={editDraft.estado}
                                                    onChange={event => setEditDraft({ ...editDraft, estado: event.target.value as InventoryMovementStatus })}
                                                    className="border border-slate-300 rounded p-1 text-xs"
                                                >
                                                    <option value="ACTIVO">Activo</option>
                                                    <option value="CANCELADO">Cancelado</option>
                                                </select>
                                            ) : (
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${movement.estado === "ACTIVO" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"}`}>
                                                    {movement.estado}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 max-w-xs text-xs">
                                            {movement.oportunidad ? (
                                                <Link
                                                    href={`/oportunidades/${movement.oportunidad.id}`}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200 transition-colors group shadow-sm"
                                                    title={`Ver oportunidad: ${movement.oportunidad.nombre}`}
                                                >
                                                    <Briefcase className="w-3.5 h-3.5 text-indigo-500 group-hover:text-indigo-700 shrink-0" />
                                                    <span className="truncate max-w-[160px]">{movement.oportunidad.nombre}</span>
                                                    <ExternalLink className="w-3 h-3 text-indigo-400 group-hover:text-indigo-600 shrink-0" />
                                                </Link>
                                            ) : movement.referencia_id ? (
                                                <Link
                                                    href={`/oportunidades/${movement.referencia_id}`}
                                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-mono text-[11px] border border-slate-200 hover:border-indigo-200 transition-colors group"
                                                    title={`Ver oportunidad: ${movement.referencia_id}`}
                                                >
                                                    <Briefcase className="w-3 h-3 text-slate-400 group-hover:text-indigo-500 shrink-0" />
                                                    <span>{movement.referencia_tipo ? `${movement.referencia_tipo}: ` : "Ref: "}{movement.referencia_id.slice(0, 8)}...</span>
                                                    <ExternalLink className="w-2.5 h-2.5 text-slate-400 group-hover:text-indigo-500 shrink-0" />
                                                </Link>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="p-3 max-w-xs text-xs text-slate-600 truncate" title={movement.notas || ""}>
                                            {movement.notas || "-"}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex justify-center gap-1">
                                                {isEditing ? (
                                                    <>
                                                        <button type="button" onClick={() => void saveEdit(movement.id)} className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded transition" title="Guardar">
                                                            <Save className="w-4 h-4" />
                                                        </button>
                                                        <button type="button" onClick={() => { setEditingId(null); setEditDraft(null); }} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition" title="Cancelar">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button type="button" onClick={() => beginEdit(movement)} className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition" title="Editar">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredMovements.length === 0 && !isLoadingMovements && (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-400">
                                        {movements.length === 0 ? "No hay movimientos de inventario registrados." : "No se encontraron movimientos que coincidan con el filtro."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

