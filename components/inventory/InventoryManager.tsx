"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Bookmark, Loader2, Pencil, Plus, Save, Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProductSearch, type PriceListProduct } from "@/lib/hooks/useProducts";
import {
    createInventoryMovement,
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

export function InventoryManager() {
    const [search, setSearch] = useState("");
    const [selectedProduct, setSelectedProduct] = useState<PriceListProduct | null>(null);
    const [operation, setOperation] = useState<InventoryOperation>("ENTRADA");
    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingMovements, setIsLoadingMovements] = useState(true);
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<{ operacion: InventoryOperation; cantidad: number; estado: InventoryMovementStatus } | null>(null);
    
    const { products, isLoading: isSearching } = useProductSearch(search);
    const { summary, refresh: refreshSummary, isLoading: isLoadingSummary } = useInventorySummary();

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
                producto: Array.isArray(row.producto) ? row.producto[0] : row.producto
            })) as unknown as InventoryMovement[];

            setMovements(parsed);
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
            await createInventoryMovement({ producto_id: selectedProduct.id, operacion: operation, cantidad: quantity, notas: notes || null });
            setSelectedProduct(null);
            setSearch("");
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

    return (
        <div className="space-y-6">
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
                <h2 className="font-bold text-slate-900 text-lg">Registrar movimiento</h2>
                <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_180px_140px_1fr_auto] gap-3 items-end">
                    <div className="relative">
                        <label className="text-xs font-bold text-slate-500">PRODUCTO</label>
                        <div className="relative mt-1">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input 
                                value={selectedProduct ? `${selectedProduct.numero_articulo} - ${selectedProduct.descripcion}` : search} 
                                onChange={event => { setSelectedProduct(null); setSearch(event.target.value); }} 
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500 text-sm" 
                                placeholder="Buscar producto..." 
                            />
                        </div>
                        {!selectedProduct && search.length >= 2 && (
                            <div className="absolute z-20 top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-auto mt-1">
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
                    <label className="text-xs font-bold text-slate-500">
                        OPERACION
                        <select value={operation} onChange={event => setOperation(event.target.value as InventoryOperation)} className="w-full mt-1 p-2 border border-slate-300 rounded-lg bg-white text-sm">
                            {Object.entries(OPERATION_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                        </select>
                    </label>
                    <label className="text-xs font-bold text-slate-500">
                        CANTIDAD
                        <input type="number" min="0.01" step="0.01" value={quantity} onChange={event => setQuantity(Number(event.target.value))} className="w-full mt-1 p-2 border border-slate-300 rounded-lg text-sm" />
                    </label>
                    <label className="text-xs font-bold text-slate-500">
                        NOTAS
                        <input value={notes} onChange={event => setNotes(event.target.value)} className="w-full mt-1 p-2 border border-slate-300 rounded-lg text-sm" placeholder="Motivo o referencia" />
                    </label>
                    <button 
                        onClick={() => void saveMovement()} 
                        disabled={!selectedProduct || quantity <= 0 || isSaving} 
                        className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold disabled:opacity-50 flex items-center gap-2 transition"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Registrar
                    </button>
                </div>
            </section>

            {/* Resumen de inventario */}
            {activeSummary.length > 0 && (
                <section className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Productos con existencias o reservas activas ({activeSummary.length})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        {activeSummary.map(item => (
                            <div key={item.producto_id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow transition-shadow">
                                <div className="font-mono text-xs font-bold text-cyan-700">{item.numero_articulo}</div>
                                <div className="font-semibold text-sm text-slate-800 line-clamp-2 min-h-10 mt-0.5">{item.descripcion}</div>
                                <div className="grid grid-cols-3 gap-2 mt-3 text-center bg-slate-50 rounded-lg p-2">
                                    <div><b className="block text-emerald-700 text-base">{item.existencia_fisica}</b><span className="text-[10px] text-slate-500 font-medium">Físico</span></div>
                                    <div><b className="block text-amber-700 text-base">{item.reservas}</b><span className="text-[10px] text-slate-500 font-medium">Reserva</span></div>
                                    <div><b className="block text-blue-700 text-base">{item.disponible}</b><span className="text-[10px] text-slate-500 font-medium">Disponible</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Log de movimientos */}
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="font-bold text-slate-900 text-lg">Log de movimientos</h2>
                        <p className="text-sm text-slate-500">Historial de entradas, salidas y reservas con auditoría.</p>
                    </div>
                    {isLoadingMovements && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
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
                                <th className="p-3 text-left">Notas / Referencia</th>
                                <th className="p-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {movements.map(movement => {
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
                                        <td className="p-3 max-w-xs text-xs text-slate-600 truncate">
                                            {movement.notas || (movement.referencia_tipo ? `${movement.referencia_tipo}: ${movement.referencia_id || ""}` : "-")}
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
                            {movements.length === 0 && !isLoadingMovements && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400">
                                        No hay movimientos de inventario registrados.
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

