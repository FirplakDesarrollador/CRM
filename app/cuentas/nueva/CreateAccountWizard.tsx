"use client";

import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LocalCiudad, type LocalCuenta, type LocalDepartamento, type LocalPais, type LocalSubclasificacion } from "@/lib/db";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useState, useEffect, useMemo, useRef } from "react";
import {
    Loader2,
    Medal,
    ChevronRight,
    Check,
    AlertTriangle,
    Building2,
    GitBranch,
    ExternalLink,
    User,
    X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/components/ui/utils";
import { useRouter } from "next/navigation";
import { DuplicateAccountModal, type DuplicateAccountInfo } from "@/components/cuentas/DuplicateAccountModal";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ParentAccountCombobox, type ParentAccountOption } from "@/components/accounts/ParentAccountCombobox";
import {
    isProvisionalNit,
    generateProvisionalNit,
    sanitizeNitInput,
    validateColombianNit,
    extractNitRoot,
    buildBranchNit,
} from "@/lib/nitUtils";
import {
    buildBranchAccountName,
    buildSimilarityConfirmationMessage,
    evaluateSimilarityAlerts,
    resolveRootAccountTarget,
    type SimilarAccountMatch,
    type SimilarityMatchReason,
} from "@/lib/accountSimilarity";

const accountSchema = z
    .object({
        nombre: z.string().min(2, "Nombre requerido"),
        nit_base: z.string().optional().nullable(),
        is_child: z.boolean().default(false),
        id_cuenta_principal: z.string().nullable().optional(),
        canal_id: z.string().min(1, "Canal de venta requerido"),
        subclasificacion_id: z.string().optional().nullable(),
        telefono: z.string().nullable().optional(),
        email: z
            .string()
            .optional()
            .nullable()
            .refine(
                (val) => {
                    if (!val || val.trim() === "" || val === "*****") return true;
                    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
                },
                { message: "Email inválido" }
            ),
        direccion: z.string().nullable().optional(),
        pais_id: z.string().nullable().optional(),
        departamento_id: z.string().nullable().optional(),
        ciudad_id: z.string().nullable().optional(),
        ciudad: z.string().nullable().optional(),
        es_premium: z.boolean().optional(),
        nivel_premium: z.enum(["PREMIUM", "DESTACADO", "ACTIVO"]).nullable().optional(),
        ignorar_limites_descuento: z.boolean().optional(),
        comentarios: z.string().nullable().optional(),
        origen_cuenta: z.string().nullable().optional(),
    })
    .superRefine((data, ctx) => {
        if (data.is_child) {
            if (!data.id_cuenta_principal || data.id_cuenta_principal.trim() === "") {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["id_cuenta_principal"],
                    message: "Seleccione la cuenta principal",
                });
            }
            if (
                data.nit_base &&
                data.nit_base.trim() !== "" &&
                !isProvisionalNit(data.nit_base) &&
                !validateColombianNit(data.nit_base, { allowBranchSuffix: true })
            ) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["nit_base"],
                    message: "NIT de sucursal inválido (ej. 900510728-6#2)",
                });
            }
            return;
        }

        if (data.nit_base && data.nit_base.trim() !== "" && !validateColombianNit(data.nit_base)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["nit_base"],
                message: "NIT inválido: solo números y máximo un guion con 1 dígito de verificación (ej. 900123456-7)",
            });
        }
    });

type AccountFormInput = z.input<typeof accountSchema>;
type AccountFormData = z.output<typeof accountSchema>;
type ParentAccount = Pick<LocalCuenta, "id" | "nombre" | "nit_base">;
type DuplicateAccount = {
    id?: string;
    nombre: string;
    nit_base?: string | null;
    canal_id?: string | null;
    owner_user_id?: string | null;
    id_cuenta_principal?: string | null;
    telefono?: string | null;
    email?: string | null;
    created_at?: string | null;
};
type PremiumTier = NonNullable<AccountFormData["nivel_premium"]>;

const STEP_LABELS = ["Información Base", "Ubicación y Contacto", "Clasificación"];
const LAST_STEP_INDEX = STEP_LABELS.length - 1;
const PREMIUM_TIERS: PremiumTier[] = ["PREMIUM", "DESTACADO", "ACTIVO"];

