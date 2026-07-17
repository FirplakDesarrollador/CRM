"use client";

import { useMemo, useState } from "react";
import { Boxes, Filter, Loader2, Search } from "lucide-react";
import { useProductSearch } from "@/lib/hooks/useProducts";
import { useInventorySummary } from "@/lib/hooks/useInventory";
import { getProductPrice, SALES_CHANNELS } from "@/lib/salesChannels";

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export default function CatalogPage() {
    const [search, setSearch] = useState("");
    const [channel, setChannel] = useState("PROPIO");
    const [family, setFamily] = useState("");
    const [plant, setPlant] = useState("");
    const [onlyAvailable, setOnlyAvailable] = useState(false);
    const { products, isLoading } = useProductSearch(search, undefined, true);
    const productIds = useMemo(() => products.map(product => product.id), [products]);
    const { summary, isLoading: isLoadingInventory } = useInventorySummary(productIds);
    const inventory = useMemo(() => new Map(summary.map(item => [item.producto_id, item])), [summary]);

    const families = useMemo(() => Array.from(new Set(products.map(product => product.familia).filter(Boolean))).sort() as string[], [products]);
    const plants = useMemo(() => Array.from(new Set(products.map(product => product.planta).filter(Boolean))).sort() as string[], [products]);
    const filtered = products.filter(product => {
        if (family && product.familia !== family) return false;
        if (plant && product.planta !== plant) return false;
        if (onlyAvailable && (inventory.get(product.id)?.disponible || 0) <= 0) return false;
        return true;
    });

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
            <header className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-cyan-100 text-cyan-700"><Boxes className="w-7 h-7" /></div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Catálogo</h1>
                    <p className="text-slate-500">Productos, precios por canal e inventario disponible.</p>
                </div>
            </header>

            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por palabras sin importar el orden: 48x43 Lavamanos" className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <label className="space-y-1 text-xs font-bold text-slate-500"><span>CANAL</span><select value={channel} onChange={event => setChannel(event.target.value)} className="w-full p-2.5 border rounded-lg bg-white text-sm text-slate-800">{SALES_CHANNELS.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
                    <label className="space-y-1 text-xs font-bold text-slate-500"><span>FAMILIA</span><select value={family} onChange={event => setFamily(event.target.value)} className="w-full p-2.5 border rounded-lg bg-white text-sm text-slate-800"><option value="">Todas</option>{families.map(item => <option key={item}>{item}</option>)}</select></label>
                    <label className="space-y-1 text-xs font-bold text-slate-500"><span>PLANTA</span><select value={plant} onChange={event => setPlant(event.target.value)} className="w-full p-2.5 border rounded-lg bg-white text-sm text-slate-800"><option value="">Todas</option>{plants.map(item => <option key={item}>{item}</option>)}</select></label>
                    <label className="flex items-center gap-2 mt-5 text-sm font-semibold text-slate-700"><input type="checkbox" checked={onlyAvailable} onChange={event => setOnlyAvailable(event.target.checked)} className="w-4 h-4" /> Solo disponibles</label>
                    <div className="flex items-center gap-2 mt-5 text-sm text-slate-500"><Filter className="w-4 h-4" /> {filtered.length} productos</div>
                </div>
            </section>

            {(isLoading || isLoadingInventory) && <div className="flex items-center justify-center gap-2 py-12 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Cargando catalogo...</div>}

            {!isLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(product => {
                        const stock = inventory.get(product.id);
                        const available = stock?.disponible || 0;
                        return (
                            <article key={product.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
                                <div className="flex-1">
                                    <div className="text-xs font-mono font-bold text-cyan-700 mb-1">{product.numero_articulo}</div>
                                    <h2 className="font-bold text-slate-900 leading-snug">{product.descripcion}</h2>
                                    <div className="flex gap-2 mt-2 text-[11px] text-slate-500"><span>{product.familia || "Sin familia"}</span><span>•</span><span>{product.planta || "Sin planta"}</span></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl bg-cyan-50 p-3"><div className="text-[10px] font-bold text-cyan-700 uppercase">Precio {channel}</div><div className="font-black text-cyan-950 mt-1">{money.format(getProductPrice(product, channel))}</div></div>
                                    <div className={`rounded-xl p-3 ${available > 0 ? "bg-emerald-50" : "bg-slate-100"}`}><div className="text-[10px] font-bold text-slate-500 uppercase">Inventario</div><div className={`font-black mt-1 ${available > 0 ? "text-emerald-700" : "text-slate-500"}`}>{available} disponible</div><div className="text-[10px] text-slate-500">{stock?.reservas || 0} reservado</div></div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
