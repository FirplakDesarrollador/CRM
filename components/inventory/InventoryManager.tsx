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
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<{ operacion: InventoryOperation; cantidad: number; estado: InventoryMovementStatus } | null>(null);
    const { products, isLoading: isSearching } = useProductSearch(search);
    const productIds = useMemo(() => Array.from(new Set([
        ...products.map(product => product.id),
        ...movements.map(movement => movement.producto_id),
    ])), [products, movements]);
    const { summary, refresh: refreshSummary } = useInventorySummary(productIds);

    const loadMovements = useCallback(async () => {
        const { data, error } = await supabase
            .from("CRM_InventarioMovimientos")
            .select("id, producto_id, operacion, cantidad, estado, referencia_tipo, referencia_id, notas, created_at, updated_at, producto:CRM_ListaDePrecios(numero_articulo, descripcion)")
            .order("created_at", { ascending: false })
            .limit(200);
        if (error) return alert(`No se pudo cargar el inventario: ${error.message}`);
        setMovements((data || []).map(row => ({ ...row, cantidad: Number(row.cantidad) })) as unknown as InventoryMovement[]);
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
        setEditDraft({ operacion: movement.operacion, cantidad: movement.cantidad, estado: movement.estado });
    };

    const saveEdit = async (movementId: string) => {
        if (!editDraft || editDraft.cantidad <= 0) return;
        setIsSaving(true);
        const { error } = await supabase
            .from("CRM_InventarioMovimientos")
            .update({ ...editDraft, updated_at: new Date().toISOString() })
            .eq("id", movementId);
        setIsSaving(false);
        if (error) return alert(`No se pudo editar el movimiento: ${error.message}`);
        setEditingId(null);
        setEditDraft(null);
        await Promise.all([loadMovements(), refreshSummary()]);
    };

    return (
        <div className="space-y-6">
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
                <h2 className="font-bold text-slate-900 text-lg">Registrar movimiento</h2>
                <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_180px_140px_1fr_auto] gap-3 items-end">
                    <div className="relative">
                        <label className="text-xs font-bold text-slate-500">PRODUCTO</label>
                        <div className="relative mt-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><input value={selectedProduct ? `${selectedProduct.numero_articulo} - ${selectedProduct.descripcion}` : search} onChange={event => { setSelectedProduct(null); setSearch(event.target.value); }} className="w-full pl-9 pr-3 py-2 border rounded-lg" placeholder="Buscar producto..." /></div>
                        {!selectedProduct && search.length >= 2 && <div className="absolute z-20 top-full left-0 right-0 bg-white border rounded-xl shadow-xl max-h-56 overflow-auto mt-1">{isSearching ? <div className="p-3 text-sm text-slate-500">Buscando...</div> : products.map(product => <button type="button" key={product.id} onClick={() => { setSelectedProduct(product); setSearch(""); }} className="w-full text-left p-3 hover:bg-slate-50 border-b"><div className="font-semibold text-sm">{product.descripcion}</div><div className="font-mono text-xs text-slate-500">{product.numero_articulo}</div></button>)}</div>}
                    </div>
                    <label className="text-xs font-bold text-slate-500">OPERACION<select value={operation} onChange={event => setOperation(event.target.value as InventoryOperation)} className="w-full mt-1 p-2 border rounded-lg bg-white text-sm">{Object.entries(OPERATION_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></label>
                    <label className="text-xs font-bold text-slate-500">CANTIDAD<input type="number" min="0.01" step="0.01" value={quantity} onChange={event => setQuantity(Number(event.target.value))} className="w-full mt-1 p-2 border rounded-lg text-sm" /></label>
                    <label className="text-xs font-bold text-slate-500">NOTAS<input value={notes} onChange={event => setNotes(event.target.value)} className="w-full mt-1 p-2 border rounded-lg text-sm" placeholder="Motivo o referencia" /></label>
                    <button onClick={() => void saveMovement()} disabled={!selectedProduct || quantity <= 0 || isSaving} className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold disabled:opacity-50 flex items-center gap-2">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Registrar</button>
                </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {summary.filter(item => item.entradas || item.salidas || item.reservas).map(item => (
                    <div key={item.producto_id} className="bg-white border border-slate-200 rounded-xl p-4">
                        <div className="font-mono text-xs font-bold text-slate-500">{item.numero_articulo}</div>
                        <div className="font-semibold text-sm text-slate-800 line-clamp-2 min-h-10">{item.descripcion}</div>
                        <div className="grid grid-cols-3 gap-2 mt-3 text-center"><div><b className="block text-emerald-700">{item.existencia_fisica}</b><span className="text-[10px] text-slate-500">Fisico</span></div><div><b className="block text-amber-700">{item.reservas}</b><span className="text-[10px] text-slate-500">Reserva</span></div><div><b className="block text-blue-700">{item.disponible}</b><span className="text-[10px] text-slate-500">Disponible</span></div></div>
                    </div>
                ))}
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b"><h2 className="font-bold text-slate-900 text-lg">Log de movimientos</h2><p className="text-sm text-slate-500">Las ediciones conservan su auditoria en la base de datos.</p></div>
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-3 text-left">Fecha</th><th className="p-3 text-left">Producto</th><th className="p-3">Operacion</th><th className="p-3">Cantidad</th><th className="p-3">Estado</th><th className="p-3 text-left">Notas</th><th className="p-3">Acciones</th></tr></thead><tbody className="divide-y">
                    {movements.map(movement => {
                        const meta = OPERATION_META[movement.operacion];
                        const Icon = meta.icon;
                        const isEditing = editingId === movement.id && editDraft;
                        return <tr key={movement.id} className={movement.estado === "CANCELADO" ? "opacity-50" : ""}>
                            <td className="p-3 whitespace-nowrap text-xs text-slate-500">{new Date(movement.created_at).toLocaleString("es-CO")}</td>
                            <td className="p-3"><div className="font-semibold">{movement.producto?.descripcion}</div><div className="font-mono text-xs text-slate-500">{movement.producto?.numero_articulo}</div></td>
                            <td className="p-3 text-center">{isEditing ? <select value={editDraft.operacion} onChange={event => setEditDraft({ ...editDraft, operacion: event.target.value as InventoryOperation })} className="border rounded p-1">{Object.entries(OPERATION_META).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select> : <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${meta.className}`}><Icon className="w-3 h-3" />{meta.label}</span>}</td>
                            <td className="p-3 text-center">{isEditing ? <input type="number" min="0.01" step="0.01" value={editDraft.cantidad} onChange={event => setEditDraft({ ...editDraft, cantidad: Number(event.target.value) })} className="w-20 border rounded p-1" /> : movement.cantidad}</td>
                            <td className="p-3 text-center">{isEditing ? <select value={editDraft.estado} onChange={event => setEditDraft({ ...editDraft, estado: event.target.value as InventoryMovementStatus })} className="border rounded p-1"><option value="ACTIVO">Activo</option><option value="CANCELADO">Cancelado</option></select> : movement.estado}</td>
                            <td className="p-3 max-w-xs truncate">{movement.notas || "-"}</td>
                            <td className="p-3"><div className="flex justify-center gap-1">{isEditing ? <><button onClick={() => void saveEdit(movement.id)} className="p-2 bg-emerald-100 text-emerald-700 rounded"><Save className="w-4 h-4" /></button><button onClick={() => { setEditingId(null); setEditDraft(null); }} className="p-2 bg-slate-100 text-slate-600 rounded"><X className="w-4 h-4" /></button></> : <button onClick={() => beginEdit(movement)} className="p-2 bg-blue-100 text-blue-700 rounded"><Pencil className="w-4 h-4" /></button>}</div></td>
                        </tr>;
                    })}
                </tbody></table></div>
            </section>
        </div>
    );
}