export default function CreateAccountWizard() {
    const router = useRouter();
    const { createAccount } = useAccounts();
    const { user } = useCurrentUser();
    const [step, setStep] = useState(0);
    const [parents, setParents] = useState<ParentAccount[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [canSubmitFinalStep, setCanSubmitFinalStep] = useState(false);
    const [duplicateModalData, setDuplicateModalData] = useState<DuplicateAccountInfo[]>([]);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

    // Live similarity detection state
    const [similarAccounts, setSimilarAccounts] = useState<SimilarAccountMatch[]>([]);
    const [isSearchingSimilar, setIsSearchingSimilar] = useState(false);
    const [selectedBranchParent, setSelectedBranchParent] = useState<{
        id: string;
        nombre: string;
        nit_base: string | null;
    } | null>(null);
    const [similarityConfirmModal, setSimilarityConfirmModal] = useState<{
        isOpen: boolean;
        matchName: string;
        ownerName: string;
        matchReason: SimilarityMatchReason;
        pendingData: AccountFormData | null;
    }>({ isOpen: false, matchName: "", ownerName: "", matchReason: "NOMBRE", pendingData: null });
    const searchSeqRef = useRef(0);

    const subclassifications = useLiveQuery(() => db.subclasificaciones.toArray()) || [];
    const countriesList = useLiveQuery(() => db.countries.toArray()) || [];
    const departmentsList = useLiveQuery(() => db.departments.toArray()) || [];
    const citiesList = useLiveQuery(() => db.cities.toArray()) || [];

    const [fallbackSubclassifications, setFallbackSubclassifications] = useState<LocalSubclasificacion[]>([]);
    const [fallbackCountries, setFallbackCountries] = useState<LocalPais[]>([]);
    const [fallbackDepartments, setFallbackDepartments] = useState<LocalDepartamento[]>([]);
    const [fallbackCities, setFallbackCities] = useState<LocalCiudad[]>([]);

    useEffect(() => {
        if (subclassifications.length === 0) {
            supabase.from("CRM_Subclasificacion").select("id, nombre, canal_id").then(({ data }) => {
                if (data) setFallbackSubclassifications(data);
            });
        }
        if (countriesList.length === 0) {
            supabase.from("CRM_Paises").select("*").then(({ data }) => {
                if (data) setFallbackCountries(data);
            });
        }
        if (departmentsList.length === 0) {
            supabase.from("CRM_Departamentos").select("*").then(({ data }) => {
                if (data) setFallbackDepartments(data);
            });
        }
        if (citiesList.length === 0) {
            supabase.from("CRM_Ciudades").select("*").then(({ data }) => {
                if (data) setFallbackCities(data);
            });
        }
        supabase
            .from("CRM_Cuentas")
            .select("id, nombre, nit_base")
            .is("id_cuenta_principal", null)
            .eq("is_deleted", false)
            .order("nombre")
            .limit(100)
            .then(({ data }) => {
                if (data) setParents(data);
            });
    }, [subclassifications.length, countriesList.length, departmentsList.length, citiesList.length]);

    const displaySubclassifications = subclassifications.length > 0 ? subclassifications : fallbackSubclassifications;
    const displayCountries = countriesList.length > 0 ? countriesList : fallbackCountries;
    const displayDepartments = departmentsList.length > 0 ? departmentsList : fallbackDepartments;
    const displayCities = citiesList.length > 0 ? citiesList : fallbackCities;

    useEffect(() => {
        if (step !== LAST_STEP_INDEX) {
            setCanSubmitFinalStep(false);
            return;
        }

        setCanSubmitFinalStep(false);
        const timer = window.setTimeout(() => {
            setCanSubmitFinalStep(true);
        }, 500);

        return () => window.clearTimeout(timer);
    }, [step]);

    const form = useForm<AccountFormInput, unknown, AccountFormData>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            nombre: "",
            nit_base: "",
            is_child: false,
            id_cuenta_principal: "",
            canal_id: "DIST_NAC",
            subclasificacion_id: "",
            telefono: "",
            email: "",
            direccion: "",
            pais_id: "1",
            departamento_id: "",
            ciudad_id: "",
            ciudad: "",
            es_premium: false,
            nivel_premium: null,
            ignorar_limites_descuento: false,
            comentarios: "",
            origen_cuenta: "",
        },
    });

    const {
        register,
        trigger,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = form;

    const isChild = watch("is_child");
    const selectedChannel = watch("canal_id");
    const watchedNombre = watch("nombre") || "";
    const watchedNit = watch("nit_base") || "";
    const watchedParentId = watch("id_cuenta_principal") || "";

    // Debounced live similarity search against all active CRM accounts
    useEffect(() => {
        if (step !== 0) return;

        const trimmedName = watchedNombre.trim();
        const nitRoot = isChild ? "" : extractNitRoot(watchedNit);

        if (trimmedName.length < 3 && nitRoot.length < 5) {
            setSimilarAccounts([]);
            setIsSearchingSimilar(false);
            return;
        }

        const currentSeq = ++searchSeqRef.current;
        setIsSearchingSimilar(true);

        const timer = window.setTimeout(async () => {
            try {
                const { data, error } = await supabase.rpc("search_similar_accounts", {
                    p_nombre: trimmedName.length >= 3 ? trimmedName : null,
                    p_nit: nitRoot.length >= 5 ? watchedNit.trim() : null,
                    p_limit: 6,
                });

                if (currentSeq !== searchSeqRef.current) return;
                if (error) {
                    setSimilarAccounts([]);
                } else {
                    setSimilarAccounts((data as SimilarAccountMatch[]) || []);
                }
            } catch {
                if (currentSeq === searchSeqRef.current) {
                    setSimilarAccounts([]);
                }
            } finally {
                if (currentSeq === searchSeqRef.current) {
                    setIsSearchingSimilar(false);
                }
            }
        }, 300);

        return () => window.clearTimeout(timer);
    }, [step, watchedNombre, watchedNit, isChild]);

    const similarityAlerts = useMemo(
        () =>
            evaluateSimilarityAlerts({
                inputName: watchedNombre,
                inputNit: isChild ? "" : watchedNit,
                matches: similarAccounts,
                isBranchMode: Boolean(isChild),
                selectedParentId: watchedParentId || null,
            }),
        [watchedNombre, watchedNit, similarAccounts, isChild, watchedParentId]
    );

    const populateNextBranchNit = (parentId: string, parentNit?: string | null) => {
        const sanitizedParent = isProvisionalNit(parentNit)
            ? String(parentNit || "").trim()
            : sanitizeNitInput(parentNit, { allowBranchSuffix: false });
        const optimisticBranchNit = buildBranchNit(sanitizedParent || parentNit, []);
        if (optimisticBranchNit) {
            setValue("nit_base", optimisticBranchNit, { shouldDirty: true, shouldValidate: false });
        } else {
            setValue("nit_base", "", { shouldDirty: true, shouldValidate: false });
        }

        void (async () => {
            try {
                const { data: nextNit, error } = await supabase.rpc("get_next_branch_nit", {
                    p_parent_id: parentId,
                });
                if (!error && typeof nextNit === "string" && nextNit.trim() !== "") {
                    const normalizedNext = isProvisionalNit(nextNit)
                        ? nextNit.trim()
                        : sanitizeNitInput(nextNit, { allowBranchSuffix: true });
                    setValue("nit_base", normalizedNext || nextNit.trim(), { shouldDirty: true, shouldValidate: true });
                }
            } catch {
                // Keep optimistic branch NIT when offline
            }
        })();
    };

    const activateBranchMode = (target: {
        id: string;
        nombre: string;
        nit_base?: string | null;
        canal_id?: string | null;
    }) => {
        const zoneName = user?.zona_nombre?.trim();
        if (!zoneName) return;

        // Ensure parent exists in select options
        setParents((prev) => {
            if (prev.some((p) => p.id === target.id)) return prev;
            return [{ id: target.id, nombre: target.nombre, nit_base: target.nit_base || "" }, ...prev];
        });

        const branchName = buildBranchAccountName(target.nombre, zoneName);
        setSelectedBranchParent({
            id: target.id,
            nombre: target.nombre,
            nit_base: target.nit_base || null,
        });
        setValue("is_child", true, { shouldDirty: true, shouldValidate: true });
        setValue("id_cuenta_principal", target.id, { shouldDirty: true, shouldValidate: true });
        populateNextBranchNit(target.id, target.nit_base);
        setValue("nombre", branchName, { shouldDirty: true, shouldValidate: true });
        if (target.canal_id) {
            setValue("canal_id", target.canal_id, { shouldDirty: true });
        }
        setIsDuplicateModalOpen(false);
        setStep(0);
    };

    const handleCreateBranchFromMatch = (match: SimilarAccountMatch) => {
        const root = resolveRootAccountTarget(match);
        activateBranchMode(root);
    };

    const handleCreateBranchFromDuplicate = (dup: DuplicateAccountInfo) => {
        if (dup.rootAccount?.id) {
            activateBranchMode(dup.rootAccount);
            return;
        }
        if (dup.account.id) {
            activateBranchMode({
                id: dup.account.id_cuenta_principal || dup.account.id,
                nombre: dup.account.nombre,
                nit_base: dup.account.nit_base,
                canal_id: dup.account.canal_id,
            });
        }
    };

    const handleClearBranchSelection = () => {
        setSelectedBranchParent(null);
        setValue("is_child", false, { shouldDirty: true });
        setValue("id_cuenta_principal", "", { shouldDirty: true });
        setValue("nit_base", "", { shouldDirty: true });
    };

    const handleParentSelect = (parentId: string, parent: ParentAccountOption | null) => {
        setValue("id_cuenta_principal", parentId, { shouldDirty: true, shouldValidate: true });
        if (parent) {
            setParents((prev) =>
                prev.some((p) => p.id === parent.id)
                    ? prev
                    : [{ id: parent.id, nombre: parent.nombre, nit_base: parent.nit_base || "" }, ...prev]
            );
            populateNextBranchNit(parent.id, parent.nit_base);
            setSelectedBranchParent({
                id: parent.id,
                nombre: parent.nombre,
                nit_base: parent.nit_base || null,
            });
        } else {
            setSelectedBranchParent(null);
            setValue("nit_base", "", { shouldDirty: true });
        }
    };

    const handleNext = async () => {
        let fieldsToValidate: FieldPath<AccountFormInput>[] = [];
        if (step === 0) {
            fieldsToValidate = ["nombre", "canal_id", "nit_base"];
            if (isChild) fieldsToValidate.push("id_cuenta_principal");
        } else if (step === 1) {
            fieldsToValidate = ["email", "telefono", "direccion"];
        }

        const isStepValid = await trigger(fieldsToValidate);
        if (isStepValid) {
            setStep((prev) => Math.min(LAST_STEP_INDEX, prev + 1));
        }
    };

    const handleBack = () => {
        setStep((prev) => Math.max(0, prev - 1));
    };

    const notifyCommercialCoordination = async (params: {
        newAccountId: string;
        newAccountName: string;
        newAccountNit: string;
        similarAccountName: string;
        similarOwnerName: string;
        matchReason: SimilarityMatchReason;
    }) => {
        try {
            let recipientIds = Array.from(new Set(user?.coordinadores || [])).filter(
                (id) => Boolean(id) && id !== user?.id
            );

            if (recipientIds.length === 0) {
                const { data: coords } = await supabase
                    .from("CRM_Usuarios")
                    .select("id")
                    .eq("role", "COORDINADOR")
                    .eq("is_active", true);
                recipientIds = (coords || [])
                    .map((c: { id: string }) => c.id)
                    .filter((id) => Boolean(id) && id !== user?.id);
            }

            if (recipientIds.length === 0) return;

            const advisorName = user?.full_name || user?.email || "Un asesor";
            const reasonText =
                params.matchReason === "NIT"
                    ? "NIT"
                    : params.matchReason === "AMBOS"
                    ? "nombre y NIT"
                    : "nombre";

            const rows = recipientIds.map((coordinatorId) => ({
                user_id: coordinatorId,
                type: "SIMILAR_ACCOUNT_CREATED",
                title: "Posible cuenta duplicada creada",
                message: `${advisorName} creó la cuenta "${params.newAccountName}" (NIT: ${params.newAccountNit}) pese a tener alta coincidencia en ${reasonText} con "${params.similarAccountName}" (Asesor: ${params.similarOwnerName}).`,
                entity_id: params.newAccountId,
                entity_type: "ACCOUNT",
                is_read: false,
            }));

            await supabase.from("CRM_Notifications").insert(rows);
        } catch (err) {
            console.warn("[CreateAccountWizard] Could not notify commercial coordination:", err);
        }
    };

    const executeCreateAccount = async (
        data: AccountFormData,
        similarityNotice?: {
            matchName: string;
            ownerName: string;
            matchReason: SimilarityMatchReason;
        }
    ) => {
        setIsSubmitting(true);
        try {
            let inheritedNit = data.nit_base;
            if (data.is_child && data.id_cuenta_principal) {
                const parent =
                    selectedBranchParent?.id === data.id_cuenta_principal
                        ? selectedBranchParent
                        : parents.find((a) => a.id === data.id_cuenta_principal);
                if (!inheritedNit || !inheritedNit.includes("#")) {
                    const fallbackParentNit = parent?.nit_base || inheritedNit;
                    inheritedNit = buildBranchNit(fallbackParentNit, []);
                }
            }

            const finalNit =
                inheritedNit && inheritedNit.trim() !== "" && inheritedNit !== "Sin NIT"
                    ? inheritedNit.trim()
                    : generateProvisionalNit();

            const payload: Partial<LocalCuenta> = {
                nombre: data.nombre.trim(),
                nit_base: finalNit,
                is_child: data.is_child,
                id_cuenta_principal: data.is_child ? data.id_cuenta_principal : null,
                canal_id: data.canal_id,
                subclasificacion_id: data.subclasificacion_id ? Number(data.subclasificacion_id) : null,
                telefono: data.telefono || undefined,
                email: data.email || undefined,
                direccion: data.direccion || undefined,
                pais_id: data.pais_id ? Number(data.pais_id) : null,
                departamento_id: data.departamento_id ? Number(data.departamento_id) : null,
                ciudad_id: data.ciudad_id ? Number(data.ciudad_id) : null,
                ciudad: data.ciudad_id
                    ? displayCities.find((c) => String(c.id) === data.ciudad_id)?.nombre
                    : data.ciudad || undefined,
                es_premium: !!data.nivel_premium,
                nivel_premium: data.nivel_premium || null,
                ignorar_limites_descuento: data.ignorar_limites_descuento || false,
                comentarios: data.comentarios || undefined,
                origen_cuenta: data.origen_cuenta || undefined,
            };

            const newId = await createAccount(payload);
            if (similarityNotice) {
                await notifyCommercialCoordination({
                    newAccountId: newId,
                    newAccountName: data.nombre.trim(),
                    newAccountNit: finalNit,
                    similarAccountName: similarityNotice.matchName,
                    similarOwnerName: similarityNotice.ownerName,
                    matchReason: similarityNotice.matchReason,
                });
            }
            router.push(`/cuentas?id=${newId}`);
        } catch (error) {
            console.error("Error creating account:", error);
            const msg = error instanceof Error ? error.message : String(error);
            alert(`Error al crear la cuenta: ${msg}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const onSubmit = async (data: AccountFormData) => {
        if (step !== LAST_STEP_INDEX) {
            await handleNext();
            return;
        }

        if (!canSubmitFinalStep) {
            return;
        }

        setIsSubmitting(true);
        try {
            const fields = "id, nombre, nit_base, canal_id, owner_user_id, id_cuenta_principal, telefono, email, created_at";
            const inputNitRoot = !data.is_child ? extractNitRoot(data.nit_base) : "";

            // 1. Run exact checks + similarity RPC in parallel
            const exactChecks = [
                supabase.from("CRM_Cuentas").select(fields).eq("is_deleted", false).ilike("nombre", data.nombre.trim()),
            ];
            if (data.nit_base && data.nit_base.trim() !== "" && !isProvisionalNit(data.nit_base) && !data.is_child) {
                exactChecks.push(
                    supabase.from("CRM_Cuentas").select(fields).eq("is_deleted", false).eq("nit_base", data.nit_base.trim())
                );
            }
            if (data.telefono) {
                exactChecks.push(
                    supabase.from("CRM_Cuentas").select(fields).eq("is_deleted", false).eq("telefono", data.telefono)
                );
            }
            if (data.email) {
                exactChecks.push(
                    supabase.from("CRM_Cuentas").select(fields).eq("is_deleted", false).eq("email", data.email)
                );
            }

            const [exactResults, rpcResult] = await Promise.all([
                Promise.all(exactChecks),
                supabase.rpc("search_similar_accounts", {
                    p_nombre: data.nombre.trim(),
                    p_nit: !data.is_child && inputNitRoot.length >= 5 ? data.nit_base?.trim() : null,
                    p_limit: 10,
                }),
            ]);

            const rpcMatches = ((rpcResult.data as SimilarAccountMatch[]) || []);
            const duplicateMap = new Map<string, DuplicateAccountInfo>();

            // Merge hard-block duplicates from exact queries
            const exactRows = exactResults.flatMap((r) => (r.data ?? []) as DuplicateAccount[]);
            for (const dup of exactRows) {
                if (!dup.id) continue;
                const conflicts: string[] = [];
                if (dup.nombre.trim().toLowerCase() === data.nombre.trim().toLowerCase()) {
                    conflicts.push(`Nombre "${data.nombre.trim()}" ya existe`);
                }
                if (
                    inputNitRoot &&
                    !data.is_child &&
                    extractNitRoot(dup.nit_base) === inputNitRoot
                ) {
                    conflicts.push(`NIT "${data.nit_base}" ya existe`);
                }
                if (data.telefono && dup.telefono === data.telefono) {
                    conflicts.push(`Teléfono "${data.telefono}" ya existe`);
                }
                if (data.email && dup.email === data.email) {
                    conflicts.push(`Email "${data.email}" ya existe`);
                }

                if (conflicts.length > 0 && !duplicateMap.has(dup.id)) {
                    let ownerInfo: DuplicateAccountInfo["owner"] = null;
                    if (dup.owner_user_id) {
                        const { data: userData } = await supabase
                            .from("CRM_Usuarios")
                            .select("full_name, email, zona:CRM_Zonas(nombre)")
                            .eq("id", dup.owner_user_id)
                            .maybeSingle();
                        if (userData) {
                            const rawZona = (userData as { zona?: { nombre?: string | null } | Array<{ nombre?: string | null }> | null }).zona;
                            const zonaNombre = Array.isArray(rawZona) ? (rawZona[0]?.nombre ?? null) : (rawZona?.nombre ?? null);
                            ownerInfo = {
                                full_name: userData.full_name,
                                email: userData.email,
                                zona: zonaNombre,
                            };
                        }
                    }

                    duplicateMap.set(dup.id, {
                        account: dup,
                        owner: ownerInfo,
                        conflicts,
                    });
                }
            }

            // Merge NIT root duplicates detected by RPC (e.g., 900123456 vs 900123456-7 or legacy formatted NIT)
            if (inputNitRoot && !data.is_child) {
                for (const match of rpcMatches) {
                    if (extractNitRoot(match.nit_base) === inputNitRoot && !duplicateMap.has(match.id)) {
                        const rootTarget = resolveRootAccountTarget(match);
                        duplicateMap.set(match.id, {
                            account: {
                                id: match.id,
                                nombre: match.nombre,
                                nit_base: match.nit_base,
                                canal_id: match.canal_id,
                                owner_user_id: match.owner_user_id,
                                id_cuenta_principal: match.id_cuenta_principal,
                            },
                            rootAccount: rootTarget,
                            owner: {
                                full_name: match.owner_name,
                                zona: match.owner_zona,
                            },
                            conflicts: [`NIT "${data.nit_base}" coincide con "${match.nit_base}"`],
                        });
                    }
                }
            }

            const duplicateInfos = Array.from(duplicateMap.values());
            if (duplicateInfos.length > 0) {
                setDuplicateModalData(duplicateInfos);
                setIsDuplicateModalOpen(true);
                setIsSubmitting(false);
                return;
            }

            // 2. Soft anti-evasion guard: high name similarity (with distinct NIT) requires explicit confirmation
            const submitAlerts = evaluateSimilarityAlerts({
                inputName: data.nombre,
                inputNit: data.is_child ? "" : data.nit_base,
                matches: rpcMatches,
                isBranchMode: data.is_child,
                selectedParentId: data.id_cuenta_principal || null,
            });

            if (!data.is_child && (submitAlerts.hasHighNameMatch || submitAlerts.hasNitMatch)) {
                const topMatch = submitAlerts.topNitMatch || submitAlerts.topNameMatch;
                if (topMatch) {
                    const matchReason: SimilarityMatchReason =
                        submitAlerts.hasNitMatch && submitAlerts.hasHighNameMatch
                            ? "AMBOS"
                            : submitAlerts.hasNitMatch
                            ? "NIT"
                            : "NOMBRE";
                    setSimilarityConfirmModal({
                        isOpen: true,
                        matchName: topMatch.nombre,
                        ownerName: topMatch.owner_name || "Sin asesor asignado",
                        matchReason,
                        pendingData: data,
                    });
                    setIsSubmitting(false);
                    return;
                }
            }

            await executeCreateAccount(data);
        } catch (error) {
            console.error("Error validating account:", error);
            const msg = error instanceof Error ? error.message : String(error);
            alert(`Error al validar la cuenta: ${msg}`);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-6 md:p-8">
                {/* Wizard Header */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-900">Crear Nueva Cuenta</h2>
                    <p className="text-sm text-slate-500 mt-1">Completa los pasos para registrar el nuevo cliente.</p>
                </div>

                {/* Progress Indicators */}
                <div className="flex items-center justify-between mb-8 relative">
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
                    {STEP_LABELS.map((label, idx) => {
                        const isCompleted = step > idx;
                        const isActive = step === idx;
                        return (
                            <div key={label} className="flex flex-col items-center relative z-10">
                                <div
                                    className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center border font-bold text-sm transition-all duration-300",
                                        isCompleted
                                            ? "bg-blue-600 border-blue-600 text-white"
                                            : isActive
                                            ? "bg-white border-blue-600 text-blue-600 ring-4 ring-blue-50"
                                            : "bg-white border-slate-200 text-slate-400"
                                    )}
                                >
                                    {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                                </div>
                                <span
                                    className={cn(
                                        "mt-2 text-xs font-semibold uppercase tracking-wider text-center hidden md:block",
                                        isActive ? "text-blue-600 font-bold" : "text-slate-400"
                                    )}
                                >
                                    {label}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <form
                    onSubmit={handleSubmit(onSubmit)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            const target = e.target as HTMLElement;
                            if (target.tagName !== "TEXTAREA") {
                                e.preventDefault();
                            }
                        }
                    }}
                    className="space-y-6"
                >
                    {/* STEP 0: Información Base */}
                    {step === 0 && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <label className="text-sm font-bold text-slate-700 block">Nombre de Cuenta *</label>
                                    {similarityAlerts.hasHighNameMatch && (
                                        <span
                                            data-testid="name-similarity-alert-tag"
                                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300"
                                        >
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                            Alta coincidencia con cuenta existente
                                        </span>
                                    )}
                                </div>

                                <input
                                    {...register("nombre")}
                                    className={cn(
                                        "w-full border p-3 rounded-xl outline-none focus:ring-2 font-medium transition-colors",
                                        similarityAlerts.hasHighNameMatch
                                            ? "border-amber-400 bg-amber-50/30 focus:ring-amber-400 focus:border-amber-500"
                                            : "border-slate-200 focus:ring-blue-500 focus:border-blue-500"
                                    )}
                                    placeholder="Ej. Constructora Firplak SAS"
                                />
                                {errors.nombre && <p className="text-red-500 text-xs font-bold">{errors.nombre.message}</p>}

                                {/* Active branch banner */}
                                {isChild && selectedBranchParent && (
                                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900">
                                        <div className="flex items-center gap-2">
                                            <GitBranch className="w-4 h-4 text-sky-600 shrink-0" />
                                            <span>
                                                Creando sucursal de <strong>{selectedBranchParent.nombre}</strong>
                                                {user?.zona_nombre ? (
                                                    <>
                                                        {" "}
                                                        en tu zona <strong>{user.zona_nombre}</strong>
                                                    </>
                                                ) : null}
                                                .
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleClearBranchSelection}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-sky-200 text-sky-700 hover:bg-sky-100 font-semibold shrink-0"
                                        >
                                            <X className="w-3 h-3" />
                                            Cambiar
                                        </button>
                                    </div>
                                )}

                                {/* Live similar accounts suggestions */}
                                {!selectedBranchParent && (isSearchingSimilar || similarAccounts.length > 0) && (
                                    <div
                                        data-testid="similar-accounts-panel"
                                        className="rounded-xl border border-amber-200 bg-amber-50/40 overflow-hidden"
                                    >
                                        <div className="px-3.5 py-2 bg-amber-50 border-b border-amber-200/80 flex items-center justify-between gap-2">
                                            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                                <Building2 className="w-3.5 h-3.5 text-amber-700" />
                                                Cuentas similares en el CRM ({similarAccounts.length})
                                            </span>
                                            {isSearchingSimilar && (
                                                <span className="text-[11px] text-amber-700 flex items-center gap-1">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    Buscando...
                                                </span>
                                            )}
                                        </div>

                                        {!user?.zona_nombre && similarAccounts.some((m) => m.owner_user_id !== user?.id) && (
                                            <div className="px-3.5 py-2 bg-white/80 border-b border-amber-100 text-[11px] text-amber-800 flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                Tu usuario aún no tiene una <strong>Zona Comercial</strong> asignada. Solicítala a un administrador para habilitar la creación rápida de sucursales.
                                            </div>
                                        )}

                                        <div className="divide-y divide-amber-100/80 max-h-64 overflow-y-auto bg-white">
                                            {similarAccounts.map((match) => {
                                                const isOwn = Boolean(user?.id && match.owner_user_id === user.id);
                                                const similarityPct = Math.round((match.similarity_score || 0) * 100);
                                                return (
                                                    <div
                                                        key={match.id}
                                                        className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50 transition-colors"
                                                    >
                                                        <div className="min-w-0 space-y-1">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="text-sm font-bold text-slate-900 truncate">
                                                                    {match.nombre}
                                                                </span>
                                                                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                                    {match.id_cuenta_principal ? "Sucursal" : "Matriz"}
                                                                </span>
                                                                {match.match_reason === "NIT" || match.match_reason === "AMBOS" ? (
                                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-800 border border-red-200">
                                                                        NIT coincidente
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-200">
                                                                        Similitud {similarityPct}%
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                                                                {match.nit_base && (
                                                                    <span className="font-mono text-slate-700">
                                                                        NIT: {match.nit_base}
                                                                    </span>
                                                                )}
                                                                {match.canal_id && <span>Canal: {match.canal_id}</span>}
                                                                <span className="inline-flex items-center gap-1 text-slate-600">
                                                                    <User className="w-3 h-3 text-slate-400" />
                                                                    {match.owner_name || "Sin asesor"}
                                                                    {match.owner_zona ? ` (${match.owner_zona})` : ""}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="shrink-0">
                                                            {isOwn ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => router.push(`/cuentas?id=${match.id}`)}
                                                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                                                                >
                                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                                    Abrir cuenta
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    disabled={!user?.zona_nombre}
                                                                    onClick={() => handleCreateBranchFromMatch(match)}
                                                                    title={
                                                                        user?.zona_nombre
                                                                            ? `Crear como "${buildBranchAccountName(
                                                                                  resolveRootAccountTarget(match).nombre,
                                                                                  user.zona_nombre
                                                                              )}"`
                                                                            : "Requiere tener una zona comercial asignada"
                                                                    }
                                                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed transition-colors shadow-sm"
                                                                >
                                                                    <GitBranch className="w-3.5 h-3.5" />
                                                                    Crear cuenta nueva en mi sucursal
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center space-x-2 py-2">
                                <input
                                    type="checkbox"
                                    id="is_child"
                                    {...register("is_child")}
                                    onChange={(e) => {
                                        register("is_child").onChange(e);
                                        if (!e.target.checked) {
                                            setSelectedBranchParent(null);
                                            setValue("id_cuenta_principal", "");
                                        }
                                    }}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <label htmlFor="is_child" className="text-sm font-bold text-slate-600 cursor-pointer select-none">
                                    Es una sucursal / cuenta hija
                                </label>
                            </div>

                            {isChild ? (
                                <div className="space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                    <div className="space-y-1">
                                        <label className="text-sm font-bold text-blue-800 block">Cuenta Principal (Padre) *</label>
                                        <ParentAccountCombobox
                                            value={watchedParentId}
                                            onChange={handleParentSelect}
                                            initialParent={selectedBranchParent}
                                            placeholder="Seleccione cuenta principal..."
                                            searchPlaceholder="Buscar cuenta principal por nombre o NIT..."
                                            triggerClassName="border-blue-200 rounded-xl py-2.5 text-slate-900"
                                            dataTestId="wizard-parent-account-combobox"
                                        />
                                        {errors.id_cuenta_principal && (
                                            <p className="text-red-500 text-xs font-bold">{errors.id_cuenta_principal.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-sm font-bold text-blue-800 block">
                                            NIT de Sucursal (Automático con #)
                                        </label>
                                        <input
                                            {...register("nit_base")}
                                            onChange={(e) => {
                                                const sanitized = sanitizeNitInput(e.target.value, { allowBranchSuffix: true });
                                                e.target.value = sanitized;
                                                setValue("nit_base", sanitized, { shouldDirty: true, shouldValidate: true });
                                            }}
                                            className="w-full border p-3 rounded-xl bg-white border-blue-200 text-slate-900 font-mono font-medium outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Ej. 900510728-6#2"
                                        />
                                        <p className="text-xs text-blue-700/80">
                                            Se asigna automáticamente como el NIT de la cuenta padre + <strong>#2</strong> (o siguiente consecutivo).
                                        </p>
                                        {errors.nit_base && (
                                            <p className="text-red-500 text-xs font-bold">{errors.nit_base.message}</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <label className="text-sm font-bold text-slate-700 block">
                                            NIT (Opcional · ej. 900123456-7)
                                        </label>
                                        {similarityAlerts.hasNitMatch && (
                                            <span
                                                data-testid="nit-similarity-alert-tag"
                                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300"
                                            >
                                                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                                                NIT coincide con cuenta existente
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        {...register("nit_base")}
                                        inputMode="numeric"
                                        onChange={(e) => {
                                            const sanitized = sanitizeNitInput(e.target.value);
                                            e.target.value = sanitized;
                                            setValue("nit_base", sanitized, { shouldDirty: true, shouldValidate: true });
                                        }}
                                        className={cn(
                                            "w-full border p-3 rounded-xl outline-none focus:ring-2 font-medium font-mono transition-colors",
                                            similarityAlerts.hasNitMatch
                                                ? "border-red-400 bg-red-50/30 focus:ring-red-400 focus:border-red-500"
                                                : "border-slate-200 focus:ring-blue-500 focus:border-blue-500"
                                        )}
                                        placeholder="Ej. 900123456-7"
                                    />
                                    <p className="text-xs text-slate-500">
                                        Solo números y máximo un guion con 1 dígito de verificación opcional. Sin puntos ni espacios.
                                    </p>
                                    {errors.nit_base && <p className="text-red-500 text-xs font-bold">{errors.nit_base.message}</p>}
                                    {similarityAlerts.hasNitMatch && similarityAlerts.topNitMatch && (
                                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-red-900">
                                            <div>
                                                <span className="font-bold">Alta coincidencia de NIT:</span> ya pertenece a{" "}
                                                <strong>{similarityAlerts.topNitMatch.nombre}</strong> (Asesor:{" "}
                                                {similarityAlerts.topNitMatch.owner_name || "Sin asignar"}).
                                            </div>
                                            {similarityAlerts.topNitMatch.owner_user_id !== user?.id && (
                                                <button
                                                    type="button"
                                                    disabled={!user?.zona_nombre}
                                                    onClick={() => handleCreateBranchFromMatch(similarityAlerts.topNitMatch!)}
                                                    className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed"
                                                >
                                                    <GitBranch className="w-3.5 h-3.5" />
                                                    Crear cuenta nueva en mi sucursal
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-700 block">Canal de Venta *</label>
                                <SearchableSelect
                                    value={selectedChannel || ""}
                                    onChange={(val) => {
                                        setValue("canal_id", val, { shouldDirty: true, shouldValidate: true });
                                        setValue("subclasificacion_id", "", { shouldDirty: true });
                                    }}
                                    allowClear={false}
                                    placeholder="Seleccione canal de venta..."
                                    searchPlaceholder="Buscar canal de venta..."
                                    triggerClassName="rounded-xl border-slate-200 font-medium"
                                    options={[
                                        { value: "DIST_NAC", label: "Distribución Nacional", searchValue: "DIST_NAC" },
                                        { value: "OBRAS_NAC", label: "Obras Nacional", searchValue: "OBRAS_NAC" },
                                        { value: "DIST_INT", label: "Distribución Internacional", searchValue: "DIST_INT" },
                                        { value: "OBRAS_INT", label: "Obras Internacional", searchValue: "OBRAS_INT" },
                                        { value: "PROPIO", label: "Canal Propio", searchValue: "PROPIO" },
                                    ]}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Subclasificación</label>
                                <SearchableSelect
                                    value={watch("subclasificacion_id") || ""}
                                    disabled={!selectedChannel}
                                    onChange={(val) => setValue("subclasificacion_id", val, { shouldDirty: true, shouldValidate: true })}
                                    placeholder="Seleccione subclasificación..."
                                    searchPlaceholder="Buscar subclasificación..."
                                    triggerClassName="rounded-xl border-slate-200 font-medium"
                                    options={displaySubclassifications
                                        .filter((sub) => sub.canal_id === selectedChannel)
                                        .map((sub) => ({
                                            value: String(sub.id),
                                            label: sub.nombre,
                                        }))}
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 1: Contacto y Ubicación */}
                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-sm font-bold text-slate-700 block mb-1">País</label>
                                    <SearchableSelect
                                        value={watch("pais_id") || ""}
                                        onChange={(val) => {
                                            setValue("pais_id", val, { shouldDirty: true, shouldValidate: true });
                                            setValue("departamento_id", "", { shouldDirty: true });
                                            setValue("ciudad_id", "", { shouldDirty: true });
                                        }}
                                        placeholder="Seleccione País..."
                                        searchPlaceholder="Buscar país..."
                                        triggerClassName="rounded-xl border-slate-200"
                                        options={displayCountries.map((p) => ({
                                            value: String(p.id),
                                            label: p.nombre,
                                        }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-700 block mb-1">Departamento</label>
                                    <SearchableSelect
                                        value={watch("departamento_id") || ""}
                                        disabled={!watch("pais_id")}
                                        onChange={(val) => {
                                            setValue("departamento_id", val, { shouldDirty: true, shouldValidate: true });
                                            setValue("ciudad_id", "", { shouldDirty: true });
                                        }}
                                        placeholder="Seleccione Departamento..."
                                        searchPlaceholder="Buscar departamento..."
                                        triggerClassName="rounded-xl border-slate-200"
                                        options={displayDepartments
                                            .filter(
                                                (dep) =>
                                                    String(dep.pais_id) === watch("pais_id") ||
                                                    (!dep.pais_id && watch("pais_id") === "1")
                                            )
                                            .map((dep) => ({
                                                value: String(dep.id),
                                                label: dep.nombre,
                                            }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-700 block mb-1">Ciudad</label>
                                    <SearchableSelect
                                        value={watch("ciudad_id") || ""}
                                        disabled={!watch("departamento_id")}
                                        onChange={(val) => setValue("ciudad_id", val, { shouldDirty: true, shouldValidate: true })}
                                        placeholder="Seleccione Ciudad..."
                                        searchPlaceholder="Buscar ciudad..."
                                        triggerClassName="rounded-xl border-slate-200"
                                        options={displayCities
                                            .filter((c) => String(c.departamento_id) === watch("departamento_id"))
                                            .map((city) => ({
                                                value: String(city.id),
                                                label: city.nombre,
                                            }))}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-slate-700 block">Teléfono</label>
                                    <input
                                        {...register("telefono")}
                                        className="w-full border p-3 rounded-xl border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Ej. +57 300 123 4567"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-slate-700 block">Correo Electrónico</label>
                                    <input
                                        {...register("email")}
                                        type="email"
                                        className="w-full border p-3 rounded-xl border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="correo@ejemplo.com"
                                    />
                                    {errors.email && <p className="text-red-500 text-xs font-bold">{errors.email.message}</p>}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-700 block">Dirección Física</label>
                                <input
                                    {...register("direccion")}
                                    className="w-full border p-3 rounded-xl border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Calle 123 # 45 - 67"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-700 block">
                                    Origen de la Cuenta <span className="text-slate-400 font-normal">(Opcional)</span>
                                </label>
                                <input
                                    {...register("origen_cuenta")}
                                    className="w-full border p-3 rounded-xl border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ej. Referido, Feria, Publicidad, Web, etc."
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Clasificación y Comentarios */}
                    {step === 2 && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div>
                                <label className="text-sm font-bold text-slate-700 block mb-3">Nivel de Cliente (Premium)</label>
                                <div className="flex gap-4">
                                    {PREMIUM_TIERS.map((tier) => {
                                        const label = tier === "PREMIUM" ? "Premium" : tier === "DESTACADO" ? "Destacado" : "Activo";
                                        const currentTier = watch("nivel_premium");
                                        const isSelected = currentTier === tier;
                                        return (
                                            <button
                                                key={tier}
                                                type="button"
                                                onClick={() => {
                                                    const newVal: AccountFormData["nivel_premium"] = isSelected ? null : tier;
                                                    setValue("nivel_premium", newVal);
                                                    setValue("es_premium", !!newVal);
                                                }}
                                                className={cn(
                                                    "flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all font-bold",
                                                    isSelected
                                                        ? "bg-blue-50 border-blue-500 text-blue-700 shadow-md"
                                                        : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                                                )}
                                            >
                                                <Medal
                                                    className={cn(
                                                        "w-6 h-6 mb-1",
                                                        isSelected ? "text-blue-500 fill-blue-100" : "text-slate-300"
                                                    )}
                                                />
                                                <span className="text-xs uppercase">{label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-700 block">Comentarios Iniciales</label>
                                <textarea
                                    {...register("comentarios")}
                                    rows={4}
                                    className="w-full border p-3 rounded-xl border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    placeholder="Ingresa notas iniciales sobre el cliente..."
                                />
                            </div>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex justify-between items-center pt-6 border-t border-slate-100 bg-white">
                        {step > 0 ? (
                            <button
                                type="button"
                                onClick={handleBack}
                                className="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition active:scale-95"
                            >
                                Atrás
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => router.push("/cuentas")}
                                className="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition active:scale-95"
                            >
                                Cancelar
                            </button>
                        )}

                        {step < LAST_STEP_INDEX ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-1.5 active:scale-95 shadow-md shadow-blue-200"
                            >
                                Siguiente <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={isSubmitting || !canSubmitFinalStep}
                                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-extrabold hover:bg-blue-700 transition flex items-center gap-2 active:scale-95 shadow-lg shadow-blue-200 disabled:opacity-50"
                            >
                                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                Crear Cuenta
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <DuplicateAccountModal
                isOpen={isDuplicateModalOpen}
                onClose={() => setIsDuplicateModalOpen(false)}
                duplicates={duplicateModalData}
                title="Cliente ya registrado en el CRM"
                currentUserId={user?.id}
                userZoneName={user?.zona_nombre}
                onCreateBranch={handleCreateBranchFromDuplicate}
                onOpenExistingAccount={(accountId) => router.push(`/cuentas?id=${accountId}`)}
            />

            <ConfirmationModal
                isOpen={similarityConfirmModal.isOpen}
                onClose={() =>
                    setSimilarityConfirmModal({
                        isOpen: false,
                        matchName: "",
                        ownerName: "",
                        matchReason: "NOMBRE",
                        pendingData: null,
                    })
                }
                onConfirm={() => {
                    const dataToSave = similarityConfirmModal.pendingData;
                    const notice = {
                        matchName: similarityConfirmModal.matchName,
                        ownerName: similarityConfirmModal.ownerName,
                        matchReason: similarityConfirmModal.matchReason,
                    };
                    setSimilarityConfirmModal({
                        isOpen: false,
                        matchName: "",
                        ownerName: "",
                        matchReason: "NOMBRE",
                        pendingData: null,
                    });
                    if (dataToSave) {
                        void executeCreateAccount(dataToSave, notice);
                    }
                }}
                title="Alta coincidencia con una cuenta existente"
                message={buildSimilarityConfirmationMessage({
                    matchName: similarityConfirmModal.matchName,
                    ownerName: similarityConfirmModal.ownerName,
                    matchReason: similarityConfirmModal.matchReason,
                })}
                confirmLabel="Sí, crear y notificar a coordinación"
                cancelLabel="Volver y revisar"
                variant="warning"
                isLoading={isSubmitting}
            />
        </div>
    );
}
