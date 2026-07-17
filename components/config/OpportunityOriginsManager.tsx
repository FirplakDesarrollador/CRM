"use client";

import { useState } from "react";
import { Loader2, Plus, Save, Tags } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useOpportunityOrigins } from "@/lib/hooks/useOpportunityOrigins";

function toCode(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
}

export function OpportunityOriginsManager() {
    const { origins, isLoading, error, refresh } = useOpportunityOrigins(true);
    const [newName, setNewName] = useState("");
    const [savingId, setSavingId] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, { nombre: string; codigo: string; orden: number; is_active: boolean }>>({});

    const getDraft = (origin: (typeof origins)[number]) => drafts[origin.id] || {
        nombre: origin.nombre,
        codigo: origin.codigo,
        orden: origin.orden,
        is_active: origin.is_active,
    };

    const createOrigin = async () => {
        const nombre = newName.trim();
        if (!nombre) return;
        setSavingId("new");
        const { error: insertError } = await supabase.from("CRM_OrigenesOportunidad").insert({
            nombre,
            codigo: toCode(nombre),
            orden: origins.length ? Math.max(...origins.map(item => item.orden)) + 10 : 10,
        });
        setSavingId(null);
        if (insertError) return alert(`No se pudo crear el origen: ${insertError.message}`);
        setNewName("");
        await refresh();
    };

    const saveOrigin = async (id: string) => {
        const draft = drafts[id];
        if (!draft?.nombre.trim() || !draft.codigo.trim()) return;
        setSavingId(id);
        const { error: updateError } = await supabase
            .from("CRM_OrigenesOportunidad")
            .update({ ...draft, nombre: draft.nombre.trim(), codigo: toCode(draft.codigo), updated_at: new Date().toISOString() })
            .eq("id", id);
        setSavingId(null);
        if (updateError) return alert(`No se pudo actualizar el origen: ${updateError.message}`);
        setDrafts(current => {
            const next = { ...current };
            delete next[id];
            return next;
        });
        await refresh();
    };

    return (
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-700"><Tags className="w-5 h-5" /></div>
                <div>
                    <h3 className="font-bold text-slate-900 text-lg">Origenes de oportunidad</h3>
                    <p className="text-sm text-slate-500">Opciones editables que aparecen en Tiendas-Ferias.</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
                <input
                    value={newName}
                    onChange={event => setNewName(event.target.value)}
                    onKeyDown={event => event.key === "Enter" && void createOrigin()}
                    placeholder="Ej. Instagram, Referido, Feria Medellin"
                    className="flex-1 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button onClick={() => void createOrigin()} disabled={!newName.trim() || savingId === "new"} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                    {savingId === "new" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Crear origen
                </button>
            </div>

            {error && <p className="text-sm text-red-600">La tabla de origenes aun no esta disponible: {error}</p>}
            {isLoading ? <div className="text-sm text-slate-500">Cargando origenes...</div> : (
                <div className="space-y-2">
                    {origins.map(origin => {
                        const draft = getDraft(origin);
                        return (
                            <div key={origin.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_90px_auto_auto] gap-2 p-3 border border-slate-200 rounded-xl items-center">
                                <input value={draft.nombre} onChange={event => setDrafts(current => ({ ...current, [origin.id]: { ...draft, nombre: event.target.value } }))} className="border rounded-lg px-2 py-1.5" />
                                <input value={draft.codigo} onChange={event => setDrafts(current => ({ ...current, [origin.id]: { ...draft, codigo: event.target.value } }))} className="border rounded-lg px-2 py-1.5 font-mono text-xs" />
                                <input type="number" value={draft.orden} onChange={event => setDrafts(current => ({ ...current, [origin.id]: { ...draft, orden: Number(event.target.value) || 0 } }))} className="border rounded-lg px-2 py-1.5" />
                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_active} onChange={event => setDrafts(current => ({ ...current, [origin.id]: { ...draft, is_active: event.target.checked } }))} /> Activo</label>
                                <button onClick={() => void saveOrigin(origin.id)} disabled={!drafts[origin.id] || savingId === origin.id} className="p-2 rounded-lg bg-slate-900 text-white disabled:opacity-40" title="Guardar"><Save className="w-4 h-4" /></button>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

