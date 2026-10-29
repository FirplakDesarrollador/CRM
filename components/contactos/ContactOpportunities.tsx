"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, ChevronRight, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { cn } from "@/components/ui/utils";
import { formatNumberCO } from "@/lib/utils";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { isSellerRole, sellerCanSeeOpportunity } from "@/lib/sellerVisibility";

interface ContactOpportunitiesProps {
    contactId: string;
    accountId: string;
}

type ContactOpportunityRow = {
    id: string;
    nombre: string | null;
    amount: number | null;
    currency_id: string | null;
    fase: string | null;
    linked: boolean;
    owner_user_id?: string | null;
};

/** URL of the "new opportunity" wizard with the account and the contact already selected. */
export function newOpportunityUrlForContact(accountId: string, contactId: string) {
    return `/oportunidades/nueva?account_id=${encodeURIComponent(accountId)}&contact_id=${encodeURIComponent(contactId)}`;
}

/**
 * Opportunities of a contact's account, so the user can jump to one (or create a new one with the
 * account/contact prefilled) without leaving the contact. Opportunities that explicitly list the contact in
 * `contactos_ids` are marked and shown first; the rest of the account's opportunities follow.
 */
export function ContactOpportunities({ contactId, accountId }: ContactOpportunitiesProps) {
    const [rows, setRows] = useState<ContactOpportunityRow[] | null>(null);
    const { user: currentUser, role } = useCurrentUser();
    const sellerId = isSellerRole(role) ? currentUser?.id || null : null;

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            let result: ContactOpportunityRow[] | null = null;

            if (typeof navigator === 'undefined' || navigator.onLine) {
                try {
                    const { data, error } = await supabase
                        .from('CRM_Oportunidades')
                        .select('id, nombre, amount, currency_id, owner_user_id, contactos_ids, fase_data:CRM_FasesOportunidad(nombre)')
                        .eq('account_id', accountId)
                        .eq('is_deleted', false)
                        .order('updated_at', { ascending: false })
                        .limit(50);
                    if (!error && data) {
                        type SupabaseOppRecord = {
                            id: string;
                            nombre?: string | null;
                            amount?: number | null;
                            currency_id?: string | null;
                            fase_data?: { nombre?: string | null } | null;
                            contactos_ids?: string[] | null;
                            owner_user_id?: string | null;
                        };
                        result = (data as unknown as SupabaseOppRecord[]).map(o => ({
                            id: o.id,
                            nombre: o.nombre || null,
                            amount: o.amount ?? null,
                            currency_id: o.currency_id || null,
                            fase: o.fase_data?.nombre || null,
                            linked: Array.isArray(o.contactos_ids) && o.contactos_ids.includes(contactId),
                            owner_user_id: o.owner_user_id ?? null
                        }));
                    }
                } catch (e) {
                    console.warn("[ContactOpportunities] online fetch failed, using local copy", e);
                }
            }

            if (!result) {
                const [local, phases] = await Promise.all([
                    db.opportunities.where('account_id').equals(accountId).filter(o => !o.is_deleted).toArray(),
                    db.phases.toArray()
                ]);
                const phaseMap = new Map(phases.map(p => [p.id, p.nombre]));
                result = local.map(o => ({
                    id: o.id,
                    nombre: o.nombre ?? null,
                    amount: o.amount ?? null,
                    currency_id: o.currency_id ?? null,
                    fase: phaseMap.get(Number(o.fase_id)) || null,
                    linked: Array.isArray(o.contactos_ids) && o.contactos_ids.includes(contactId),
                    owner_user_id: o.owner_user_id ?? null
                }));
            }

            // Asesor (VENDEDOR): solo sus oportunidades (dueño) o donde es colaborador.
            if (sellerId) {
                const collabs = await db.opportunityCollaborators.where('usuario_id').equals(sellerId).toArray();
                const collabOppIds = new Set(collabs.filter(c => !c.is_deleted).map(c => c.oportunidad_id));
                result = result.filter(o => sellerCanSeeOpportunity(o, sellerId, collabOppIds));
            }

            result.sort((a, b) => Number(b.linked) - Number(a.linked));
            if (!cancelled) setRows(result);
        };

        load();
        return () => { cancelled = true; };
    }, [accountId, contactId, sellerId]);

    return (
        <section className="mt-6 space-y-3" data-testid="contact-opportunities">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                    Oportunidades
                    {rows && <span className="text-xs font-semibold text-slate-400">({rows.length})</span>}
                </h3>
                <Link
                    href={newOpportunityUrlForContact(accountId, contactId)}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors border border-blue-100"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Nueva oportunidad
                </Link>
            </div>

            {rows === null ? (
                <p className="text-sm text-slate-400">Cargando oportunidades...</p>
            ) : rows.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <p className="text-sm text-slate-500">Este contacto aún no tiene oportunidades. Crea la primera con la cuenta y el contacto ya cargados.</p>
                </div>
            ) : (
                <div className="grid gap-2">
                    {rows.map(opp => (
                        <Link
                            key={opp.id}
                            href={`/oportunidades/${opp.id}`}
                            className="bg-white p-3 rounded-xl border border-slate-200 hover:border-blue-400 transition-all flex justify-between items-center group shadow-sm"
                        >
                            <div className="min-w-0 pr-3">
                                <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors truncate">
                                    {opp.nombre || "Sin nombre"}
                                </h4>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    <span className="font-semibold text-blue-600">{opp.fase || 'Prospecto'}</span>
                                    <span className="mx-1.5 text-slate-300">•</span>
                                    {opp.currency_id || 'COP'} {formatNumberCO(opp.amount)}
                                    {opp.linked && (
                                        <span className={cn("ml-2 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-wider border border-emerald-100")}>
                                            Del contacto
                                        </span>
                                    )}
                                </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 shrink-0" />
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
}
