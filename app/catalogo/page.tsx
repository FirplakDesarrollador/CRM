"use client";

import { useMemo, useState, useEffect } from "react";
import { Boxes, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, Loader2, Search } from "lucide-react";
import { useFullCatalog, useProductFilterOptions } from "@/lib/hooks/useProducts";
import { useInventorySummary } from "@/lib/hooks/useInventory";
import { matchesSearchTokens } from "@/lib/utils";

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export default function CatalogPage() {
    const [search, setSearch] = useState("");
    const [family, setFamily] = useState("");
    const [plant, setPlant] = useState("");
    const [onlyAvailable, setOnlyAvailable] = useState(false);
    const [onlyFeria, setOnlyFeria] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    
    const { plants, families } = useProductFilterOptions();
    const { products: allProducts, isLoading: isLoadingCatalog } = useFullCatalog();
    const { summary, isLoading: isLoadingInventory } = useInventorySummary();
    
    const inventory = useMemo(() => new Map(summary.map(item => [item.producto_id, item])), [summary]);

    // Filtrado en memoria ultra-rápido (< 3ms)
    const filteredProducts = useMemo(() => {
        let list = allProducts;
        if (plant) {
            list = list.filter(p => p.planta === plant);
        }
        if (family) {
            list = list.filter(p => p.familia === family);
        }
        if (onlyAvailable) {
            list = list.filter(p => (inventory.get(p.id)?.disponible || 0) > 0);
        }
        if (onlyFeria) {
            list = list.filter(p => (p.precio_feria || 0) > 0);
        }
        if (search && search.trim().length > 0) {
            list = list.filter(p => {
                const combined = `${p.numero_articulo || ''} ${p.descripcion || ''}`;
                return matchesSearchTokens(combined, search);
            });
        }
        return list;
    }, [allProducts, plant, family, onlyAvailable, onlyFeria, search, inventory]);

    // Resetear a la página 1 al cambiar cualquier filtro
    useEffect(() => {
        setPage(1);
    }, [search, family, plant, onlyAvailable, onlyFeria, pageSize]);

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
    const paginatedProducts = useMemo(() => {
        if (pageSize === 0) return filteredProducts;
        const start = (page - 1) * pageSize;
        return filteredProducts.slice(start, start + pageSize);
    }, [filteredProducts, page, pageSize]);

    const isLoading = (allProducts.length === 0 && isLoadingCatalog) || (summary.length === 0 && isLoadingInventory);

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
            <header className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-cyan-100 text-cyan-700"><Boxes className="w-7 h-7" /></div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Catálogo de Productos</h1>
                    <p className="text-slate-500">Consulta de productos, todas las listas de precios e inventario disponible.</p>
                </div>
            </header>

            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input 
                        value={search} 
                        onChange={event => setSearch(event.target.value)} 
                        placeholder="Buscar por palabras sin importar el orden: 48x43 Lavamanos" 
                        className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500" 
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <label className="space-y-1 text-xs font-bold text-slate-500">
                        <span>FAMILIA</span>
                        <select value={family} onChange={event => setFamily(event.target.value)} className="w-full p-2.5 border rounded-lg bg-white text-sm text-slate-800">
                            <option value="">Todas</option>
                            {families.map(item => <option key={item} value={item}>{item}</option>)}
                        </select>
                    </label>
                    <label className="space-y-1 text-xs font-bold text-slate-500">
                        <span>PLANTA</span>
                        <select value={plant} onChange={event => setPlant(event.target.value)} className="w-full p-2.5 border rounded-lg bg-white text-sm text-slate-800">
                            <option value="">Todas</option>
                            {plants.map(item => <option key={item} value={item}>{item}</option>)}
                        </select>
                    </label>
                    <label className="flex items-center gap-2 mt-5 text-sm font-semibold text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={onlyAvailable} onChange={event => setOnlyAvailable(event.target.checked)} className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500" /> 
                        Solo disponibles
                    </label>
                    <label className="flex items-center gap-2 mt-5 text-sm font-semibold text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={onlyFeria} onChange={event => setOnlyFeria(event.target.checked)} className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500" /> 
                        Productos de feria
                    </label>
                    <div className="flex items-center gap-2 mt-5 text-sm text-slate-600 font-medium">
                        <Filter className="w-4 h-4 text-cyan-600" /> {filteredProducts.length} {filteredProducts.length === 1 ? "producto" : "productos"}
                    </div>
                </div>
            </section>

            {isLoading && (
                <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin text-cyan-600" /> Cargando catálogo...
                </div>
            )}

            {!isLoading && (
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-3 px-4">Artículo</th>
                                    <th className="py-3 px-4">Descripción</th>
                                    <th className="py-3 px-4">Familia / Planta</th>
                                    <th className="py-3 px-4 text-right">PVP (Propio)</th>
                                    <th className="py-3 px-4 text-right">Base COP (Dist.)</th>
                                    <th className="py-3 px-4 text-right">Obras Nac.</th>
                                    <th className="py-3 px-4 text-right">Exportación</th>
                                    <th className="py-3 px-4 text-right">PVP Sin IVA</th>
                                    <th className="py-3 px-4 text-right">Precio Feria</th>
                                    <th className="py-3 px-4 text-center">Disponible</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedProducts.map(product => {
                                    const stock = inventory.get(product.id);
                                    const available = stock?.disponible || 0;
                                    return (
                                        <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-4 font-mono text-xs font-bold text-cyan-700 whitespace-nowrap">
                                                {product.numero_articulo}
                                            </td>
                                            <td className="py-3 px-4 font-medium text-slate-900 max-w-[380px]">
                                                {product.descripcion}
                                            </td>
                                            <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1">
                                                    <span className="font-semibold text-slate-700">{product.familia || "-"}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span>{product.planta || "-"}</span>
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-slate-800 whitespace-nowrap">
                                                {product.distribuidor_pvp_iva ? money.format(product.distribuidor_pvp_iva) : "-"}
                                            </td>
                                            <td className="py-3 px-4 text-right font-semibold text-slate-700 whitespace-nowrap">
                                                {product.lista_base_cop ? money.format(product.lista_base_cop) : "-"}
                                            </td>
                                            <td className="py-3 px-4 text-right font-semibold text-slate-700 whitespace-nowrap">
                                                {product.lista_base_obras ? money.format(product.lista_base_obras) : "-"}
                                            </td>
                                            <td className="py-3 px-4 text-right font-semibold text-slate-700 whitespace-nowrap">
                                                {product.lista_base_exportaciones ? money.format(product.lista_base_exportaciones) : "-"}
                                            </td>
                                            <td className="py-3 px-4 text-right text-slate-600 whitespace-nowrap">
                                                {product.pvp_sin_iva ? money.format(product.pvp_sin_iva) : "-"}
                                            </td>
                                            <td className="py-3 px-4 text-right font-semibold text-slate-700 whitespace-nowrap">
                                                {product.precio_feria ? money.format(product.precio_feria) : "-"}
                                            </td>
                                            <td className="py-3 px-4 text-center whitespace-nowrap">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${available > 0 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                                                    {available > 0 ? `${available} disp.` : "Agotado"}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {paginatedProducts.length === 0 && (
                                    <tr>
                                        <td colSpan={10} className="py-12 text-center text-slate-400">
                                            No se encontraron productos que coincidan con la búsqueda.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {filteredProducts.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-1 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                                <span>Filas por página:</span>
                                <select 
                                    value={pageSize} 
                                    onChange={e => setPageSize(Number(e.target.value))}
                                    className="border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700 font-medium outline-none focus:ring-1 focus:ring-cyan-500"
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={250}>250</option>
                                    <option value={0}>Todos ({filteredProducts.length})</option>
                                </select>
                                <span className="text-slate-400">|</span>
                                <span>
                                    Mostrando {pageSize === 0 ? 1 : Math.min((page - 1) * pageSize + 1, filteredProducts.length)} a {pageSize === 0 ? filteredProducts.length : Math.min(page * pageSize, filteredProducts.length)} de {filteredProducts.length}
                                </span>
                            </div>

                            {pageSize > 0 && totalPages > 1 && (
                                <div className="flex items-center gap-1">
                                    <button 
                                        type="button"
                                        onClick={() => setPage(1)} 
                                        disabled={page === 1}
                                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition"
                                        title="Primera página"
                                    >
                                        <ChevronsLeft className="w-4 h-4" />
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setPage(p => Math.max(1, p - 1))} 
                                        disabled={page === 1}
                                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition"
                                        title="Página anterior"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="px-3 py-1 text-xs font-semibold text-slate-700">
                                        Página {page} de {totalPages}
                                    </span>
                                    <button 
                                        type="button"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                                        disabled={page === totalPages}
                                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition"
                                        title="Página siguiente"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setPage(totalPages)} 
                                        disabled={page === totalPages}
                                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition"
                                        title="Última página"
                                    >
                                        <ChevronsRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
