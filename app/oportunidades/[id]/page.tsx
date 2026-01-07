"use client";

import { useOpportunities, useQuotes, useQuoteItems } from "@/lib/hooks/useOpportunities";
import { DetailHeader } from "@/components/ui/DetailHeader";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText, Plus, AlertCircle, Check, Trash2, Loader2, Truck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/components/ui/utils";

export default function OpportunityDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { opportunities, deleteOpportunity } = useOpportunities();

    const opportunity = opportunities?.find(o => o.id === id);

    const [activeTab, setActiveTab] = useState<'resumen' | 'cotizaciones' | 'productos' | 'actividades'>('cotizaciones');

    const handleDelete = async () => {
        if (confirm("¿Estás seguro de que deseas eliminar esta oportunidad?")) {
            await deleteOpportunity(id);
            router.push("/oportunidades");
        }
    };

    if (!opportunity) return <div className="p-8 text-center text-slate-400">Cargando oportunidad...</div>;

    return (
        <div className="min-h-screen bg-slate-50">
            <DetailHeader
                title={opportunity.nombre}
                subtitle={`${opportunity.currency_id} ${opportunity.amount}`}
                status={opportunity.fase}
                backHref="/oportunidades"
                actions={[
                    {
                        label: "Eliminar Oportunidad",
                        icon: Trash2,
                        variant: 'danger',
                        onClick: handleDelete
                    }
                ]}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

                {/* Sub-Tabs Nav */}
                <div className="flex space-x-6 border-b border-slate-200 mb-6">
                    {['resumen', 'cotizaciones', 'productos', 'actividades'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={cn(
                                "pb-3 text-sm font-medium border-b-2 capitalize transition-colors",
                                activeTab === tab
                                    ? "border-blue-600 text-blue-600"
                                    : "border-transparent text-slate-500 hover:text-slate-800"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {activeTab === 'cotizaciones' && (
                    <QuotesTab opportunityId={id} currency={opportunity.currency_id} />
                )}

                {activeTab === 'productos' && (
                    <ProductsTab opportunityId={id} />
                )}

                {activeTab === 'resumen' && (
                    <div className="p-8 text-center text-slate-400 border-2 border-dashed rounded-xl">
                        Resumen KPIs y Timeline próximamente.
                    </div>
                )}
            </div>
        </div>
    );
}

function ProductsTab({ opportunityId }: { opportunityId: string }) {
    const { opportunities } = useOpportunities();
    const opportunity = opportunities?.find(o => o.id === opportunityId);
    const { quotes } = useQuotes(opportunityId);

    // Fallback to opportunity.items if no items are found in the active quote
    const activeQuote = quotes?.find(q => q.status === 'WINNER') || quotes?.[0];
    const { items: quoteItems } = useQuoteItems(activeQuote?.id);

    const itemsToShow = (quoteItems && quoteItems.length > 0)
        ? quoteItems
        : (opportunity?.items || []);

    if (itemsToShow.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-400">
                No hay productos asociados. Agregue productos en el asistente o cree una cotización.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800">
                    {activeQuote
                        ? `Productos (${activeQuote.numero_cotizacion})`
                        : 'Productos de la Oportunidad'}
                </h3>
                {activeQuote && (
                    <Link
                        href={`/oportunidades/${opportunityId}/cotizaciones/${activeQuote.id}`}
                        className="text-sm text-blue-600 font-medium hover:underline"
                    >
                        Editar Productos
                    </Link>
                )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                        <tr>
                            <th className="px-4 py-3">Descripción</th>
                            <th className="px-4 py-3 text-center">Cant.</th>
                            <th className="px-4 py-3 text-right">Unitario</th>
                            <th className="px-4 py-3 text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {itemsToShow.map((item: any) => (
                            <tr key={item.id || item.product_id}>
                                <td className="px-4 py-3 font-medium text-slate-900">
                                    {item.descripcion_linea || item.nombre}
                                </td>
                                <td className="px-4 py-3 text-center text-slate-600">{item.cantidad}</td>
                                <td className="px-4 py-3 text-right text-slate-600">
                                    ${new Intl.NumberFormat().format(item.precio_unitario || item.precio || 0)}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-slate-900">
                                    ${new Intl.NumberFormat().format(item.subtotal || (item.cantidad * (item.precio_unitario || item.precio || 0)))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                            <td colSpan={3} className="px-4 py-3 text-right text-slate-500">Total</td>
                            <td className="px-4 py-3 text-right text-blue-600 text-lg">
                                ${new Intl.NumberFormat().format(
                                    itemsToShow.reduce((acc: number, item: any) =>
                                        acc + (item.subtotal || (item.cantidad * (item.precio_unitario || item.precio || 0))), 0
                                    )
                                )}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}

function QuotesTab({ opportunityId, currency }: { opportunityId: string, currency: string }) {
    const { quotes, createQuote, markAsWinner } = useQuotes(opportunityId);
    const [isCreating, setIsCreating] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const handleCreate = async () => {
        setIsCreating(true);
        try {
            const newId = await createQuote(opportunityId, { currency_id: currency });
            window.location.href = `/oportunidades/${opportunityId}/cotizaciones/${newId}`;
        } catch (e) {
            console.error(e);
            setIsCreating(false);
        }
    };

    const handleMarkWinner = async (quote: any) => {
        if (!confirm(`¿Confirmas que deseas generar el pedido para la cotización ${quote.numero_cotizacion}? Esto cerrará las demás cotizaciones.`)) return;

        setProcessingId(quote.id);
        try {
            // @ts-ignore
            await markAsWinner(quote.id);
        } catch (e) {
            console.error(e);
            alert("Error al generar pedido");
        } finally {
            setProcessingId(null);
        }
    };

    const checkSapReady = (q: any) => {
        // Validation logic matching SapDataEditor
        return q.fecha_facturacion && q.tipo_facturacion && q.orden_compra;
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div>
                    <h3 className="font-bold text-blue-900">Cotizaciones</h3>
                    <p className="text-sm text-blue-700">Gestiona las propuestas comerciales para este negocio.</p>
                </div>
                <button
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    {isCreating ? "Creando..." : "Nueva Cotización"}
                </button>
            </div>

            {(!quotes || quotes.length === 0) ? (
                <div className="text-center py-12 text-slate-400">
                    No hay cotizaciones aún. Crea la primera.
                </div>
            ) : (
                <div className="grid gap-4">
                    {quotes.map(q => {
                        const isReady = checkSapReady(q);
                        const isProcessing = processingId === q.id;

                        return (
                            <div key={q.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-400 flex justify-between group">
                                <Link href={`/oportunidades/${opportunityId}/cotizaciones/${q.id}`} className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <h4 className="font-bold text-slate-800 hover:text-blue-600 transition-colors">{q.numero_cotizacion}</h4>
                                        <span className={cn(
                                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                                            q.status === 'WINNER' ? "bg-green-100 text-green-700" :
                                                q.status === 'REJECTED' ? "bg-red-100 text-red-700" :
                                                    "bg-slate-100 text-slate-600"
                                        )}>
                                            {q.status === 'WINNER' ? 'Ganada / Pedido' : q.status}
                                        </span>
                                        {q.is_winner && <Check className="w-4 h-4 text-green-600" />}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Creada el {new Date(q.updated_at || Date.now()).toLocaleDateString()}
                                    </p>
                                </Link>

                                <div className="text-right flex flex-col items-end gap-2">
                                    <p className="font-bold text-slate-900 text-lg">
                                        {q.currency_id} {new Intl.NumberFormat().format(q.total_amount || 0)}
                                    </p>

                                    {q.status !== 'WINNER' && q.status !== 'REJECTED' && (
                                        <div className="flex items-center gap-2">
                                            {isReady ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        handleMarkWinner(q);
                                                    }}
                                                    disabled={isProcessing}
                                                    className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
                                                >
                                                    {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Truck className="w-3 h-3" />}
                                                    Generar Pedido
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-1 text-[10px] text-orange-500 bg-orange-50 px-2 py-1 rounded-md" title="Complete los campos en la pestaña Datos SAP">
                                                    <AlertCircle className="w-3 h-3" />
                                                    Incompleta para SAP
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
