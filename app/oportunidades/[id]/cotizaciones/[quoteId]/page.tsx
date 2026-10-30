"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuotes, useQuoteItems } from "@/lib/hooks/useOpportunities";
import { useProductSearch, PriceListProduct } from "@/lib/hooks/useProducts";
import { DetailHeader } from "@/components/ui/DetailHeader";
import { generateQuotePdf } from "@/lib/pdfGenerator";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { db, LocalQuote } from "@/lib/db";
import { Save, AlertTriangle, Truck, Receipt, Calendar, Search, Plus, Trash2, Loader2, Package, Download, Send } from "lucide-react";
import { ExpandableTextarea } from "@/components/ui/ExpandableTextarea";
import { cn } from "@/components/ui/utils";
import { useLiveQuery } from "dexie-react-hooks";
import { useConfig } from "@/lib/hooks/useConfig";
import { SendQuoteModal } from "@/components/quotes/SendQuoteModal";
import { useCommissionCategories } from "@/lib/hooks/useCommissionCategories";
import { PedidosList } from "@/components/quotes/PedidosEditor";
import { isQuoteItemPriceEditable } from "@/lib/quotePricing";
import { getPriceClarification } from "@/lib/salesChannels";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import {
    appendNote,
    buildDiscountExceptionNote,
    canAuthorizeDiscountException,
    channelAllowsDiscountException,
    resolveDiscountChange
} from "@/lib/discountExceptions";

