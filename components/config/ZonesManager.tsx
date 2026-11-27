"use client";

import { useState } from "react";
import { Loader2, MapPin, Plus, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useZones } from "@/lib/hooks/useZones";

function toZoneCode(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
}

export function ZonesManager() {
    const { zones, isLoading, error, refresh } = useZones(true);
    const [newName, setNewName] = useState("");
    const [savingId, setSavingId] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<
        Record<string, { nombre: string; codigo: string; orden: number; is_active: boolean }>
    >({});

    const getDraft = (zone: (typeof zones)[number]) =>
        drafts[zone.id] || {
            nombre: zone.nombre,
            codigo: zone.codigo,
            orden: zone.orden,
            is_active: zone.is_active,
        };

    const createZone = async () => {
        const nombre = newName.trim();
        if (!nombre) return;
        setSavingId("new");
        const { error: insertError } = await supabase.from("CRM_Zonas").insert({
            nombre,
            codigo: toZoneCode(nombre),
            orden: zones.length ? Math.max(...zones.map((item) => item.orden)) + 10 : 10,
            is_active: true,
        });
        setSavingId(null);
        if (insertError) {
            alert(`No se pudo crear la zona: ${insertError.message}`);
            return;
        }
        setNewName("");
        await refresh();
    };

    const saveZone = async (id: string) => {
        const draft = drafts[id];
        if (!draft?.nombre.trim() || !draft.codigo.trim()) return;
        setSavingId(id);
        const { error: updateError } = await supabase
            .from("CRM_Zonas")
            .update({
                nombre: draft.nombre.trim(),
                codigo: toZoneCode(draft.codigo),
                orden: draft.orden,
                is_active: draft.is_active,
                updated_at: new Date().toISOString(),
            })
            .eq("id", id);
        setSavingId(null);
        if (updateError) {
            alert(`No se pudo actualizar la zona: ${updateError.message}`);
            return;
        }
        setDrafts((current) => {
            const next = { ...current };
            delete next[id];
            return next;
        });
        await refresh();
    };

    return (
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-sky-100 text-sky-700">
                    <MapPin className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 text-lg">Zonas comerciales</h3>
                    <p className="text-sm text-slate-500">
                        Catálogo editable de zonas asignables a los vendedores para nombrar sucursales de cuentas.
                    </p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
                <input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && void createZone()}
                    placeholder="Ej. Costa, Antioquia, Centro, Valle, Santanderes"
                    className="flex-1 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                    type="button"
                    onClick={() => void createZone()}
                    disabled={!newName.trim() || savingId === "new"}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                    {savingId === "new" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Crear zona
                </button>
            </div>

            {error && <p className="text-sm text-red-600">La tabla de zonas aún no está disponible: {error}</p>}
            {isLoading ? (
                <div className="text-sm text-slate-500">Cargando zonas...</div>
            ) : (
                <div className="space-y-2">
                    {zones.map((zone) => {
                        const draft = getDraft(zone);
                        return (
                            <div
                                key={zone.id}
                                className="grid grid-cols-1 md:grid-cols-[1fr_1fr_80px_auto_auto] gap-2 p-3 border border-slate-200 rounded-xl items-center"
                            >
                                <input
                                    value={draft.nombre}
                                    onChange={(event) =>
                                        setDrafts((current) => ({
                                            ...current,
                                            [zone.id]: { ...draft, nombre: event.target.value },
                                        }))
                                    }
                                    className="border rounded-lg px-2 py-1.5 text-sm font-medium"
                                />
                                <input
                                    value={draft.codigo}
                                    onChange={(event) =>
                                        setDrafts((current) => ({
                                            ...current,
                                            [zone.id]: { ...draft, codigo: event.target.value },
                                        }))
                                    }
                                    className="border rounded-lg px-2 py-1.5 font-mono text-xs"
                                />
                                <input
                                    type="number"
                                    value={draft.orden}
                                    onChange={(event) =>
                                        setDrafts((current) => ({
                                            ...current,
                                            [zone.id]: { ...draft, orden: Number(event.target.value) || 0 },
                                        }))
                                    }
                                    className="border rounded-lg px-2 py-1.5 text-sm"
                                />
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={draft.is_active}
                                        onChange={(event) =>
                                            setDrafts((current) => ({
                                                ...current,
                                                [zone.id]: { ...draft, is_active: event.target.checked },
                                            }))
                                        }
                                        className="rounded text-sky-600 focus:ring-sky-500"
                                    />
                                    Activa
                                </label>
                                <button
                                    type="button"
                                    onClick={() => void saveZone(zone.id)}
                                    disabled={!drafts[zone.id] || savingId === zone.id}
                                    className="p-2 rounded-lg bg-slate-900 text-white disabled:opacity-40 hover:bg-slate-800 transition-colors"
                                    title="Guardar"
                                >
                                    <Save className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
