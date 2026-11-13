"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { downloadExcel } from "@/lib/utils/informes";
import { ArchiveRestore, Download, Eye, Loader2, RefreshCw, X } from "lucide-react";

type Tipo = "CUENTA" | "OPORTUNIDAD" | "CONTACTO";

interface Eliminacion {
    id: string;
    tipo: Tipo;
    tabla_origen: string;
    registro_id: string;
    nombre_registro: string | null;
    cuenta_id: string | null;
    snapshot: Record<string, unknown> | null;
    eliminado_por: string | null;
    eliminado_por_nombre: string | null;
    eliminado_por_email: string | null;
    eliminado_por_rol: string | null;
    fecha_eliminacion: string;
    resultado: "EXITOSO" | "FALLIDO";
    motivo_fallo: string | null;
    origen_accion: string | null;
    eliminacion_padre_id: string | null;
    restaurado: boolean;
    restaurado_por: string | null;
    fecha_restauracion: string | null;
}

const fmtFecha = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" }) : "";

export default function EliminacionesPage() {
    const { role, isLoading: loadingUser } = useCurrentUser();
    const allowed = role === "ADMIN" || role === "COORDINADOR";

    const [rows, setRows] = useState<Eliminacion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [asesor, setAsesor] = useState("");
    const [tipo, setTipo] = useState("");
    const [resultado, setResultado] = useState("");
    const [desde, setDesde] = useState("");
    const [hasta, setHasta] = useState("");
    const [detalle, setDetalle] = useState<Eliminacion | null>(null);
    const [restoring, setRestoring] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(null);
        let q = supabase.from("CRM_Vista_Eliminaciones_Asesores").select("*").order("fecha_eliminacion", { ascending: false }).limit(2000);
        if (asesor) q = asesor === "__SISTEMA__" ? q.is("eliminado_por", null) : q.eq("eliminado_por", asesor);
        if (tipo) q = q.eq("tipo", tipo);
        if (resultado) q = q.eq("resultado", resultado);
        if (desde) q = q.gte("fecha_eliminacion", `${desde}T00:00:00-05:00`);
        if (hasta) q = q.lte("fecha_eliminacion", `${hasta}T23:59:59-05:00`);
        const { data, error } = await q;
        if (error) setError(error.message);
        setRows((data as Eliminacion[]) || []);
        setLoading(false);
    }, [asesor, tipo, resultado, desde, hasta]);

    useEffect(() => {
        if (!allowed) return;
        const t = setTimeout(() => { void cargar(); }, 0);
        return () => clearTimeout(t);
    }, [allowed, cargar]);

    const [asesores, setAsesores] = useState<{ id: string; nombre: string }[]>([]);
    useEffect(() => {
        if (!allowed) return;
        supabase.from("CRM_Usuarios").select("id, full_name, email").order("full_name").then(({ data }) => {
            setAsesores(((data || []) as { id: string; full_name: string | null; email: string }[]).map((u) => ({ id: u.id, nombre: u.full_name || u.email })));
        });
    }, [allowed]);

    const resumen = useMemo(() => ({
        total: rows.length,
        exitosas: rows.filter(r => r.resultado === "EXITOSO").length,
        fallidas: rows.filter(r => r.resultado === "FALLIDO").length,
        restauradas: rows.filter(r => r.restaurado).length,
    }), [rows]);

    const restaurar = async (r: Eliminacion) => {
        const extra = r.tipo === "CUENTA" ? " Se restaurarán también los contactos y oportunidades eliminados en cascada con ella." : "";
        if (!confirm(`¿Restaurar ${r.tipo.toLowerCase()} "${r.nombre_registro || r.registro_id}"?${extra}`)) return;
        setRestoring(r.id);
        const { data, error } = await supabase.rpc("crm_restaurar_eliminado", { p_backup_id: r.id });
        setRestoring(null);
        if (error) {
            alert("No se pudo restaurar: " + error.message);
            return;
        }
        const hijos = (data as { hijos_restaurados?: number } | null)?.hijos_restaurados;
        alert(`Registro restaurado.${hijos ? ` Registros hijos restaurados: ${hijos}.` : ""} Se verá en el CRM tras la próxima sincronización.`);
        cargar();
    };

    const exportar = () => {
        const data = rows.map(r => ({
            fecha: fmtFecha(r.fecha_eliminacion),
            tipo: r.tipo,
            nombre: r.nombre_registro || "",
            registro_id: r.registro_id,
            asesor: r.eliminado_por_nombre || (r.eliminado_por ? "" : "SISTEMA"),
            email: r.eliminado_por_email || "",
            rol: r.eliminado_por_rol || "",
            resultado: r.resultado,
            motivo_fallo: r.motivo_fallo || "",
            origen: r.origen_accion || "",
            restaurado: r.restaurado ? "Sí" : "No",
            fecha_restauracion: fmtFecha(r.fecha_restauracion),
        }));
        downloadExcel(data, [
            { header: "Fecha (Colombia)", key: "fecha", width: 18 },
            { header: "Tipo", key: "tipo", width: 14 },
            { header: "Nombre", key: "nombre", width: 40 },
            { header: "ID registro", key: "registro_id", width: 38 },
            { header: "Eliminado por", key: "asesor", width: 28 },
            { header: "Email", key: "email", width: 30 },
            { header: "Rol", key: "rol", width: 14 },
            { header: "Resultado", key: "resultado", width: 12 },
            { header: "Motivo fallo", key: "motivo_fallo", width: 40 },
            { header: "Origen", key: "origen", width: 16 },
            { header: "Restaurado", key: "restaurado", width: 12 },
            { header: "Fecha restauración", key: "fecha_restauracion", width: 18 },
        ], "Eliminaciones_CRM", "Eliminaciones");
    };

    if (loadingUser) return <div className="p-6 text-slate-500">Cargando...</div>;
    if (!allowed) {
        return <div className="p-6 text-slate-600">Esta sección solo está disponible para administradores y coordinadores.</div>;
    }

    const sel = "border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white";

    return (
        <div className="p-4 md:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <ArchiveRestore className="w-6 h-6" /> Eliminaciones
                    </h1>
                    <p className="text-sm text-slate-500">Respaldo de cuentas, oportunidades y contactos eliminados, con quién y cuándo lo hizo.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={cargar} className="px-3 py-2 text-sm border border-slate-200 rounded-lg flex items-center gap-2 hover:bg-slate-50">
                        <RefreshCw className="w-4 h-4" /> Actualizar
                    </button>
                    <button onClick={exportar} disabled={!rows.length} className="px-3 py-2 text-sm bg-[#254153] text-white rounded-lg flex items-center gap-2 disabled:opacity-50">
                        <Download className="w-4 h-4" /> Exportar Excel
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 items-end">
                <label className="text-xs text-slate-500 flex flex-col gap-1">Asesor
                    <select className={sel} value={asesor} onChange={e => setAsesor(e.target.value)}>
                        <option value="">Todos</option>
                        <option value="__SISTEMA__">SISTEMA (sin usuario)</option>
                        {asesores.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                </label>
                <label className="text-xs text-slate-500 flex flex-col gap-1">Tipo
                    <select className={sel} value={tipo} onChange={e => setTipo(e.target.value)}>
                        <option value="">Todos</option>
                        <option value="CUENTA">Cuentas</option>
                        <option value="OPORTUNIDAD">Oportunidades</option>
                        <option value="CONTACTO">Contactos</option>
                    </select>
                </label>
                <label className="text-xs text-slate-500 flex flex-col gap-1">Resultado
                    <select className={sel} value={resultado} onChange={e => setResultado(e.target.value)}>
                        <option value="">Todos</option>
                        <option value="EXITOSO">Exitoso</option>
                        <option value="FALLIDO">Fallido</option>
                    </select>
                </label>
                <label className="text-xs text-slate-500 flex flex-col gap-1">Desde
                    <input type="date" className={sel} value={desde} onChange={e => setDesde(e.target.value)} />
                </label>
                <label className="text-xs text-slate-500 flex flex-col gap-1">Hasta
                    <input type="date" className={sel} value={hasta} onChange={e => setHasta(e.target.value)} />
                </label>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
                <span className="px-3 py-1 rounded-full bg-slate-100">Total: {resumen.total}</span>
                <span className="px-3 py-1 rounded-full bg-green-50 text-green-700">Exitosas: {resumen.exitosas}</span>
                <span className="px-3 py-1 rounded-full bg-red-50 text-red-700">Fallidas: {resumen.fallidas}</span>
                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700">Restauradas: {resumen.restauradas}</span>
            </div>

            {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-left">
                        <tr>
                            <th className="px-3 py-2">Fecha</th>
                            <th className="px-3 py-2">Tipo</th>
                            <th className="px-3 py-2">Registro</th>
                            <th className="px-3 py-2">Eliminado por</th>
                            <th className="px-3 py-2">Resultado</th>
                            <th className="px-3 py-2">Origen</th>
                            <th className="px-3 py-2 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="p-6 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={7} className="p-6 text-center text-slate-400">No hay eliminaciones con estos filtros.</td></tr>
                        ) : rows.map(r => (
                            <tr key={r.id} className="border-t border-slate-100">
                                <td className="px-3 py-2 whitespace-nowrap">{fmtFecha(r.fecha_eliminacion)}</td>
                                <td className="px-3 py-2">{r.tipo}</td>
                                <td className="px-3 py-2 max-w-xs truncate" title={r.nombre_registro || r.registro_id}>{r.nombre_registro || r.registro_id}</td>
                                <td className="px-3 py-2">{r.eliminado_por_nombre || (r.eliminado_por ? r.eliminado_por_email : "SISTEMA")}{r.eliminado_por_rol ? <span className="text-xs text-slate-400"> · {r.eliminado_por_rol}</span> : null}</td>
                                <td className="px-3 py-2">
                                    <span className={r.resultado === "EXITOSO" ? "text-green-700" : "text-red-700"} title={r.motivo_fallo || ""}>{r.resultado}</span>
                                    {r.restaurado && <span className="ml-2 text-xs text-blue-700">Restaurado</span>}
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-500">{r.origen_accion}</td>
                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                    <button onClick={() => setDetalle(r)} className="p-1.5 rounded hover:bg-slate-100" title="Ver respaldo"><Eye className="w-4 h-4" /></button>
                                    {r.resultado === "EXITOSO" && !r.restaurado && (
                                        <button onClick={() => restaurar(r)} disabled={restoring === r.id} className="ml-1 px-2 py-1 text-xs rounded border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                                            {restoring === r.id ? "Restaurando..." : "Restaurar"}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {detalle && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDetalle(null)}>
                    <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] overflow-auto p-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="font-semibold">{detalle.tipo}: {detalle.nombre_registro || detalle.registro_id}</h2>
                            <button onClick={() => setDetalle(null)}><X className="w-5 h-5" /></button>
                        </div>
                        {detalle.motivo_fallo && <p className="text-sm text-red-700 mb-2">Motivo del fallo: {detalle.motivo_fallo}</p>}
                        <pre className="text-xs bg-slate-50 p-3 rounded-lg whitespace-pre-wrap break-all">{JSON.stringify(detalle.snapshot, null, 2)}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}