export default function QuoteEditorPage() {
    const params = useParams();
    const router = useRouter();
    const quoteId = params.quoteId as string;
    const oppId = params.id as string;

    const { quotes, updateQuote, updateQuoteTotal } = useQuotes(oppId);
    const quote = quotes?.find(q => q.id === quoteId);

    const [activeSection, setActiveSection] = useState<'items' | 'sap'>('items');
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);

    const sendContext = useLiveQuery(async () => {
        if (!quote) return null;
        const opp = await db.opportunities.get(quote.opportunity_id);
        const acc = opp ? await db.accounts.get(opp.account_id) : null;
        const qItems = await db.quoteItems.where('cotizacion_id').equals(quoteId).toArray();
        
        let advisorName = "";
        let enrichedItems = qItems;

        try {
            const { supabase } = await import('@/lib/supabase');
            if (opp?.owner_user_id) {
                const { data: uData } = await supabase.from('CRM_Usuarios').select('full_name').eq('id', opp.owner_user_id).single();
                advisorName = uData?.full_name || "";
            }
            const productIds = qItems.map(i => i.producto_id).filter(Boolean);
            if (productIds.length > 0) {
                const { data: pData } = await supabase.from('CRM_ListaDePrecios').select('id, numero_articulo').in('id', productIds);
                if (pData) {
                    enrichedItems = qItems.map(item => ({
                        ...item,
                        numero_articulo: pData.find(p => p.id === item.producto_id)?.numero_articulo || item.producto_id
                    }));
                }
            }
        } catch (e) {
            console.error("Error pre-fetching PDF data", e);
        }

        return { opp, acc, qItems: enrichedItems, advisorName };
    }, [quote]);

    const handleDownloadPdf = () => {
        if (!quote || !sendContext) return;
        generateQuotePdf(quote, sendContext.qItems, sendContext.acc, sendContext.opp, true, sendContext.advisorName);
    };

    if (!quote) return <div className="p-8">Cargando cotización...</div>;

    return (
        <div className="min-h-screen bg-slate-50 pb-24 overflow-x-hidden w-full">
            <DetailHeader
                title={`Editor: ${quote.numero_cotizacion}`}
                subtitle="Borrador"
                status={quote.status}
                onBack={() => {
                    if (activeSection === 'sap') {
                        setActiveSection('items');
                    } else {
                        router.push(`/oportunidades/${oppId}?tab=cotizaciones`);
                    }
                }}
                actions={[
                    { label: "Enviar Cotización", icon: Send, onClick: () => setIsSendModalOpen(true) },
                    { label: "Descargar PDF", icon: Download, onClick: handleDownloadPdf }
                ]}
            />

            <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 w-full">

                {/* Section Tabs */}
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                    <button
                        onClick={() => setActiveSection('items')}
                        className={cn(
                            "flex-1 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 sm:gap-2",
                            activeSection === 'items' ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Ítems y Productos
                    </button>
                    <button
                        onClick={() => setActiveSection('sap')}
                        className={cn(
                            "flex-1 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 sm:gap-2",
                            activeSection === 'sap' ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        Pedido <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                </div>

                {/* Shared Validation Banner */}
                <QuoteValidationBanner quote={quote} />


                {activeSection === 'items' && (
                    <QuoteItemsEditor
                        quote={quote}
                        onItemsChange={() => updateQuoteTotal(quoteId)}
                        onSaveQuote={(updates) => updateQuote(quoteId, updates)}
                    />
                )}

                {activeSection === 'sap' && (
                    <PedidosList quote={quote} />
                )}

                {isSendModalOpen && sendContext && (
                    <SendQuoteModal 
                        isOpen={isSendModalOpen} 
                        onClose={() => setIsSendModalOpen(false)} 
                        quote={quote} 
                        account={sendContext.acc || undefined} 
                        opportunity={sendContext.opp} 
                        quoteItems={sendContext.qItems}
                        advisorName={sendContext.advisorName}
                    />
                )}
            </div>
        </div>
    );
}

function QuoteItemsEditor({ quote, onItemsChange, onSaveQuote }: {
    quote: LocalQuote;
    onItemsChange: () => void;
    onSaveQuote: (updates: Partial<LocalQuote>) => Promise<void>;
}) {
    const { items, addItem, updateItem, removeItem } = useQuoteItems(quote.id);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPrefix, setSelectedPrefix] = useState<string>("");
    const { products: searchResults, isLoading: isSearching } = useProductSearch(searchTerm, selectedPrefix);
    const { data: categories } = useCommissionCategories();
    const [comentarios, setComentarios] = useState(quote.comentarios || "");
    const [isSaving, setIsSaving] = useState(false);
    const { user: currentUser, role: currentRole } = useCurrentUser();

    useEffect(() => {
        setComentarios(quote.comentarios || "");
    }, [quote.comentarios]);

    const handleSaveComments = async () => {
        if (comentarios === quote.comentarios) return;
        setIsSaving(true);
        try {
            await onSaveQuote({ comentarios });
        } catch (error) {
            console.error("Error saving quote comments:", error);
        } finally {
            setIsSaving(false);
        }
    };

    // Contexto de Canal y Oportunidad
    const context = useLiveQuery(async () => {
        const opp = await db.opportunities.get(quote.opportunity_id);
        if (!opp) return null;
        const acc = await db.accounts.get(opp.account_id);
        return { 
            channel: acc?.canal_id || 'DIST_NAC',
            ignorar_limites_descuento: acc?.ignorar_limites_descuento || false,
            accountId: opp.account_id as string | undefined,
            accountCached: !!acc
        };
    });

    // Si la cuenta no está en la caché local (la carga inicial no trae las ~50k cuentas),
    // el canal caía en 'DIST_NAC' y se usaban precios/topes de otro canal. Se trae la
    // cuenta del servidor (solo lectura) y se guarda en la caché local.
    useEffect(() => {
        if (!context || context.accountCached || !context.accountId) return;
        let cancelled = false;
        (async () => {
            try {
                const { supabase } = await import('@/lib/supabase');
                const { data, error } = await supabase
                    .from('CRM_Cuentas')
                    .select('*')
                    .eq('id', context.accountId!)
                    .maybeSingle();
                if (cancelled || error || !data) return;
                const already = await db.accounts.get(data.id);
                if (!already) await db.accounts.put(data);
            } catch (e) {
                console.warn('[Quote] No se pudo cargar la cuenta para el canal:', e);
            }
        })();
        return () => { cancelled = true; };
    }, [context]);

    // Auto-fetch max_discount_pct for items that are missing it (legacy or failed RPC)
    useEffect(() => {
        if (!items || !context?.channel) return;

        const fetchMissingPricing = async () => {
            for (const item of items) {
                if (!item.max_discount_pct) {
                    try {
                        // Import supabase dynamically to avoid circular deps
                        const { supabase } = await import('@/lib/supabase');

                        console.log('[Pricing] Fetching for item:', item.id, 'producto_id:', item.producto_id);

                        // Get numero_articulo from product id
                        const { data: prodData, error: prodError } = await supabase
                            .from('CRM_ListaDePrecios')
                            .select('numero_articulo')
                            .eq('id', item.producto_id)
                            .single();

                        console.log('[Pricing] Product lookup result:', prodData, 'error:', prodError);

                        if (prodData) {
                            const { data: pricing, error: pricingError } = await supabase.rpc('get_recommended_pricing', {
                                p_numero_articulo: prodData.numero_articulo,
                                p_canal_id: context.channel,
                                p_qty: item.cantidad
                            });

                            console.log('[Pricing] RPC result:', pricing, 'error:', pricingError);

                            if (pricing && pricing.discount_pct !== undefined) {
                                // Update local DB only (no sync needed for this auto-fill)
                                await db.quoteItems.update(item.id, {
                                    max_discount_pct: pricing.discount_pct
                                });
                                console.log('[Pricing] Updated max_discount_pct to:', pricing.discount_pct);
                            }
                        }
                    } catch (e) {
                        console.warn('Could not fetch pricing for item:', item.id, e);
                    }
                }
            }
        };

        fetchMissingPricing();
    }, [items, context?.channel]);

    const handleAddProduct = async (product: PriceListProduct) => {
        const channel = context?.channel || 'DIST_NAC';
        let price = 0;

        // Selección de precio según canal con conversión forzada a número
        switch (channel) {
            case 'OBRAS_NAC':
                price = Number(product.lista_base_obras) || 0;
                break;
            case 'OBRAS_INT':
            case 'DIST_INT':
                price = Number(product.lista_base_exportaciones) || 0;
                break;
            case 'DIST_NAC':
                price = Number(product.lista_base_cop) || 0;
                break;
            case 'PROPIO':
                price = Number(product.pvp_sin_iva) || 0;
                break;
            default:
                price = Number(product.lista_base_cop) || 0;
        }

        // Fallback robusto if 0
        if (price === 0) price = Number(product.lista_base_cop) || Number(product.pvp_sin_iva) || 0;

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

    const handleAddManualItem = async () => {
        await addItem(quote.id, {
            producto_id: null,
            descripcion_linea: 'BAGNO - PRODUCTO MANUAL',
            cantidad: 1,
            precio_unitario: 0,
            subtotal: 0
        });
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

    const handleUpdateDiscount = async (itemId: string, pct: number) => {
        const item = items?.find(i => i.id === itemId);
        if (!item) return;

        const decision = resolveDiscountChange({
            requestedPct: pct,
            maxPct: item.max_discount_pct,
            channel: context?.channel,
            role: currentRole,
            ignorarLimites: context?.ignorar_limites_descuento
        });
        const productLabel = item.descripcion_linea || 'Producto';
        const userName = currentUser?.full_name || currentUser?.email || 'Usuario';

        let validPct: number;
        if (decision.kind === 'ok') {
            validPct = decision.pct;
        } else if (decision.kind === 'needs_authorization') {
            // Canal constructor (Obras): ADMIN/COORDINADOR puede autorizar un descuento mayor
            // dejando motivo; queda registrado en los comentarios de la cotización.
            const reason = window.prompt(
                `El descuento máximo para el canal Obras en esta cantidad es ${decision.maxPct}%.\n` +
                `Vas a autorizar una EXCEPCIÓN de ${decision.requestedPct}% para "${productLabel}".\n\n` +
                `Escribe el motivo (queda registrado en los comentarios de la cotización):`
            );
            if (reason && reason.trim().length >= 3) {
                validPct = decision.requestedPct;
                const note = buildDiscountExceptionNote({
                    type: 'AUTORIZADA', productLabel, requestedPct: decision.requestedPct,
                    maxPct: decision.maxPct, userName, reason
                });
                const nextComments = appendNote(comentarios, note);
                setComentarios(nextComments);
                await onSaveQuote({ comentarios: nextComments });
            } else {
                validPct = decision.maxPct;
                alert(`Sin motivo no se aplica la excepción. Se deja el máximo permitido (${decision.maxPct}%).`);
            }
        } else {
            validPct = decision.pct;
            if (decision.canRequest) {
                const wantsRequest = window.confirm(
                    `El descuento máximo permitido para esta cantidad es ${decision.maxPct}%.\n\n` +
                    `Si es un caso especial del canal Obras, puedes dejar registrada una solicitud de excepción ` +
                    `(${decision.requestedPct}%) para que un coordinador o administrador la autorice. ¿Registrar la solicitud?`
                );
                if (wantsRequest) {
                    const reason = window.prompt('Motivo de la solicitud de excepción:');
                    if (reason && reason.trim().length >= 3) {
                        const note = buildDiscountExceptionNote({
                            type: 'SOLICITUD', productLabel, requestedPct: decision.requestedPct,
                            maxPct: decision.maxPct, userName, reason
                        });
                        const nextComments = appendNote(comentarios, note);
                        setComentarios(nextComments);
                        await onSaveQuote({ comentarios: nextComments });
                    }
                }
            } else {
                alert(`El descuento máximo permitido para esta cantidad es ${decision.maxPct}%`);
            }
        }

        const finalPrice = parseFloat((item.precio_unitario * (1 - validPct / 100)).toFixed(10));

        await updateItem(itemId, {
            discount_pct: validPct,
            final_unit_price: finalPrice
        });
        onItemsChange();
    };

    return (
        <div className="space-y-4 sm:space-y-6 w-full max-w-full">
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
                    <div className="min-w-0">
                        <h3 className="font-bold text-base sm:text-lg text-slate-900 truncate">Productos de la Cotización</h3>
                        <p className="text-xs text-slate-500 italic mt-0.5 truncate">
                            Lista de Precios: {
                                {
                                    'OBRAS_NAC': 'Obras Nacional',
                                    'OBRAS_INT': 'Obras Internacional',
                                    'DIST_NAC': 'Distribución Nacional',
                                    'DIST_INT': 'Distribución Internacional',
                                    'PROPIO': 'Canal Propio'
                                }[context?.channel || ''] || 'Distribución Nacional'
                            }
                        </p>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1 bg-slate-50 sm:bg-transparent p-2.5 sm:p-0 rounded-lg sm:rounded-none border sm:border-0 border-slate-100">
                        <span className="text-[10px] sm:text-xs text-slate-500 uppercase font-bold tracking-wider">Canal: {context?.channel}</span>
                        <div className="text-lg sm:text-2xl font-black text-blue-600 whitespace-nowrap">
                            {quote.currency_id} {new Intl.NumberFormat(quote.currency_id === 'USD' ? 'en-US' : 'es-CO', { style: 'currency', currency: quote.currency_id || 'COP' }).format(quote.total_amount || 0)}
                        </div>
                    </div>
                </div>

                {/* Add Product Search */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-5 sm:mb-6">
                    <div className="md:col-span-1">
                        <select
                            className="w-full p-2.5 sm:p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all text-xs sm:text-sm outline-none"
                            value={selectedPrefix}
                            onChange={(e) => setSelectedPrefix(e.target.value)}
                        >
                            <option value="">Todas las categorías</option>
                            {categories.filter(c => c.is_active).map(c => (
                                <option key={c.id} value={c.prefijo}>{c.nombre}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="md:col-span-2 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="w-4 h-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-28 sm:pr-24 py-2.5 sm:py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all text-xs sm:text-sm"
                            placeholder="Buscar productos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <div className="absolute inset-y-0 right-0 pr-2 sm:pr-3 flex items-center">
                            <button 
                                onClick={handleAddManualItem}
                                className="text-[9px] sm:text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-1.5 sm:px-2 py-1 rounded-md font-bold uppercase transition-colors whitespace-nowrap"
                                title="Agregar ítem que no está en la lista"
                            >
                                + Ítem Manual
                            </button>
                        </div>

                        {(searchTerm || selectedPrefix) && (
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
                                        const channel = context?.channel || 'DIST_NAC';
                                        let displayPrice = 0;

                                        if (quote.currency_id === 'USD') {
                                            displayPrice = Number(product.lista_base_exportaciones) || 0;
                                        } else {
                                            switch (channel) {
                                                case 'OBRAS_NAC': displayPrice = Number(product.lista_base_obras) || 0; break;
                                                case 'PROPIO': displayPrice = Number(product.pvp_sin_iva) || 0; break;
                                                case 'DIST_NAC': 
                                                default: displayPrice = Number(product.lista_base_cop) || 0;
                                            }
                                        }

                                        const formattedPrice = new Intl.NumberFormat(quote.currency_id === 'USD' ? 'en-US' : 'es-CO', {
                                            maximumFractionDigits: 0,
                                            minimumFractionDigits: 0
                                        }).format(Math.round(displayPrice || 0));

                                        return (
                                            <button
                                                key={product.id}
                                                onClick={() => handleAddProduct(product)}
                                                className="w-full text-left px-3.5 py-3 sm:px-5 sm:py-3.5 hover:bg-blue-50/70 flex items-center justify-between gap-3 border-b border-slate-100 last:border-0 transition-colors group cursor-pointer"
                                            >
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <div className="font-medium text-[15px] sm:text-sm text-slate-900 leading-snug break-words sm:line-clamp-2 group-hover:text-blue-700" title={product.descripcion}>{product.descripcion}</div>
                                                    <div className="text-xs sm:text-[11px] text-slate-500 sm:text-slate-400 mt-0.5">{product.numero_articulo}</div>
                                                </div>
                                                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                                    <div className="text-right">
                                                        <span className="text-[11px] sm:text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap block">
                                                            {quote.currency_id || 'COP'} {formattedPrice}
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 block mt-0.5">
                                                            {getPriceClarification(channel, quote.currency_id === 'USD', false)}
                                                        </span>
                                                    </div>
                                                    <div className="p-1.5 sm:p-2 bg-blue-100 text-blue-700 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Items List */}
                <div className="space-y-3">
                    {(!items || items.length === 0) ? (
                        <div className="text-center py-10 sm:py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-xs sm:text-sm">
                            No hay productos agregados.
                        </div>
                    ) : (
                        items.map((item) => (
                            <div key={item.id} className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all group space-y-3">
                                {/* Top row: Description, Price, and Mobile Delete Button */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        {item.producto_id === null ? (
                                            <input 
                                                type="text"
                                                className="font-semibold text-base sm:text-sm text-slate-800 w-full bg-slate-50 border-b border-slate-200 focus:outline-none focus:border-blue-500 rounded px-1.5 py-1 sm:py-0.5 mb-1"
                                                defaultValue={item.descripcion_linea}
                                                onBlur={(e) => updateItem(item.id, { descripcion_linea: e.target.value })}
                                            />
                                        ) : (
                                            <h4 className="font-semibold text-[15px] sm:text-sm text-slate-800 leading-snug break-words sm:line-clamp-2" title={item.descripcion_linea}>{item.descripcion_linea}</h4>
                                        )}
                                        
                                        <div className="mt-1">
                                            <div className="flex flex-wrap items-center gap-1.5 text-[13px] sm:text-xs text-slate-500">
                                            <span>Unitario: $</span>
                                            {isQuoteItemPriceEditable(item) ? (
                                                <input 
                                                    type="number"
                                                    className="text-xs font-medium bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none w-24 sm:w-28 px-1.5 py-0.5 rounded transition-all"
                                                    defaultValue={item.precio_unitario}
                                                    key={`${item.id}-price-${item.precio_unitario}`}
                                                    onBlur={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        if (val !== item.precio_unitario) {
                                                            updateItem(item.id, { precio_unitario: val });
                                                            onItemsChange();
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <span className="font-semibold text-slate-700 select-all">
                                                    {new Intl.NumberFormat(quote.currency_id === 'USD' ? 'en-US' : 'es-CO', {
                                                        minimumFractionDigits: Number.isInteger(item.precio_unitario) ? 0 : 2,
                                                        maximumFractionDigits: 2
                                                    }).format(item.precio_unitario || 0)}
                                                </span>
                                            )}
                                        </div>
                                            <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                {getPriceClarification(context?.channel, quote.currency_id === 'USD', item.producto_id === null)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mobile Delete Button (top-right for easy tap) */}
                                    <button
                                        onClick={() => handleRemove(item.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors md:hidden shrink-0"
                                        title="Eliminar producto"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                </div>

                                {/* Controls Row: Responsive wrap without horizontal overflow */}
                                <div className="pt-2 border-t border-slate-100 flex flex-wrap md:flex-nowrap items-center justify-between gap-3 md:gap-6">
                                    {/* Left cluster: Stepper & Discount */}
                                    <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap">
                                        {/* Stepper */}
                                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                                            <button
                                                onClick={() => handleUpdateQty(item.id, item.cantidad - 1)}
                                                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-white rounded-md shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-bold text-sm"
                                            >
                                                -
                                            </button>
                                            <input
                                                type="number"
                                                defaultValue={item.cantidad}
                                                key={`${item.id}-${item.cantidad}`}
                                                onBlur={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    if (!isNaN(val) && val >= 1) {
                                                        handleUpdateQty(item.id, val);
                                                    } else {
                                                        // Reset UI if invalid
                                                        e.target.value = item.cantidad.toString();
                                                    }
                                                }}
                                                className="w-9 sm:w-12 text-center font-bold text-xs sm:text-sm text-slate-800 bg-transparent border-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <button
                                                onClick={() => handleUpdateQty(item.id, item.cantidad + 1)}
                                                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-white rounded-md shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-bold text-sm"
                                            >
                                                +
                                            </button>
                                        </div>

                                        {/* Discount Input */}
                                        <div className="flex flex-col items-start sm:items-end">
                                            <div className="text-[9px] text-slate-400 font-bold mb-0.5 truncate max-w-[130px]">
                                                {context?.ignorar_limites_descuento 
                                                    ? 'Desc. (ignorado)' 
                                                    : item.max_discount_pct 
                                                        ? ((item.discount_pct || 0) > item.max_discount_pct && channelAllowsDiscountException(context?.channel)
                                                            ? `Excepción · max ${item.max_discount_pct}%`
                                                            : `Desc. max ${item.max_discount_pct}%`)
                                                        : 'Desc. (sin escala)'}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={canAuthorizeDiscountException(currentRole, context?.channel) ? 100 : (item.max_discount_pct || 100)}
                                                    defaultValue={item.discount_pct || 0}
                                                    key={`${item.id}-${item.discount_pct}`}
                                                    onBlur={(e) => handleUpdateDiscount(item.id, parseFloat(e.target.value) || 0)}
                                                    className={cn(
                                                        "w-12 sm:w-16 text-right font-medium text-slate-800 border rounded-md py-1 px-1.5 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500",
                                                        !context?.ignorar_limites_descuento && (item.discount_pct || 0) > (item.max_discount_pct || 0) && item.max_discount_pct
                                                            ? (channelAllowsDiscountException(context?.channel) ? "border-amber-400 text-amber-700 bg-amber-50" : "border-red-500 text-red-600 bg-red-50")
                                                            : "border-slate-200"
                                                    )}
                                                />
                                                <span className="text-slate-500 text-xs sm:text-sm">%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right cluster: Subtotal and Desktop Delete */}
                                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 ml-auto">
                                        <div className="text-right">
                                            <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Subtotal (sin IVA)</div>
                                            <div className="font-bold text-xs sm:text-base text-slate-900 whitespace-nowrap">
                                                ${new Intl.NumberFormat().format(item.subtotal)}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRemove(item.id)}
                                            className="hidden md:flex p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                                            title="Eliminar producto"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Comentarios de la Cotización */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                        Comentarios / Notas Internas
                        {isSaving && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                    </h3>
                </div>
                <ExpandableTextarea
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                    onBlur={handleSaveComments}
                    className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all text-xs sm:text-sm outline-none"
                    placeholder="Agregue notas adicionales sobre esta cotización..."
                    rows={4}
                />
                <p className="text-[10px] text-slate-400 mt-2 italic text-right">
                    Los cambios se guardan automáticamente al hacer clic fuera del campo.
                </p>
            </div>
        </div>
    );
}


function usePremiumValidation(quote: LocalQuote) {
    const { config } = useConfig();

    return useLiveQuery(async () => {
        const opp = await db.opportunities.get(quote.opportunity_id);
        if (!opp) return { isPremium: false, isRestricted: false, minVal: 5000000 };

        const acc = await db.accounts.get(opp.account_id);
        const isPremium = acc?.es_premium || false;
        const minVal = Number(config.min_premium_order_value) || 5000000;
        const currentTotal = quote.total_amount || 0;

        const isRestricted = isPremium && currentTotal < minVal;

        console.log('[PremiumCheck]', {
            quoteId: quote.numero_cotizacion,
            account: acc?.nombre,
            isPremium,
            minVal,
            currentTotal,
            isRestricted
        });

        return { isPremium, isRestricted, minVal };
    }, [quote.id, quote.total_amount, config.min_premium_order_value]) || { isPremium: false, isRestricted: false, minVal: 5000000 };
}

function QuoteValidationBanner({ quote }: { quote: LocalQuote }) {
    const validation = usePremiumValidation(quote);

    if (!validation.isRestricted) return null;

    return (
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-800 rounded-xl border border-red-200 animate-in fade-in slide-in-from-top-4 duration-300">
            <AlertTriangle className="w-8 h-8 shrink-0 text-red-600" />
            <div>
                <p className="font-bold">Cliente Premium: Pedido mínimo no alcanzado</p>
                <p className="text-sm">El valor de esta cotización (<span className="font-bold">${new Intl.NumberFormat().format(quote.total_amount || 0)}</span>) es inferior al mínimo configurado de <span className="font-bold">${new Intl.NumberFormat().format(validation.minVal)}</span>.</p>
                <p className="mt-1 text-xs text-red-600 font-medium">No se podrá generar el pedido en SAP hasta alcanzar el monto mínimo.</p>
            </div>
        </div>
    );
}

function QuotationSegmentSelector({ opportunity_id, initialValue, onSave }: { opportunity_id: string, initialValue?: number | null, onSave: (v: number | null) => void }) {
    const [segments, setSegments] = useState<any[]>([]);
    const [localValue, setLocalValue] = useState<string>(initialValue ? String(initialValue) : "");

    const account = useLiveQuery(async () => {
        const opp = await db.opportunities.get(opportunity_id);
        if (!opp) return null;
        return await db.accounts.get(opp.account_id);
    }, [opportunity_id]);

    useEffect(() => {
        const fetchSegments = async () => {
            const { supabase } = await import('@/lib/supabase');
            const { data } = await supabase.from('CRM_Segmentos').select('*');
            if (data) setSegments(data);
        };
        fetchSegments();
    }, []);

    useEffect(() => {
        setLocalValue(initialValue ? String(initialValue) : "");
    }, [initialValue]);

    if (!account) return null;

    return (
        <div>
            <label className="text-sm font-medium text-slate-700">Segmento del Pedido</label>
            <select
                className="w-full mt-1 p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none disabled:opacity-50"
                value={localValue}
                onChange={(e) => {
                    const val = e.target.value;
                    setLocalValue(val);
                    onSave(val ? Number(val) : null);
                }}
                disabled={!account.subclasificacion_id}
            >
                <option value="">Seleccione un segmento...</option>
                {segments
                    .filter(seg => account.subclasificacion_id && seg.subclasificacion_id === Number(account.subclasificacion_id))
                    .map(seg => (
                        <option key={seg.id} value={String(seg.id)}>
                            {seg.nombre}
                        </option>
                    ))
                }
            </select>
            {!account.subclasificacion_id && (
                <p className="text-[10px] text-orange-600 mt-1 italic font-medium">
                    La cuenta no tiene subclasificación. Edite la cuenta para habilitar segmentos.
                </p>
            )}
        </div>
    );
}

