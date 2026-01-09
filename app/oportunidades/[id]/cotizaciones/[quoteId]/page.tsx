"use client";

import { useParams } from "next/navigation";
import { useQuotes, useQuoteItems } from "@/lib/hooks/useOpportunities";
import { useProductSearch, PriceListProduct } from "@/lib/hooks/useProducts";
import { DetailHeader } from "@/components/ui/DetailHeader";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { db, LocalQuote } from "@/lib/db";
import { Save, AlertTriangle, Truck, Receipt, Calendar, Search, Plus, Trash2, Loader2, Package } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useLiveQuery } from "dexie-react-hooks";

export default function QuoteEditorPage() {
    const params = useParams();
    const quoteId = params.quoteId as string;
    const oppId = params.id as string;

    const { quotes, updateQuote, updateQuoteTotal } = useQuotes(oppId);
    const quote = quotes?.find(q => q.id === quoteId);

    const [activeSection, setActiveSection] = useState<'items' | 'sap'>('items');

    if (!quote) return <div className="p-8">Cargando cotización...</div>;

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <DetailHeader
                title={`Editor: ${quote.numero_cotizacion}`}
                subtitle="Borrador"
                status={quote.status}
                backHref={`/oportunidades/${oppId}`}
            />

            <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

                {/* Section Tabs */}
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                    <button
                        onClick={() => setActiveSection('items')}
                        className={cn(
                            "flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2",
                            activeSection === 'items' ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <Package className="w-4 h-4" />
                        Ítems y Productos
                    </button>
                    <button
                        onClick={() => setActiveSection('sap')}
                        className={cn(
                            "flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2",
                            activeSection === 'sap' ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        Datos SAP <Truck className="w-4 h-4" />
                    </button>
                </div>

                {activeSection === 'items' && (
                    <QuoteItemsEditor
                        quote={quote}
                        onItemsChange={() => updateQuoteTotal(quoteId)}
                    />
                )}

                {activeSection === 'sap' && (
                    <SapDataEditor
                        quote={quote}
                        onSave={async (updates) => {
                            // Si se guardan datos SAP, asumimos que se convierte en Pedido
                            const isComplete = Boolean(updates.fecha_facturacion && updates.tipo_facturacion);

                            await updateQuote(quoteId, {
                                ...updates,
                                status: isComplete ? 'WINNER' : quote.status,
                                es_pedido: isComplete ? true : quote.es_pedido,
                                is_winner: isComplete ? true : quote.is_winner
                            });

                            // Si se convierte en pedido, podríamos forzar sincronización extra o notificar
                            if (isComplete && !quote.es_pedido) {
                                alert("¡Cotización convertida en Pedido!");
                            }
                        }}
                    />
                )}

            </div>
        </div>
    );
}

function QuoteItemsEditor({ quote, onItemsChange }: { quote: LocalQuote, onItemsChange: () => void }) {
    const { items, addItem, updateItem, removeItem } = useQuoteItems(quote.id);
    const [searchTerm, setSearchTerm] = useState("");
    const { products: searchResults, isLoading: isSearching } = useProductSearch(searchTerm);

    // Contexto de Canal y Oportunidad
    const context = useLiveQuery(async () => {
        const opp = await db.opportunities.get(quote.opportunity_id);
        if (!opp) return null;
        const acc = await db.accounts.get(opp.account_id);
        return { channel: acc?.canal_id || 'DIST_NAC' };
    });

    const handleAddProduct = async (product: PriceListProduct) => {
        const channel = context?.channel || 'DIST_NAC';
        let price = 0;

        // Selección de precio según canal
        switch (channel) {
            case 'OBRAS_NAC':
                price = product.lista_base_obras || 0;
                break;
            case 'OBRAS_INT':
            case 'DIST_INT':
                price = product.lista_base_exportaciones || 0;
                break;
            case 'DIST_NAC':
                price = product.lista_base_cop || 0;
                break;
            case 'PROPIO':
                price = product.distribuidor_pvp_iva || 0;
                break;
            default:
                price = product.lista_base_cop || 0;
        }

        // Fallback robusto if 0
        if (price === 0) price = product.lista_base_cop || 0;

        await addItem(quote.id, {
            producto_id: product.id,
            descripcion_linea: product.descripcion,
            cantidad: 1,
            precio_unitario: price,
            subtotal: price
        });
        setSearchTerm("");
        onItemsChange();
    };

    const handleRemove = async (itemId: string) => {
        await removeItem(itemId);
        onItemsChange();
    };

    const handleUpdateQty = async (itemId: string, qty: number) => {
        await updateItem(itemId, { cantidad: Math.max(1, qty) });
        onItemsChange();
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg">Productos de la Cotización</h3>
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Canal: {context?.channel}</span>
                        <div className="text-2xl font-black text-blue-600">
                            {quote.currency_id} {new Intl.NumberFormat(quote.currency_id === 'USD' ? 'en-US' : 'es-CO', { style: 'currency', currency: quote.currency_id || 'COP' }).format(quote.total_amount || 0)}
                        </div>
                    </div>
                </div>

                {/* Add Product Search */}
                <div className="relative mb-6">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                        placeholder="Buscar más productos para agregar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    {searchTerm && (
                        <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto overflow-x-hidden">
                            {isSearching ? (
                                <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Buscando en lista de precios...
                                </div>
                            ) : searchResults.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">No se encontraron productos</div>
                            ) : (
                                searchResults.map((product) => {
                                    const displayPrice = quote.currency_id === 'USD'
                                        ? product.lista_base_exportaciones
                                        : (product.lista_base_cop || product.pvp_sin_iva);

                                    return (
                                        <button
                                            key={product.id}
                                            onClick={() => handleAddProduct(product)}
                                            className="w-full text-left px-5 py-4 hover:bg-blue-50 flex items-center justify-between border-b border-slate-50 last:border-0 transition-colors"
                                        >
                                            <div className="max-w-[70%]">
                                                <div className="font-semibold text-slate-900 line-clamp-2 leading-tight">{product.descripcion}</div>
                                                <div className="text-xs text-slate-500 mt-1">{product.numero_articulo}</div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-sm font-bold text-slate-900 whitespace-nowrap">
                                                    {quote.currency_id} {new Intl.NumberFormat(quote.currency_id === 'USD' ? 'en-US' : 'es-CO', { style: 'currency', currency: quote.currency_id || 'COP' }).format(displayPrice || 0)}
                                                </div>
                                                <div className="p-2 bg-blue-100 text-blue-700 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                    <Plus className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* Items List */}
                <div className="space-y-3">
                    {(!items || items.length === 0) ? (
                        <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                            No hay productos agregados.
                        </div>
                    ) : (
                        items.map((item) => (
                            <div key={item.id} className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all group">
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-slate-800 line-clamp-2 leading-tight">{item.descripcion_linea}</h4>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Precio unitario: ${new Intl.NumberFormat().format(item.precio_unitario)}
                                    </p>
                                </div>
                                <div className="flex items-center justify-between md:justify-end gap-6">
                                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                                        <button
                                            onClick={() => handleUpdateQty(item.id, item.cantidad - 1)}
                                            className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                                        >
                                            -
                                        </button>
                                        <input
                                            type="number"
                                            value={item.cantidad}
                                            onChange={(e) => handleUpdateQty(item.id, parseInt(e.target.value) || 0)}
                                            onBlur={(e) => {
                                                const val = parseInt(e.target.value);
                                                if (isNaN(val) || val < 1) handleUpdateQty(item.id, 1);
                                            }}
                                            className="w-12 text-center font-bold text-slate-800 bg-transparent border-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <button
                                            onClick={() => handleUpdateQty(item.id, item.cantidad + 1)}
                                            className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                                        >
                                            +
                                        </button>
                                    </div>
                                    <div className="min-w-[120px] text-right">
                                        <div className="text-xs text-slate-400 uppercase font-bold text-[9px]">Subtotal</div>
                                        <div className="font-bold text-slate-900">
                                            ${new Intl.NumberFormat().format(item.subtotal)}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemove(item.id)}
                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// SAP Data Form
function SapDataEditor({ quote, onSave }: { quote: LocalQuote, onSave: (d: Partial<LocalQuote>) => void }) {
    const { register, handleSubmit, formState: { isDirty } } = useForm({
        defaultValues: {
            fecha_facturacion: quote.fecha_facturacion,
            tipo_facturacion: quote.tipo_facturacion,
            orden_compra: quote.orden_compra,
            incoterm: quote.incoterm,
            notas_sap: quote.notas_sap,
            es_muestra: quote.es_muestra
        }
    });

    return (
        <form onSubmit={handleSubmit(onSave)} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-4 p-3 bg-orange-50 text-orange-800 rounded-lg text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p>Estos datos son obligatorios para marcar la cotización como ganadora y generar el pedido en SAP.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" /> Fecha Facturación
                    </label>
                    <input type="date" {...register("fecha_facturacion")} className="w-full mt-1 p-2 border rounded-lg" />
                </div>

                <div>
                    <label className="text-sm font-medium flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-slate-400" /> Tipo Facturación
                    </label>
                    <select {...register("tipo_facturacion")} className="w-full mt-1 p-2 border rounded-lg">
                        <option value="">Seleccione...</option>
                        <option value="Standard">Estándar</option>
                        <option value="Anticipo">Anticipo</option>
                    </select>
                </div>

                <div className="md:col-span-2">
                    <label className="text-sm font-medium">Orden de Compra / Referencia Cliente</label>
                    <input {...register("orden_compra")} className="w-full mt-1 p-2 border rounded-lg" placeholder="Ej. OC-12345" />
                </div>

                <div className="md:col-span-2">
                    <label className="text-sm font-medium">Notas Integración SAP</label>
                    <textarea {...register("notas_sap")} className="w-full mt-1 p-2 border rounded-lg" rows={3} />
                </div>
            </div>

            <div className="pt-4 border-t flex justify-end">
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-700">
                    <Save className="w-4 h-4" />
                    Guardar Datos SAP
                </button>
            </div>
        </form>
    );
}
