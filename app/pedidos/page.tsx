"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Truck, Search, Calendar, FileText, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/components/ui/utils";

export default function PedidosPage() {
    const [search, setSearch] = useState("");

    // Fetch quotes marked as 'es_pedido'
    const pedidos = useLiveQuery(async () => {
        const all = await db.quotes
            .where('es_pedido').equals(1) // boolean is stored as 1/0 in Dexie often, or .equals(true)
            .sortBy('updated_at');

        // Dexie boolean indices can be tricky, check filtering manually if index fails
        // Fallback: fetch all winners and filter
        const winners = await db.quotes.where('status').equals('WINNER').toArray();
        return winners.filter(q => q.es_pedido === true).sort((a, b) => new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime());
    });

    const filtered = pedidos?.filter(p =>
        p.numero_cotizacion.toLowerCase().includes(search.toLowerCase()) ||
        p.orden_compra?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Pedidos</h1>
                        <p className="text-slate-500 mt-1">Gestión de órdenes de venta procesadas</p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por número de pedido o cotización..."
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* List */}
                <div className="grid grid-cols-1 gap-4">
                    {!filtered || filtered.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Truck className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">No hay pedidos</h3>
                            <p className="text-slate-500 mt-1">Las cotizaciones se convertirán en pedidos cuando se completen los datos de SAP.</p>
                        </div>
                    ) : (
                        filtered.map(pedido => (
                            <Link
                                key={pedido.id}
                                href={`/oportunidades/${pedido.opportunity_id}/cotizaciones/${pedido.id}`}
                                className="group block bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-400 hover:shadow-md transition-all"
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-green-50 text-green-600 rounded-xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-slate-900 text-lg group-hover:text-blue-700 transition-colors">
                                                    {pedido.numero_cotizacion}
                                                </h3>
                                                {pedido.orden_compra && (
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full border border-slate-200">
                                                        OC: {pedido.orden_compra}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-slate-500">
                                                <span className="flex items-center gap-1.5">
                                                    <Calendar className="w-4 h-4" />
                                                    {new Date(pedido.updated_at!).toLocaleDateString()}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Truck className="w-4 h-4" />
                                                    {pedido.tipo_facturacion || 'Sin info'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-2xl font-black text-slate-900">
                                            {pedido.currency_id} {new Intl.NumberFormat().format(pedido.total_amount || 0)}
                                        </div>
                                        <div className="flex justify-end mt-2">
                                            <span className="flex items-center gap-1 text-sm font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                                                Ver Detalle <ChevronRight className="w-4 h-4" />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
