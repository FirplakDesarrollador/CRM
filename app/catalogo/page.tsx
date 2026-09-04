"use client";

import React, { useMemo, useState, useEffect } from "react";
import { 
    Boxes, 
    ChevronDown, 
    ChevronLeft, 
    ChevronRight, 
    ChevronsLeft, 
    ChevronsRight, 
    Copy, 
    Check, 
    Filter, 
    Layers, 
    Loader2, 
    Palette, 
    Search, 
} from "lucide-react";
import { useFullCatalog, useProductFilterOptions } from "@/lib/hooks/useProducts";
import { useInventorySummary } from "@/lib/hooks/useInventory";
import { matchesSearchTokens } from "@/lib/utils";
import { groupProductsByColor } from "@/lib/productGrouping";

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export default function CatalogPage() {
    const [search, setSearch] = useState("");
    const [family, setFamily] = useState("");
    const [plant, setPlant] = useState("");
    const [onlyAvailable, setOnlyAvailable] = useState(false);
    const [onlyFeria, setOnlyFeria] = useState(false);
    const [groupByColor, setGroupByColor] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [copiedSku, setCopiedSku] = useState<string | null>(null);

    const { plants, families } = useProductFilterOptions();
    const { products: allProducts, isLoading: isLoadingCatalog } = useFullCatalog();
    const { summary, isLoading: isLoadingInventory } = useInventorySummary();

    const inventory = useMemo(() => new Map(summary.map(item => [item.producto_id, item])), [summary]);

    // Productos agrupados por color (base)
    const allGroupedProducts = useMemo(() => {
        if (!groupByColor) return [];
        return groupProductsByColor(allProducts, inventory);
    }, [allProducts, inventory, groupByColor]);

    // Filtrado agrupado en memoria
    const filteredGroupedProducts = useMemo(() => {
        if (!groupByColor) return [];
        let list = allGroupedProducts;
        if (plant) {
            list = list.filter(p => p.planta === plant || p.variants.some(v => v.planta === plant));
        }
        if (family) {
            list = list.filter(p => p.familia === family || p.variants.some(v => v.familia === family));
        }
        if (onlyAvailable) {
            list = list.filter(p => p.hasAvailableVariant);
        }
        if (onlyFeria) {
            list = list.filter(p => p.hasFeriaVariant);
        }
        if (search && search.trim().length > 0) {
            list = list.filter(p => {
                const combinedVariants = p.variants.map(v => `${v.numero_articulo} ${v.descripcion} ${v.color_name} ${v.color_code}`).join(" ");
                const combined = `${p.baseCode} ${p.descripcion} ${combinedVariants}`;
                return matchesSearchTokens(combined, search);
            });
        }
        return list;
    }, [allGroupedProducts, plant, family, onlyAvailable, onlyFeria, search, groupByColor]);

    // Filtrado plano tradicional (cuando se desactiva la agrupación)
    const filteredFlatProducts = useMemo(() => {
        if (groupByColor) return [];
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
    }, [allProducts, plant, family, onlyAvailable, onlyFeria, search, inventory, groupByColor]);

    // Resetear a página 1 al cambiar filtros
    useEffect(() => {
        setPage(1);
    }, [search, family, plant, onlyAvailable, onlyFeria, pageSize, groupByColor]);

    const totalItems = groupByColor ? filteredGroupedProducts.length : filteredFlatProducts.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    const paginatedGroupedProducts = useMemo(() => {
        if (!groupByColor) return [];
        if (pageSize === 0) return filteredGroupedProducts;
        const start = (page - 1) * pageSize;
        return filteredGroupedProducts.slice(start, start + pageSize);
    }, [filteredGroupedProducts, page, pageSize, groupByColor]);

    const paginatedFlatProducts = useMemo(() => {
        if (groupByColor) return [];
        if (pageSize === 0) return filteredFlatProducts;
        const start = (page - 1) * pageSize;
        return filteredFlatProducts.slice(start, start + pageSize);
    }, [filteredFlatProducts, page, pageSize, groupByColor]);

    const toggleRow = (baseCode: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(baseCode)) {
                next.delete(baseCode);
            } else {
                next.add(baseCode);
            }
            return next;
        });
    };

    const expandAllCurrentPage = () => {
        setExpandedRows(new Set(paginatedGroupedProducts.map(p => p.baseCode)));
    };

    const collapseAll = () => {
        setExpandedRows(new Set());
    };

    const copySkuToClipboard = (sku: string) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(sku);
            setCopiedSku(sku);
            setTimeout(() => setCopiedSku(null), 2000);
        }
    };

    const isLoading = (allProducts.length === 0 && isLoadingCatalog) || (summary.length === 0 && isLoadingInventory);

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-cyan-100 text-cyan-700">
                        <Boxes className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Catálogo de Productos</h1>
                        <p className="text-slate-500">Consulta de productos, listas de precios, variantes por color e inventario disponible.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setGroupByColor(!groupByColor)}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm border ${
                            groupByColor 
                                ? "bg-cyan-600 text-white border-cyan-600 hover:bg-cyan-700 shadow-cyan-200" 
                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                        }`}
                        title="Alternar entre agrupación por producto sin color y lista individual plana"
                    >
                        <Layers className="w-4 h-4" />
                        <span>{groupByColor ? "Agrupado por producto" : "Vista plana (con color)"}</span>
                    </button>
                </div>
            </header>

            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input 
                        value={search} 
                        onChange={event => setSearch(event.target.value)} 
                        placeholder="Buscar por código, descripción o color: 48x43 Lavamanos, Blanco, Marfil..." 
                        className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800 placeholder-slate-400" 
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
                    <label className="flex items-center gap-2 mt-5 text-sm font-semibold text-slate-700 cursor-pointer select-none">
                        <input type="checkbox" checked={onlyAvailable} onChange={event => setOnlyAvailable(event.target.checked)} className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500" /> 
                        Solo disponibles
                    </label>
                    <label className="flex items-center gap-2 mt-5 text-sm font-semibold text-slate-700 cursor-pointer select-none">
                        <input type="checkbox" checked={onlyFeria} onChange={event => setOnlyFeria(event.target.checked)} className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500" /> 
                        Productos de feria
                    </label>
                    <div className="flex items-center justify-between mt-5 text-sm text-slate-600 font-medium">
                        <div className="flex items-center gap-1.5">
                            <Filter className="w-4 h-4 text-cyan-600" /> 
                            <span>{totalItems} {groupByColor ? (totalItems === 1 ? "producto base" : "productos base") : (totalItems === 1 ? "artículo" : "artículos")}</span>
                        </div>
                        {groupByColor && paginatedGroupedProducts.length > 0 && (
                            <div className="flex items-center gap-1 text-xs">
                                <button
                                    type="button"
                                    onClick={expandAllCurrentPage}
                                    className="text-cyan-700 hover:text-cyan-900 font-semibold hover:underline"
                                >
                                    Expandir
                                </button>
                                <span className="text-slate-300">/</span>
                                <button
                                    type="button"
                                    onClick={collapseAll}
                                    className="text-slate-500 hover:text-slate-700 font-semibold hover:underline"
                                >
                                    Colapsar
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {isLoading && (
                <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-600" /> Cargando catálogo de productos...
                </div>
            )}

            {!isLoading && (
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse min-w-[1050px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-3.5 px-4 w-[240px]">Artículo</th>
                                    <th className="py-3.5 px-4">Descripción</th>
                                    <th className="py-3.5 px-4">Familia / Planta</th>
                                    <th className="py-3.5 px-4 text-right">PVP (Propio)</th>
                                    <th className="py-3.5 px-4 text-right">Base COP (Dist.)</th>
                                    <th className="py-3.5 px-4 text-right">Obras Nac.</th>
                                    <th className="py-3.5 px-4 text-right">Exportación</th>
                                    <th className="py-3.5 px-4 text-right">PVP Sin IVA</th>
                                    <th className="py-3.5 px-4 text-right">Precio Feria</th>
                                    <th className="py-3.5 px-4 text-center">Disponible</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {groupByColor && paginatedGroupedProducts.map(group => {
                                    const isExpanded = expandedRows.has(group.baseCode);
                                    const hasMultipleVariants = group.variants.length > 1;

                                    return (
                                        <React.Fragment key={group.baseCode}>
                                            <tr 
                                                onClick={() => toggleRow(group.baseCode)}
                                                className={`cursor-pointer transition-colors ${
                                                    isExpanded ? "bg-cyan-50/50 hover:bg-cyan-50/80" : "hover:bg-slate-50/80"
                                                }`}
                                            >
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`p-1 rounded-md text-slate-400 transition-transform ${isExpanded ? "rotate-180 text-cyan-700" : ""}`}>
                                                            <ChevronDown className="w-4 h-4" />
                                                        </span>
                                                        <span className="font-mono text-xs font-bold text-cyan-800">
                                                            {group.baseCode}
                                                        </span>
                                                        <span 
                                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                hasMultipleVariants 
                                                                    ? "bg-cyan-100 text-cyan-800" 
                                                                    : "bg-slate-100 text-slate-600"
                                                            }`}
                                                        >
                                                            <Palette className="w-3 h-3" />
                                                            {group.variants.length} {group.variants.length === 1 ? "color" : "colores"}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 font-medium text-slate-900 max-w-[380px]">
                                                    {group.descripcion}
                                                </td>
                                                <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1">
                                                        <span className="font-semibold text-slate-700">{group.familia || "-"}</span>
                                                        <span className="text-slate-300">•</span>
                                                        <span>{group.planta || "-"}</span>
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right font-bold text-slate-800 whitespace-nowrap">
                                                    {group.distribuidor_pvp_iva ? money.format(group.distribuidor_pvp_iva) : "-"}
                                                </td>
                                                <td className="py-3 px-4 text-right font-semibold text-slate-700 whitespace-nowrap">
                                                    {group.lista_base_cop ? money.format(group.lista_base_cop) : "-"}
                                                </td>
                                                <td className="py-3 px-4 text-right font-semibold text-slate-700 whitespace-nowrap">
                                                    {group.lista_base_obras ? money.format(group.lista_base_obras) : "-"}
                                                </td>
                                                <td className="py-3 px-4 text-right font-semibold text-slate-700 whitespace-nowrap">
                                                    {group.lista_base_exportaciones ? money.format(group.lista_base_exportaciones) : "-"}
                                                </td>
                                                <td className="py-3 px-4 text-right text-slate-600 whitespace-nowrap">
                                                    {group.pvp_sin_iva ? money.format(group.pvp_sin_iva) : "-"}
                                                </td>
                                                <td className="py-3 px-4 text-right font-semibold text-slate-700 whitespace-nowrap">
                                                    {group.precio_feria ? money.format(group.precio_feria) : "-"}
                                                </td>
                                                <td className="py-3 px-4 text-center whitespace-nowrap">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${group.totalDisponible > 0 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                                                        {group.totalDisponible > 0 ? `${group.totalDisponible} disp.` : "Agotado"}
                                                    </span>
                                                </td>
                                            </tr>

                                            {/* Sub-tabla desplegable con las variantes de color */}
                                            {isExpanded && (
                                                <tr className="bg-slate-50/70 border-b border-slate-200">
                                                    <td colSpan={10} className="py-3 px-6">
                                                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
                                                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                                                                    <Palette className="w-4 h-4 text-cyan-600" />
                                                                    <span>Variantes por color disponibles ({group.variants.length})</span>
                                                                </div>
                                                                <span className="text-xs text-slate-400">
                                                                    Stock total agrupado: <strong className="text-slate-700">{group.totalDisponible} unids</strong>
                                                                </span>
                                                            </div>

                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-xs text-left">
                                                                    <thead>
                                                                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                                                            <th className="py-2 px-3">Color / Acabado</th>
                                                                            <th className="py-2 px-3">SKU Completo</th>
                                                                            <th className="py-2 px-3">Descripción Variante</th>
                                                                            <th className="py-2 px-3 text-right">PVP</th>
                                                                            <th className="py-2 px-3 text-right">Base COP</th>
                                                                            <th className="py-2 px-3 text-center">Stock Variante</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100">
                                                                        {group.variants.map(variant => (
                                                                            <tr key={variant.id} className="hover:bg-slate-50/80 transition-colors">
                                                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300 border border-slate-400" />
                                                                                        <span className="font-bold text-slate-800">
                                                                                            {variant.color_name}
                                                                                        </span>
                                                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                                                            ({variant.color_code})
                                                                                        </span>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="py-2.5 px-3 font-mono font-semibold text-cyan-700 whitespace-nowrap">
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <span>{variant.numero_articulo}</span>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                copySkuToClipboard(variant.numero_articulo);
                                                                                            }}
                                                                                            className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
                                                                                            title="Copiar SKU"
                                                                                        >
                                                                                            {copiedSku === variant.numero_articulo ? (
                                                                                                <Check className="w-3 h-3 text-emerald-600" />
                                                                                            ) : (
                                                                                                <Copy className="w-3 h-3" />
                                                                                            )}
                                                                                        </button>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-slate-600 max-w-[320px]">
                                                                                    {variant.descripcion}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right font-medium text-slate-800 whitespace-nowrap">
                                                                                    {variant.distribuidor_pvp_iva ? money.format(variant.distribuidor_pvp_iva) : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right text-slate-600 whitespace-nowrap">
                                                                                    {variant.lista_base_cop ? money.format(variant.lista_base_cop) : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                                    <span className={`px-2 py-0.5 rounded-full font-bold ${
                                                                                        variant.disponible > 0 
                                                                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                                                                                            : "bg-slate-50 text-slate-400 border border-slate-200"
                                                                                    }`}>
                                                                                        {variant.disponible > 0 ? `${variant.disponible} disp.` : "Sin existencias"}
                                                                                    </span>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}

                                {!groupByColor && paginatedFlatProducts.map(product => {
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

                                {totalItems === 0 && (
                                    <tr>
                                        <td colSpan={10} className="py-12 text-center text-slate-400">
                                            No se encontraron productos que coincidan con la búsqueda.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalItems > 0 && (
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
                                    <option value={0}>Todos ({totalItems})</option>
                                </select>
                                <span className="text-slate-400">|</span>
                                <span>
                                    Mostrando {pageSize === 0 ? 1 : Math.min((page - 1) * pageSize + 1, totalItems)} a {pageSize === 0 ? totalItems : Math.min(page * pageSize, totalItems)} de {totalItems}
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
