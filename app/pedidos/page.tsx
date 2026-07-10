"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Truck, Search, Calendar, FileText, ChevronRight, Briefcase, Receipt } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/components/ui/utils";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";

function PedidosContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [search, setSearch] = useState(searchParams.get('search') || "");

    useEffect(() => {
        const timer = setTimeout(() => {
            const currentSearch = searchParams.get('search') || "";
            if (currentSearch === search) return;

            const params = new URLSearchParams(Array.from(searchParams.entries()));
            if (search) params.set('search', search);
            else params.delete('search');
            
            const query = params.toString() ? `?${params.toString()}` : window.location.pathname;
            router.replace(query.startsWith('?') ? `${window.location.pathname}${query}` : query, { scroll: false });
        }, 500);
        return () => clearTimeout(timer);
    }, [search, searchParams, router]);

    const { user, role, isAdmin, isVendedor, isCoordinador } = useCurrentUser();
    const [teamIds, setTeamIds] = useState<string[]>([]);

    useEffect(() => {
        if (isCoordinador && user?.id) {
            // Get IDs of users who have this user as coordinator
            import("@/lib/supabase").then(({ supabase }) => {
                supabase.from('CRM_Usuarios')
                    .select('id')
                    .contains('coordinadores', [user.id])
                    .then(({ data }) => {
                        const ids = data?.map(d => d.id) || [];
                        setTeamIds([user.id, ...ids]);
                    });
            });
        }
    }, [isCoordinador, user?.id]);

    // Fetch data from CRM_Pedidos
    const data = useLiveQuery(async () => {
        if (!user) return [];

        let allPedidos = await db.pedidos.toArray();
        const allQuotes = await db.quotes.toArray();
        const allOpps = await db.opportunities.toArray();
        const allPhases = await db.phases.toArray();
        const allPedidoItems = await db.pedidoItems.toArray();

        const quotesMap = new Map(allQuotes.map(q => [q.id, q]));
        const oppsMap = new Map(allOpps.map(o => [o.id, o]));
        const phasesMap = new Map(allPhases.map(p => [p.id, p]));
        
        // Group items by pedido to calculate local totals
        const itemsByPedido = new Map<string, any[]>();
        allPedidoItems.forEach(item => {
            if (!itemsByPedido.has(item.pedido_uuid)) itemsByPedido.set(item.pedido_uuid, []);
            itemsByPedido.get(item.pedido_uuid)!.push(item);
        });

        // Filter by visibility rules
        if (!isAdmin) {
            allPedidos = allPedidos.filter(p => {
                const quote = quotesMap.get(p.cotizacion_id);
                const opportunityId = p.opportunity_id || quote?.opportunity_id || "";
                const opp = oppsMap.get(opportunityId);
                const ownerId = opp?.owner_user_id || p.created_by;

                // Si no hay dueño identificado (ej. sync parcial), permitimos ver el pedido
                // para evitar que desaparezca de la vista del usuario.
                if (!ownerId) return true;

                if (isVendedor) {
                    return ownerId === user.id;
                }
                if (isCoordinador) {
                    if (teamIds.length === 0) return ownerId === user.id;
                    return teamIds.includes(ownerId);
                }
                return false;
            });
        }

        const parseSpanishFloat = (val: any) => {
            if (val === undefined || val === null || val === "") return null;
            if (typeof val === 'number') return val;
            const cleaned = val.toString().replace(/\./g, "").replace(",", ".");
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? null : parsed;
        };

        const processed = allPedidos.map(p => {
            const quote = quotesMap.get(p.cotizacion_id);
            const opportunityId = p.opportunity_id || quote?.opportunity_id || "";
            const opp = oppsMap.get(opportunityId);
            const phase = opp ? phasesMap.get(opp.fase_id) : null;
            
            // Calculate local total from items if available (mostly for Planeado orders)
            const localItems = itemsByPedido.get(p.uuid_generado) || [];
            const calculatedTotal = localItems.reduce((acc, item) => {
                const subtotal = (item.cantidad || 0) * (item.precio_unitario || 0);
                const discount = subtotal * ((item.descuento || 0) / 100);
                return acc + (subtotal - discount);
            }, 0);

            // Priority: Order Total from SAP -> Local calculated total -> Fallback to quote total
            const orderTotal = parseSpanishFloat(p["EXTRA_Gran Total"]) || parseSpanishFloat(p.amountSalesOrder);
            const displayTotal = orderTotal !== null ? orderTotal : (calculatedTotal > 0 ? calculatedTotal : (quote?.total_amount || 0));

            // Status checks
            const isClosedWon = (phase && phase.probability === 100) || opp?.status === 'WON' || opp?.fase?.toLowerCase().includes('ganada');
            const isLost = (phase && (phase.probability === 0 || phase.nombre?.toLowerCase().includes('perdida'))) || 
                           opp?.status === 'LOST' || 
                           opp?.status === 'CLOSED_LOST';

            return {
                ...p,
                order_id_display: p.salesOrderNumber || quote?.numero_cotizacion || p.oc_cot || "S/N",
                numero_cotizacion: quote?.numero_cotizacion || p.oc_cot || "S/N",
                company_name: p.company || "Cliente no identificado",
                currency_id: p.currency_id || quote?.currency_id || "COP",
                total_amount: displayTotal,
                is_closed_won: isClosedWon,
                is_lost: isLost,
                opportunity_name: opp?.nombre || "Sin Oportunidad",
                responsable_name: p.responsible || "No asignado"
            };
        });

        // Filter out lost opportunities and sort
        return processed
            .filter(p => !p.is_lost)
            .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
    }, [user, isAdmin, isVendedor, isCoordinador, teamIds]);

    const [filterStatus, setFilterStatus] = useState<"all" | "won" | "others">("all");

    const filtered = data?.filter(p => {
        const matchesSearch = (
            p.order_id_display?.toLowerCase().includes(search.toLowerCase()) ||
            p.numero_cotizacion?.toLowerCase().includes(search.toLowerCase()) ||
            p.orden_compra?.toLowerCase().includes(search.toLowerCase()) ||
            p.opportunity_name?.toLowerCase().includes(search.toLowerCase()) ||
            p.company_name?.toLowerCase().includes(search.toLowerCase())
        );

        if (!matchesSearch) return false;

        if (filterStatus === "won") return p.is_closed_won;
        if (filterStatus === "others") return !p.is_closed_won;
        return true;
    });

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

                {/* Search & Filters */}
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por número, OC u oportunidad..."
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                        <button
                            onClick={() => setFilterStatus("all")}
                            className={cn(
                                "px-4 py-1.5 text-sm font-medium rounded-lg transition-all",
                                filterStatus === "all" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setFilterStatus("won")}
                            className={cn(
                                "px-4 py-1.5 text-sm font-medium rounded-lg transition-all",
                                filterStatus === "won" ? "bg-green-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            Oportunidad Ganada
                        </button>
                        <button
                            onClick={() => setFilterStatus("others")}
                            className={cn(
                                "px-4 py-1.5 text-sm font-medium rounded-lg transition-all",
                                filterStatus === "others" ? "bg-amber-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            Otros
                        </button>
                    </div>
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
                                key={pedido.uuid_generado}
                                href={`/oportunidades/${pedido.opportunity_id}/cotizaciones/${pedido.cotizacion_id}`}
                                className="group block bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-400 hover:shadow-md transition-all"
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-green-50 text-green-600 rounded-xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="mb-2">
                                                <h3 className="font-bold text-slate-900 text-lg group-hover:text-blue-700 transition-colors flex items-center gap-2">
                                                    {pedido.salesOrderNumber ? (
                                                        <>
                                                            <span className="text-blue-600">Pedido SAP:</span> {pedido.salesOrderNumber}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="text-slate-400">Plan:</span> {pedido.numero_cotizacion}
                                                        </>
                                                    )}
                                                </h3>
                                                <p className="text-sm font-bold text-[#254153] flex items-center gap-2">
                                                    {pedido.company_name}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    {/* Solo mostrar badge de COT si el título no es la COT */}
                                                    {pedido.salesOrderNumber && (
                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                            COT: {pedido.numero_cotizacion}
                                                        </span>
                                                    )}
                                                    {pedido.orden_compra && (
                                                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded border border-amber-200">
                                                            OC: {pedido.orden_compra}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                                                <span className="flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {new Date(pedido.updated_at || pedido.created_at || 0).toLocaleDateString()}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Receipt className="w-3.5 h-3.5" />
                                                    {pedido.tipo_facturacion || 'Sin info'}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border",
                                                        pedido.is_closed_won 
                                                            ? "bg-green-50 text-green-700 border-green-200" 
                                                            : "bg-slate-50 text-slate-600 border-slate-200"
                                                    )}>
                                                        {pedido.is_closed_won ? "Ganada" : "En Proceso"}
                                                    </span>
                                                    {pedido.estado_pedido === 'PLANEADO' && (
                                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-black uppercase tracking-wider">
                                                            Planeado
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-2 flex items-center gap-4 border-t pt-2 border-slate-50">
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                                    <Briefcase className="w-3 h-3" />
                                                    {pedido.opportunity_name}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                    Asesor: {pedido.responsable_name}
                                                </div>
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

export default function PedidosPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando pedidos...</div>}>
            <PedidosContent />
        </Suspense>
    );
}
