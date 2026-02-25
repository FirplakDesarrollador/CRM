"use client";

import { useForm } from "react-hook-form";
import { CalendarClock, ListTodo, Loader2, Users, Search, X, Video, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/components/ui/utils";
import { toInputDate, toInputDateTime } from "@/lib/date-utils";
import { db, LocalActivityClassification, LocalActivitySubclassification } from "@/lib/db";
import { syncEngine } from "@/lib/sync";
import { supabase } from "@/lib/supabase";
import { DateTimePicker } from "@/components/ui/DateTimePicker";

interface CreateActivityModalProps {
    onClose: () => void;
    onSubmit: (data: any) => void;
    opportunities?: any[];
    initialOpportunityId?: string;
    initialData?: any;
}

export function CreateActivityModal({ onClose, onSubmit, opportunities, initialOpportunityId, initialData }: CreateActivityModalProps) {
    const isEditing = !!initialData;
    const { register, handleSubmit, watch, setValue, reset } = useForm({
        defaultValues: {
            asunto: initialData?.asunto || '',
            descripcion: initialData?.descripcion || '',
            tipo_actividad: (initialData?.tipo_actividad || 'EVENTO') as 'TAREA' | 'EVENTO',
            clasificacion_id: initialData?.clasificacion_id ? String(initialData.clasificacion_id) : "",
            subclasificacion_id: initialData?.subclasificacion_id ? String(initialData.subclasificacion_id) : "",
            fecha_inicio: initialData?.fecha_inicio
                ? (initialData.tipo_actividad === 'TAREA' ? toInputDate(initialData.fecha_inicio) : toInputDateTime(initialData.fecha_inicio))
                : (initialData?.tipo_actividad === 'TAREA' ? toInputDate(new Date()) : toInputDateTime(new Date())),
            fecha_fin: initialData?.fecha_fin
                ? toInputDateTime(initialData.fecha_fin)
                : toInputDateTime(new Date(Date.now() + 3600000)),
            opportunity_id: initialData?.opportunity_id || initialOpportunityId || '',
            is_completed: !!initialData?.is_completed
        }
    });

    const [msConnected, setMsConnected] = useState<boolean>(false);
    const [isTeamsMeeting, setIsTeamsMeeting] = useState<boolean>(false);
    const [attendees, setAttendees] = useState<{ id: string; name: string; email: string }[]>([]);
    const [userSearch, setUserSearch] = useState("");
    const [searchResults, setSearchResults] = useState<{ id: string; displayName: string; mail?: string; userPrincipalName?: string; jobTitle?: string }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Planner Integration State - Always sync tasks to Planner
    const [syncToPlanner, setSyncToPlanner] = useState<boolean>(true);
    const [plannerGroups, setPlannerGroups] = useState<{ id: string; displayName: string }[]>([]);
    const [plannerPlans, setPlannerPlans] = useState<{ id: string; title: string }[]>([]);
    const [plannerBuckets, setPlannerBuckets] = useState<{ id: string; name: string }[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>("");
    const [selectedPlanId, setSelectedPlanId] = useState<string>("");
    const [selectedBucketId, setSelectedBucketId] = useState<string>("");
    const [loadingPlanner, setLoadingPlanner] = useState<boolean>(false);
    const [checklist, setChecklist] = useState<string[]>([]);
    const [newChecklistItem, setNewChecklistItem] = useState("");

    // Planner Status Sync State
    const [isSyncingPlanner, setIsSyncingPlanner] = useState<boolean>(false);

    // Sync Feedback State
    const [syncFeedback, setSyncFeedback] = useState<{
        planner?: 'success' | 'error' | null;
        teams?: 'success' | 'error' | null;
        message?: string;
    }>({});

    // Check Microsoft Connection
    useEffect(() => {
        async function checkMS() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('CRM_MicrosoftTokens')
                .select('user_id')
                .eq('user_id', user.id)
                .maybeSingle();

            setMsConnected(!!data);
        }
        checkMS();
    }, []);

    useEffect(() => {
        async function syncPlannerStatus() {
            if (!initialData || !initialData.ms_planner_id || initialData.is_completed) return;

            setIsSyncingPlanner(true);
            try {
                const res = await fetch(`/api/microsoft/planner/tasks/${initialData.ms_planner_id}`, { credentials: 'include' });
                if (res.ok) {
                    const taskData = await res.json();

                    if (taskData.percentComplete === 100) {
                        console.log(`[CreateActivityModal] Task ${initialData.ms_planner_id} marked 100% in Planner, auto-completing locally.`);
                        setValue('is_completed', true);

                        // We do an early auto-save if they just open and it's 100%. 
                        const updatedData = { ...initialData, is_completed: true };
                        onSubmit(updatedData);
                    }
                } else {
                    console.error("[CreateActivityModal] Failed to sync planner status:", await res.text());
                }
            } catch (err) {
                console.error("[CreateActivityModal] Error fetching planner task:", err);
            } finally {
                setIsSyncingPlanner(false);
            }
        }
        syncPlannerStatus();
    }, [initialData, setValue, onSubmit]); // Fixed dependencies

    // Load Catalogs
    const classifications = useLiveQuery(() => db.activityClassifications.toArray(), []) || [];
    const subclassifications = useLiveQuery(() => db.activitySubclassifications.toArray(), []) || [];

    // PROACTIVE SYNC: If catalogs are empty, trigger a pull
    useEffect(() => {
        if (classifications.length === 0 && navigator.onLine) {
            console.log("[CreateActivityModal] Catalogs empty, triggering sync...");
            syncEngine.triggerSync();
        }
    }, [classifications.length]);

    // DEBUG: Log initialData to diagnose classification issue
    console.log("[CreateActivityModal] initialData received:", initialData);
    console.log("[CreateActivityModal] clasificacion_id:", initialData?.clasificacion_id, "type:", typeof initialData?.clasificacion_id);
    console.log("[CreateActivityModal] Available classifications:", classifications.length);


    // Force form reset when initialData changes OR when classifications finish loading
    // This fixes the timing issue where the select options don't exist yet when form resets
    useEffect(() => {
        if (initialData && classifications.length > 0) {
            console.log("[CreateActivityModal] Resetting form with classifications loaded:", classifications.length);
            reset({
                asunto: initialData.asunto || '',
                descripcion: initialData.descripcion || '',
                tipo_actividad: (initialData.tipo_actividad || 'EVENTO') as 'TAREA' | 'EVENTO',
                clasificacion_id: initialData.clasificacion_id ? String(initialData.clasificacion_id) : "",
                subclasificacion_id: initialData.subclasificacion_id ? String(initialData.subclasificacion_id) : "",
                fecha_inicio: initialData.fecha_inicio
                    ? (initialData.tipo_actividad === 'TAREA' ? toInputDate(initialData.fecha_inicio) : toInputDateTime(initialData.fecha_inicio))
                    : (initialData.tipo_actividad === 'TAREA' ? toInputDate(new Date()) : toInputDateTime(new Date())),
                fecha_fin: initialData.fecha_fin
                    ? toInputDateTime(initialData.fecha_fin)
                    : toInputDateTime(new Date(Date.now() + 3600000)),
                opportunity_id: initialData.opportunity_id || initialOpportunityId || '',
                is_completed: !!initialData.is_completed
            });
        }
    }, [initialData, reset, initialOpportunityId, classifications.length]);

    // Handle User Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (userSearch.length >= 2) {
                setIsSearching(true);
                try {
                    const res = await fetch(`/api/microsoft/users?q=${encodeURIComponent(userSearch)}`);
                    if (res.ok) {
                        const data = await res.json();
                        setSearchResults(data);
                    }
                } catch (error) {
                    console.error("Error searching users:", error);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [userSearch]);

    const addAttendee = (user: any) => {
        console.log("[CreateActivityModal] Selecting attendee:", user);
        if (!attendees.find(a => a.id === user.id)) {
            const newAttendee = {
                id: user.id,
                name: user.displayName,
                email: user.mail || user.userPrincipalName
            };
            console.log("[CreateActivityModal] Adding new attendee:", newAttendee);
            setAttendees([...attendees, newAttendee]);
        } else {
            console.log("[CreateActivityModal] Attendee already in list");
        }
        setUserSearch("");
        setSearchResults([]);
    };

    const removeAttendee = (id: string) => {
        setAttendees(attendees.filter(a => a.id !== id));
    };

    const addChecklistItem = () => {
        if (newChecklistItem.trim()) {
            setChecklist([...checklist, newChecklistItem.trim()]);
            setNewChecklistItem("");
        }
    };

    const removeChecklistItem = (index: number) => {
        setChecklist(checklist.filter((_, i) => i !== index));
    };

    // Planner: Load Groups when sync is enabled
    const tipoActividad = watch('tipo_actividad');
    useEffect(() => {
        if (syncToPlanner && msConnected && tipoActividad === 'TAREA') {
            console.log('[Planner] Loading groups... msConnected:', msConnected, 'tipo:', tipoActividad);
            setLoadingPlanner(true);
            fetch('/api/microsoft/planner/groups', { credentials: 'include' })
                .then(res => {
                    console.log('[Planner] Groups response status:', res.status);
                    return res.json();
                })
                .then(data => {
                    console.log('[Planner] Groups data received:', data);
                    const groups = data.groups || [];
                    setPlannerGroups(groups);
                    // Auto-select "CRM Ventas" group if it exists
                    const defaultGroup = groups.find((g: { displayName: string }) => g.displayName === 'CRM Ventas');
                    if (defaultGroup) {
                        setSelectedGroupId(defaultGroup.id);
                    }
                })
                .catch(err => console.error('[Planner] Error loading groups:', err))
                .finally(() => setLoadingPlanner(false));
        } else {
            setPlannerGroups([]);
            setPlannerPlans([]);
            setPlannerBuckets([]);
            setSelectedGroupId("");
            setSelectedPlanId("");
            setSelectedBucketId("");
        }
    }, [syncToPlanner, msConnected, tipoActividad]);

    // Planner: Load Plans when Group is selected
    useEffect(() => {
        if (selectedGroupId) {
            setLoadingPlanner(true);
            setPlannerPlans([]);
            setPlannerBuckets([]);
            setSelectedPlanId("");
            setSelectedBucketId("");
            fetch(`/api/microsoft/planner/plans?groupId=${selectedGroupId}`, { credentials: 'include' })
                .then(res => res.json())
                .then(data => {
                    const plans = data.plans || [];
                    setPlannerPlans(plans);
                    // Auto-select "CRM Ventas" plan if it exists
                    const defaultPlan = plans.find((p: { title: string }) => p.title === 'CRM Ventas');
                    if (defaultPlan) {
                        setSelectedPlanId(defaultPlan.id);
                    } else if (plans.length === 1) {
                        // If only one plan, select it
                        setSelectedPlanId(plans[0].id);
                    }
                })
                .catch(err => console.error('[Planner] Error loading plans:', err))
                .finally(() => setLoadingPlanner(false));
        }
    }, [selectedGroupId]);

    // Planner: Load Buckets when Plan is selected
    useEffect(() => {
        if (selectedPlanId) {
            setLoadingPlanner(true);
            setPlannerBuckets([]);
            setSelectedBucketId("");
            fetch(`/api/microsoft/planner/buckets?planId=${selectedPlanId}`, { credentials: 'include' })
                .then(res => res.json())
                .then(data => {
                    const buckets = data.buckets || [];
                    setPlannerBuckets(buckets);
                    // Auto-select "Proyecto CRM" bucket if it exists
                    const defaultBucket = buckets.find((b: { name: string }) => b.name === 'Proyecto CRM');
                    if (defaultBucket) {
                        setSelectedBucketId(defaultBucket.id);
                    } else if (buckets.length === 1) {
                        // If only one bucket, select it
                        setSelectedBucketId(buckets[0].id);
                    }
                })
                .catch(err => console.error('[Planner] Error loading buckets:', err))
                .finally(() => setLoadingPlanner(false));
        }
    }, [selectedPlanId]);

    const handleActualSubmit = async (data: any) => {
        setIsSubmitting(true);
        setSyncFeedback({}); // Reset feedback
        try {
            console.log("[CreateActivityModal] Raw Submit Data:", data);

            // 1. Create Teams Meeting if requested
            let teamsMeetingUrl = null;
            if (isTeamsMeeting && msConnected && tipo === 'EVENTO') {
                try {
                    const res = await fetch('/api/microsoft/calendar/create-event', {
                        method: 'POST',
                        body: JSON.stringify({
                            subject: data.asunto,
                            description: data.descripcion,
                            start: new Date(data.fecha_inicio).toISOString(),
                            end: new Date(data.fecha_fin).toISOString(),
                            attendees: attendees,
                            isOnlineMeeting: true
                        })
                    });

                    if (res.ok) {
                        const event = await res.json();
                        teamsMeetingUrl = event.onlineMeeting?.joinUrl || null;
                        console.log("[CreateActivityModal] Teams Meeting Created:", teamsMeetingUrl);
                        setSyncFeedback(prev => ({ ...prev, teams: 'success' }));
                    } else {
                        const err = await res.json();
                        console.error("[CreateActivityModal] Failed to create Teams meeting:", err);
                        setSyncFeedback(prev => ({ ...prev, teams: 'error', message: err.error || 'Error creando reunión Teams' }));
                    }
                } catch (e) {
                    console.error("[CreateActivityModal] Teams creation error:", e);
                    setSyncFeedback(prev => ({ ...prev, teams: 'error', message: 'Error de conexión con Teams' }));
                }
            }

            // 2. Create Planner Task if requested
            let plannerId = null;
            let plannerSuccess = false;
            if (syncToPlanner && msConnected && tipo === 'TAREA' && selectedPlanId && selectedBucketId) {
                try {
                    // Map attendees to assigneeIds (IDs are Microsoft User IDs)
                    const assigneeIds = attendees.map(a => a.id);

                    const res = await fetch('/api/microsoft/planner/tasks', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            planId: selectedPlanId,
                            bucketId: selectedBucketId,
                            title: data.asunto,
                            dueDateTime: data.fecha_inicio ? new Date(data.fecha_inicio).toISOString() : undefined,
                            notes: data.descripcion,
                            checklist: checklist,
                            assigneeIds: assigneeIds
                        })
                    });

                    if (res.ok) {
                        const taskResponse = await res.json();
                        plannerId = taskResponse.task?.id || null;
                        plannerSuccess = !!plannerId;
                        console.log("[CreateActivityModal] Planner Task Created:", plannerId);
                        setSyncFeedback(prev => ({ ...prev, planner: 'success' }));
                    } else {
                        const err = await res.json();
                        console.error("[CreateActivityModal] Failed to create Planner task:", err);

                        // OFFLINE / AUTO-SYNC FIX
                        if (!navigator.onLine || res.status >= 500) {
                            console.log("[CreateActivityModal] Queuing Planner sync for later due to connection error.");
                            setSyncFeedback(prev => ({ ...prev, planner: 'error', message: 'Guardado local. Se sincronizará con Planner luego.' }));
                        } else {
                            setSyncFeedback(prev => ({ ...prev, planner: 'error', message: err.error || 'Error creando tarea en Planner' }));
                        }
                    }
                } catch (e) {
                    console.error("[CreateActivityModal] Planner creation error:", e);
                    // OFFLINE / AUTO-SYNC FIX
                    console.log("[CreateActivityModal] Queuing Planner sync for later due to network error.");
                    setSyncFeedback(prev => ({ ...prev, planner: 'error', message: 'Guardado local. Se sincronizará con Planner luego.' }));
                }
            }

            // 3. Process for CRM
            const processed = {
                ...data,
                teams_meeting_url: teamsMeetingUrl,
                ms_planner_id: plannerId,
                microsoft_attendees: attendees.length > 0 ? JSON.stringify(attendees) : null,
                _sync_metadata: {} as any
            };

            // If Planner sync was requested but failed/offline, queue it
            if (syncToPlanner && tipo === 'TAREA' && !plannerId) {
                processed._sync_metadata.pending_planner = true;
                processed._sync_metadata.checklist = checklist;
                // Add attendees to metadata for Planner
                processed._sync_metadata.assigneeIds = attendees.map(a => a.id);
                // In case plan/bucket load failed, keep the intent explicitly
                processed._sync_metadata.planId = selectedPlanId || null;
                processed._sync_metadata.bucketId = selectedBucketId || null;
            }

            processed.clasificacion_id = (data.clasificacion_id && data.clasificacion_id !== "") ? Number(data.clasificacion_id) : null;
            processed.subclasificacion_id = (data.subclasificacion_id && data.subclasificacion_id !== "") ? Number(data.subclasificacion_id) : null;

            console.log("[CreateActivityModal] Processed Submit Data:", processed);

            // Show brief success feedback before closing
            if (plannerSuccess || teamsMeetingUrl) {
                await new Promise(resolve => setTimeout(resolve, 800)); // Brief delay to show feedback
            }

            onSubmit(processed);
        } finally {
            setIsSubmitting(false);
        }
    };


    const tipo = watch('tipo_actividad');
    const fechaInicio = watch('fecha_inicio');
    const selectedClasificacionId = watch('clasificacion_id');

    // Filtered Lists
    const filteredClassifications = useMemo(() => {
        console.log("[CreateActivityModal] Filtering classifications for type:", tipo);
        console.log("[CreateActivityModal] All classifications:", classifications.map(c => ({ id: c.id, nombre: c.nombre, tipo: c.tipo_actividad })));
        const filtered = classifications.filter(c => c.tipo_actividad === tipo);
        console.log("[CreateActivityModal] Filtered classifications:", filtered.map(c => ({ id: c.id, nombre: c.nombre })));
        console.log("[CreateActivityModal] Looking for ID:", initialData?.clasificacion_id, "Is it in filtered?", filtered.some(c => c.id === initialData?.clasificacion_id || String(c.id) === String(initialData?.clasificacion_id)));
        return filtered;
    }, [classifications, tipo, initialData?.clasificacion_id]);

    const filteredSubclassifications = useMemo(() => {
        if (!selectedClasificacionId) return [];
        return subclassifications.filter(s => s.clasificacion_id === Number(selectedClasificacionId));
    }, [subclassifications, selectedClasificacionId]);

    // Auto-set fecha_fin as 1 hour after fecha_inicio for EVENTO
    useEffect(() => {
        if (tipo === 'EVENTO' && fechaInicio) {
            try {
                const start = new Date(fechaInicio);
                if (!isNaN(start.getTime())) {
                    const end = new Date(start.getTime() + 3600000); // +1 hour

                    const formattedEnd = toInputDateTime(end);
                    setValue('fecha_fin', formattedEnd, { shouldDirty: true });
                }
            } catch (e) {
                console.error("Error setting end date", e);
            }
        }
    }, [fechaInicio, tipo, setValue]);

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl md:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[95vh] md:max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold text-slate-900">{isEditing ? 'Editar Actividad' : 'Programar Actividad'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                </div>

                <form
                    onSubmit={handleSubmit(handleActualSubmit, (errors) => {
                        console.error("[CreateActivityModal] Validation Errors:", errors);
                    })}
                    className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain pb-6"
                >
                    {isSyncingPlanner && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold animate-in fade-in slide-in-from-top-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sincronizando estado con Microsoft Planner...
                        </div>
                    )}
                    {/* Activity Type Selector */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => {
                                setValue('tipo_actividad', 'EVENTO');
                                setValue('clasificacion_id', "");
                                setValue('subclasificacion_id', "");
                            }}
                            className={cn(
                                "flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all",
                                tipo === 'EVENTO' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <CalendarClock className="w-4 h-4" /> Evento / Cita
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setValue('tipo_actividad', 'TAREA');
                                setValue('clasificacion_id', "");
                                setValue('subclasificacion_id', "");
                            }}
                            className={cn(
                                "flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all",
                                tipo === 'TAREA' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <ListTodo className="w-4 h-4" /> Tarea
                        </button>
                    </div>

                    {/* Completion Toggle (Available for all types) */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
                        <div className="space-y-0.5">
                            <label className="text-xs font-bold text-slate-900 uppercase">Actividad Finalizada</label>
                            <p className="text-[10px] text-slate-500">Marcar como completada</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                {...register('is_completed')}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                    </div>

                    {/* CLASSIFICATION SELECTORS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">
                                Clasificación <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    {...register('clasificacion_id', {
                                        required: "La clasificación es obligatoria",
                                        onChange: (e) => {
                                            console.log("[CreateActivityModal] Classification Selected:", e.target.value);
                                            setValue('subclasificacion_id', "");
                                        }
                                    })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                                >
                                    <option value="">{classifications.length === 0 ? 'Sincronizando...' : 'Seleccione...'}</option>
                                    {filteredClassifications.map(c => (
                                        <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                                    ))}
                                    {/* If current classification is not in filtered list, show it anyway (historical data) */}
                                    {initialData?.clasificacion_id &&
                                        !filteredClassifications.some(c => String(c.id) === String(initialData.clasificacion_id)) &&
                                        classifications.find(c => String(c.id) === String(initialData.clasificacion_id)) && (
                                            <option
                                                key={initialData.clasificacion_id}
                                                value={String(initialData.clasificacion_id)}
                                                className="text-amber-600"
                                            >
                                                {classifications.find(c => String(c.id) === String(initialData.clasificacion_id))?.nombre} (otro tipo)
                                            </option>
                                        )}
                                </select>
                                {classifications.length === 0 && (
                                    <div className="absolute right-10 top-1/2 -translate-y-1/2">
                                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Show Subclassification ONLY if the selected classification has options */}
                        {filteredSubclassifications.length > 0 && (
                            <div className="space-y-1 animate-in fade-in slide-in-from-left-2 duration-200">
                                <label className="text-xs font-bold text-slate-500 uppercase">
                                    Subclasificación <span className="text-red-500">*</span>
                                </label>
                                <select
                                    {...register('subclasificacion_id', { required: "La subclasificación es requerida" })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                                >
                                    <option value="">Seleccione...</option>
                                    {filteredSubclassifications.map(s => (
                                        <option key={s.id} value={String(s.id)}>{s.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Asunto <span className="text-red-500">*</span></label>
                        <input
                            {...register('asunto', { required: true })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            placeholder={tipo === 'TAREA' ? "Ej. Llamar a seguimiento" : "Ej. Reunión de presentación"}
                        />
                    </div>

                    {/* MICROSOFT INTEGRATION (Teams/Guests for EVENTO, Collaborators/Checklist for TAREA) */}
                    {msConnected && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                            {tipo === 'EVENTO' && (
                                <div className="p-px bg-linear-to-r from-blue-500 to-indigo-500 rounded-2xl shadow-sm">
                                    <div className="bg-white rounded-[15px] p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
                                                <Video className="w-5 h-5" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <label className="text-sm font-bold text-slate-900">Reunión de Teams</label>
                                                <p className="text-[10px] text-slate-500 font-medium">Crea un enlace automático para esta reunión</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isTeamsMeeting}
                                                onChange={(e) => setIsTeamsMeeting(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 transition-all"></div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* COLLABORATORS / ATTENDEES (Unified search) */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5" />
                                    {tipo === 'TAREA' ? 'Colaboradores (Tenant Microsoft)' : 'Invitados (Tenant Microsoft)'}
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                        {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <Search className="w-4 h-4" />}
                                    </div>
                                    <input
                                        type="text"
                                        value={userSearch}
                                        onChange={(e) => setUserSearch(e.target.value)}
                                        placeholder="Buscar por nombre o correo..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    />

                                    {userSearch.length >= 2 && !isSearching && searchResults.length === 0 && (
                                        <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl p-4 text-center text-slate-500 text-sm">
                                            No se encontraron personas con "{userSearch}"
                                        </div>
                                    )}

                                    {searchResults.length > 0 && (
                                        <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 max-h-60 overflow-y-auto">
                                            {searchResults.map((user) => (
                                                <button
                                                    key={user.id}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        addAttendee(user);
                                                    }}
                                                    className="w-full px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 text-left"
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">
                                                        {user.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-bold text-slate-900 truncate">{user.displayName}</span>
                                                        <span className="text-[10px] text-slate-500 font-medium truncate uppercase tracking-wider">
                                                            {user.jobTitle || 'Usuario del Tenant'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 truncate">
                                                            {user.mail || user.userPrincipalName}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* List of selected users */}
                                <div className="flex flex-wrap gap-2">
                                    {attendees.map((a) => (
                                        <div
                                            key={a.id}
                                            className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 group animate-in zoom-in-50"
                                        >
                                            <span className="max-w-[120px] truncate">{a.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeAttendee(a.id)}
                                                className="hover:text-red-500 transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* PLANNER CHECKLIST (Only for TAREA) */}
                            {tipo === 'TAREA' && (
                                <div className="space-y-2 py-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <ListTodo className="w-3.5 h-3.5" /> Actividades (Checklist Planner)
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newChecklistItem}
                                            onChange={(e) => setNewChecklistItem(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addChecklistItem();
                                                }
                                            }}
                                            placeholder="Nueva actividad..."
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={addChecklistItem}
                                            className="bg-emerald-50 text-emerald-600 p-3 rounded-xl hover:bg-emerald-100 transition-colors"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {checklist.length > 0 && (
                                        <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-2 space-y-1 mt-2">
                                            {checklist.map((item, index) => (
                                                <div key={index} className="flex items-center justify-between p-2 bg-white border border-slate-100 rounded-lg group animate-in slide-in-from-left-2 shadow-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                        <span className="text-sm text-slate-700">{item}</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeChecklistItem(index)}
                                                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {tipo === 'TAREA' ? (
                            <>
                                <DateTimePicker
                                    value={fechaInicio || ''}
                                    onChange={(val) => setValue('fecha_inicio', val)}
                                    label="Fecha Vencimiento"
                                    required
                                    minDate={new Date()}
                                    showTime={false}
                                />

                                {/* Planner Sync Section - Always On */}
                                {msConnected && (
                                    <div className="col-span-full space-y-3">
                                        {/* Planner Header */}
                                        <div className="flex items-center gap-2 p-3 bg-linear-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                                            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                                <ListTodo className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-emerald-700">Sincronización con Planner</p>
                                                <p className="text-[10px] text-emerald-600">La tarea se creará automáticamente en Microsoft Planner</p>
                                            </div>
                                        </div>

                                        {/* Planner Cascade Selectors - Always visible */}
                                        <div className="space-y-3">
                                            {/* Group Selector */}
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-slate-500 uppercase">
                                                    Grupo <span className="text-red-500">*</span>
                                                </label>
                                                <select
                                                    value={selectedGroupId}
                                                    onChange={(e) => setSelectedGroupId(e.target.value)}
                                                    disabled={loadingPlanner}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                >
                                                    <option value="">
                                                        {loadingPlanner ? 'Cargando grupos...' : plannerGroups.length === 0 ? 'No hay grupos disponibles' : 'Seleccione un grupo...'}
                                                    </option>
                                                    {plannerGroups.map((g) => (
                                                        <option key={g.id} value={g.id}>{g.displayName}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Plan Selector */}
                                            {selectedGroupId && (
                                                <div className="space-y-1">
                                                    <label className="text-xs font-bold text-slate-500 uppercase">
                                                        Plan <span className="text-red-500">*</span>
                                                    </label>
                                                    <select
                                                        value={selectedPlanId}
                                                        onChange={(e) => setSelectedPlanId(e.target.value)}
                                                        disabled={loadingPlanner}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                    >
                                                        <option value="">
                                                            {loadingPlanner ? 'Cargando planes...' : plannerPlans.length === 0 ? 'No hay planes en este grupo' : 'Seleccione un plan...'}
                                                        </option>
                                                        {plannerPlans.map((p) => (
                                                            <option key={p.id} value={p.id}>{p.title}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {/* Bucket Selector */}
                                            {selectedPlanId && (
                                                <div className="space-y-1">
                                                    <label className="text-xs font-bold text-slate-500 uppercase">
                                                        Bucket <span className="text-red-500">*</span>
                                                    </label>
                                                    <select
                                                        value={selectedBucketId}
                                                        onChange={(e) => setSelectedBucketId(e.target.value)}
                                                        disabled={loadingPlanner}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                    >
                                                        <option value="">
                                                            {loadingPlanner ? 'Cargando buckets...' : plannerBuckets.length === 0 ? 'No hay buckets en este plan' : 'Seleccione un bucket...'}
                                                        </option>
                                                        {plannerBuckets.map((b) => (
                                                            <option key={b.id} value={b.id}>{b.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {/* Planner Selection Summary */}
                                            {selectedBucketId && (
                                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                                                    <p className="text-xs text-emerald-700 font-medium">
                                                        ✓ La tarea se creará en Planner automáticamente
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <DateTimePicker
                                    value={fechaInicio || ''}
                                    onChange={(val) => setValue('fecha_inicio', val)}
                                    label="Fecha Inicio"
                                    required
                                    minDate={new Date()}
                                    showTime={true}
                                />
                                <DateTimePicker
                                    value={watch('fecha_fin') || ''}
                                    onChange={(val) => setValue('fecha_fin', val)}
                                    label="Fecha Fin"
                                    minDate={fechaInicio ? new Date(fechaInicio) : new Date()}
                                    showTime={true}
                                />
                            </>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Oportunidad Relacionada</label>
                        <select
                            {...register('opportunity_id')}
                            disabled={!!initialOpportunityId}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-100 disabled:text-slate-500"
                        >
                            <option value="">
                                {!opportunities || opportunities.length === 0
                                    ? 'No hay oportunidades disponibles'
                                    : 'Seleccione una oportunidad...'}
                            </option>
                            {opportunities?.map((opp: any) => (
                                <option key={opp.id} value={opp.id}>{opp.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <textarea
                            {...register('descripcion')}
                            rows={3}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                            placeholder="Notas adicionales..."
                        />
                    </div>

                    {/* Sync Feedback Display */}
                    {(syncFeedback.planner || syncFeedback.teams) && (
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 animate-in slide-in-from-top-2 duration-200">
                            {syncFeedback.planner === 'success' && (
                                <div className="flex items-center gap-2 text-emerald-600">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span className="text-sm font-medium">✓ Tarea creada en Microsoft Planner</span>
                                </div>
                            )}
                            {syncFeedback.planner === 'error' && (
                                <div className="flex items-center gap-2 text-red-600">
                                    <AlertCircle className="w-5 h-5" />
                                    <span className="text-sm font-medium">Error sincronizando con Planner</span>
                                </div>
                            )}
                            {syncFeedback.teams === 'success' && (
                                <div className="flex items-center gap-2 text-blue-600">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span className="text-sm font-medium">✓ Reunión creada en Teams</span>
                                </div>
                            )}
                            {syncFeedback.teams === 'error' && (
                                <div className="flex items-center gap-2 text-red-600">
                                    <AlertCircle className="w-5 h-5" />
                                    <span className="text-sm font-medium">Error creando reunión Teams</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3 pt-6 mt-auto border-t border-slate-100 bg-white shrink-0 sticky bottom-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={cn(
                                "flex-1 text-white px-4 py-3 rounded-xl font-bold shadow-lg transition-colors flex items-center justify-center gap-2",
                                isSubmitting ? "bg-slate-400 opacity-70" : (tipo === 'TAREA' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-blue-600 hover:bg-blue-700 shadow-blue-200")
                            )}
                        >
                            {isSubmitting ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</>
                            ) : (
                                isEditing ? 'Guardar Cambios' : (tipo === 'TAREA' ? 'Crear Tarea' : 'Agendar Evento')
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
