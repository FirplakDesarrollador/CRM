"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { CalendarPlus, CheckCircle2, Eye, X } from "lucide-react";
import { db } from "@/lib/db";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { B2C_CHANNEL_ID, userHasB2CAccess } from "@/lib/b2c";
import { CreateActivityModal } from "@/components/activities/CreateActivityModal";

type CompletedActivity = {
    id: string;
    asunto?: string;
    tipo_actividad?: 'TAREA' | 'EVENTO';
    clasificacion_id?: number | null;
    subclasificacion_id?: number | null;
    fecha_inicio?: string;
    opportunity_id?: string | null;
    account_id?: string | null;
    prioridad?: 'Alta' | 'Media' | 'Baja' | null;
};

interface UseActivityFollowUpOptions {
    /** Persists the new activity (`useActivities().createActivity`). */
    createActivity: (data: Parameters<React.ComponentProps<typeof CreateActivityModal>['onSubmit']>[0]) => Promise<unknown> | unknown;
    /**
     * When provided, the completion dialog also shows a "Ver actividad" button
     * (used inside an opportunity, to open the activity that was just completed).
     */
    onViewActivity?: (activity: CompletedActivity) => void;
}

/** Same day-after at the original time (events) or 9:00 (tasks). */
function buildFollowUpDates(activity: CompletedActivity) {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    const original = activity.fecha_inicio ? new Date(activity.fecha_inicio) : null;
    if (activity.tipo_actividad === 'TAREA' || !original || Number.isNaN(original.getTime())) {
        start.setHours(9, 0, 0, 0);
    } else {
        start.setHours(original.getHours(), original.getMinutes(), 0, 0);
    }
    return { start, end: new Date(start.getTime() + 3600000) };
}

/**
 * B2C flow: after marking an activity as completed, offer to schedule the next follow-up
 * right there (same account/opportunity, type and classification already filled in).
 *
 * Only shown to B2C users (channel PROPIO / ADMIN) or when the activity belongs to a B2C account.
 *
 * Usage:
 *   const { requestFollowUp, resetFollowUp, followUpElement } = useActivityFollowUp({ createActivity });
 *   ... after completing: requestFollowUp(activity)   /   after re-opening: resetFollowUp(activity.id)
 *   ... render {followUpElement} once in the component.
 */
export function useActivityFollowUp({ createActivity, onViewActivity }: UseActivityFollowUpOptions) {
    const { user } = useCurrentUser();
    const [pending, setPending] = useState<CompletedActivity | null>(null);
    const [scheduling, setScheduling] = useState(false);
    // Avoid prompting twice for the same activity (e.g. autosave + explicit save in the edit modal)
    const promptedIds = useRef<Set<string>>(new Set());

    const requestFollowUp = useCallback(async (activity: CompletedActivity | null | undefined) => {
        if (!activity?.id || promptedIds.current.has(activity.id)) return;
        promptedIds.current.add(activity.id);

        let allowed = userHasB2CAccess(user);
        if (!allowed) {
            try {
                let accountId = activity.account_id || null;
                if (!accountId && activity.opportunity_id) {
                    accountId = (await db.opportunities.get(activity.opportunity_id))?.account_id || null;
                }
                if (accountId) allowed = (await db.accounts.get(accountId))?.canal_id === B2C_CHANNEL_ID;
            } catch (e) {
                console.warn("[ActivityFollowUp] could not resolve account channel", e);
            }
        }
        if (allowed) setPending(activity);
    }, [user]);

    const resetFollowUp = useCallback((activityId: string) => {
        promptedIds.current.delete(activityId);
    }, []);

    const close = () => {
        setPending(null);
        setScheduling(false);
    };

    let followUpElement: ReactNode = null;
    if (pending && !scheduling) {
        followUpElement = (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900">Actividad completada</h3>
                            <p className="text-sm text-slate-500 truncate" title={pending.asunto}>{pending.asunto}</p>
                            <p className="text-sm text-slate-600 mt-2">¿Quieres programar el siguiente seguimiento ahora?</p>
                        </div>
                        <button type="button" onClick={close} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                        {onViewActivity && (
                            <button
                                type="button"
                                onClick={() => {
                                    const activity = pending;
                                    close();
                                    onViewActivity(activity);
                                }}
                                className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 flex items-center justify-center gap-2"
                            >
                                <Eye className="w-4 h-4" />
                                Ver actividad
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={close}
                            className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
                        >
                            Ahora no
                        </button>
                        <button
                            type="button"
                            onClick={() => setScheduling(true)}
                            className="px-3 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2"
                        >
                            <CalendarPlus className="w-4 h-4" />
                            Programar seguimiento
                        </button>
                    </div>
                </div>
            </div>
        );
    } else if (pending && scheduling) {
        const { start, end } = buildFollowUpDates(pending);
        followUpElement = (
            <CreateActivityModal
                onClose={close}
                onSubmit={async (data) => {
                    await createActivity(data);
                    close();
                }}
                initialOpportunityId={pending.opportunity_id || undefined}
                initialAccountId={pending.account_id || undefined}
                initialValues={{
                    asunto: pending.asunto ? `Seguimiento: ${pending.asunto}` : undefined,
                    tipo_actividad: pending.tipo_actividad || 'EVENTO',
                    clasificacion_id: pending.clasificacion_id ?? null,
                    subclasificacion_id: pending.subclasificacion_id ?? null,
                    prioridad: pending.prioridad || undefined,
                    fecha_inicio: start,
                    fecha_fin: end,
                }}
            />
        );
    }

    return { requestFollowUp, resetFollowUp, followUpElement };
}
