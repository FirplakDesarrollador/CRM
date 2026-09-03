import { matchesSearchTokens } from "@/lib/utils";

// ---------------------------------------------------------------------------
// OPORTUNIDADES
// ---------------------------------------------------------------------------

export interface FilterOpportunitiesParams {
    searchTerm?: string | null;
    channelFilter?: string | null;
    subclassificationFilter?: number | null;
    segmentFilter?: number | null;
    phaseFilter?: number | null;
    statusFilter?: "all" | "open" | "won" | "lost";
    originFilter?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    startClosingDate?: string | null;
    endClosingDate?: string | null;
    accountOwnerIds?: string[];
    userFilter?: "mine" | "team" | "collab" | "all" | "unrestricted" | "web";
    accountIdFilter?: string | null;
}

export interface FilterOpportunitiesOptions {
    currentUserId?: string | null;
    userRole?: string | null;
    subordinateIds?: string[];
    collabOppIds?: Set<string>;
    wonPhaseIds?: number[];
    lostPhaseIds?: number[];
    closedPhaseIds?: number[];
    accountsMap?: Map<string, { canal_id?: string | null; subclasificacion_id?: number | null; nombre?: string | null }>;
}

export function filterOpportunities<T extends {
    id: string;
    nombre?: string | null;
    account_id?: string | null;
    amount?: number | null;
    fase_id?: number | string | null;
    estado_id?: number | null;
    owner_user_id?: string | null;
    created_by?: string | null;
    created_at?: string | null;
    fecha_cierre_estimada?: string | null;
    segmento_id?: number | null;
    origen_oportunidad?: string | null;
    url_origen?: string | null;
    vendedor?: { full_name?: string | null } | null;
    account?: { nombre?: string | null; canal_id?: string | null; subclasificacion_id?: number | null } | null;
}>(
    opportunities: T[],
    filters: FilterOpportunitiesParams,
    options: FilterOpportunitiesOptions = {}
): T[] {
    const {
        searchTerm,
        channelFilter,
        subclassificationFilter,
        segmentFilter,
        phaseFilter,
        statusFilter = "all",
        originFilter,
        startDate,
        endDate,
        startClosingDate,
        endClosingDate,
        accountOwnerIds,
        userFilter = "all",
        accountIdFilter
    } = filters;

    const {
        currentUserId,
        userRole,
        subordinateIds = [],
        collabOppIds = new Set(),
        wonPhaseIds = [],
        lostPhaseIds = [],
        closedPhaseIds = [],
        accountsMap
    } = options;

    const isVendedor = userRole === "VENDEDOR";

    return opportunities.filter(o => {
        const acc = accountsMap ? accountsMap.get(o.account_id || "") : o.account;

        // Role restriction for sellers
        if (isVendedor && currentUserId && userFilter !== "unrestricted") {
            const isOwnerOrCreator = o.owner_user_id === currentUserId || (!o.owner_user_id && o.created_by === currentUserId);
            const isCollab = collabOppIds.has(o.id);
            if (!isOwnerOrCreator && !isCollab) {
                return false;
            }
        }

        // Search Term (multi-token search)
        if (searchTerm && searchTerm.trim()) {
            const match = matchesSearchTokens([
                o.nombre,
                acc?.nombre,
                o.vendedor?.full_name,
                o.origen_oportunidad
            ], searchTerm);
            if (!match) return false;
        }

        // Channel filter
        if (channelFilter) {
            const oppChannel = acc?.canal_id;
            if (oppChannel !== channelFilter) return false;
        }

        // Subclassification filter
        if (subclassificationFilter) {
            const oppSubclass = acc?.subclasificacion_id;
            if (oppSubclass !== subclassificationFilter) return false;
        }

        // Segment filter
        if (segmentFilter && o.segmento_id !== segmentFilter) {
            return false;
        }

        // Phase filter
        if (phaseFilter && Number(o.fase_id) !== phaseFilter) {
            return false;
        }

        // Status filter: won, lost, open
        const faseNum = Number(o.fase_id);
        if (statusFilter === "won") {
            const isWonPhase = wonPhaseIds.length > 0 && wonPhaseIds.includes(faseNum);
            const isWonState = [2, 11].includes(o.estado_id as number);
            if (!isWonPhase && !isWonState) return false;
        } else if (statusFilter === "lost") {
            const isLostPhase = lostPhaseIds.length > 0 && lostPhaseIds.includes(faseNum);
            const isLostState = [3, 4, 14].includes(o.estado_id as number);
            if (!isLostPhase && !isLostState) return false;
        } else if (statusFilter === "open") {
            if (closedPhaseIds.length > 0 && closedPhaseIds.includes(faseNum)) {
                return false;
            }
            if ([2, 3, 4, 11, 14].includes(o.estado_id as number)) {
                return false;
            }
        }

        // Origin filter
        if (originFilter) {
            if (!o.origen_oportunidad) return false;
            const lowerOrigin = originFilter.toLowerCase();
            const val = o.origen_oportunidad.toLowerCase();
            if (lowerOrigin === "wp") {
                if (!val.includes("wp") && !val.includes("whatsapp")) return false;
            } else if (!val.includes(lowerOrigin)) {
                return false;
            }
        }

        // Account ID filter
        if (accountIdFilter && o.account_id !== accountIdFilter) {
            return false;
        }

        // Created Date filters
        if (startDate && o.created_at) {
            if (new Date(o.created_at) < new Date(startDate)) return false;
        }
        if (endDate && o.created_at) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (new Date(o.created_at) > end) return false;
        }

        // Closing Date filters
        if (startClosingDate && o.fecha_cierre_estimada) {
            if (new Date(o.fecha_cierre_estimada) < new Date(startClosingDate)) return false;
        }
        if (endClosingDate && o.fecha_cierre_estimada) {
            const end = new Date(endClosingDate);
            end.setHours(23, 59, 59, 999);
            if (new Date(o.fecha_cierre_estimada) > end) return false;
        }

        // Account Owner IDs filter
        if (accountOwnerIds && accountOwnerIds.length > 0) {
            if (!o.owner_user_id || !accountOwnerIds.includes(o.owner_user_id)) {
                return false;
            }
        }

        // Tabs (userFilter)
        if (userFilter !== "unrestricted") {
            if (userFilter === "mine" && currentUserId) {
                const isMine = o.owner_user_id === currentUserId || (!o.owner_user_id && o.created_by === currentUserId);
                if (!isMine) return false;
            } else if (userFilter === "collab") {
                const isCollab = collabOppIds.has(o.id);
                if (!isCollab) return false;
            } else if (userFilter === "all") {
                if (userRole !== "ADMIN" && currentUserId) {
                    const isMine = o.owner_user_id === currentUserId || (!o.owner_user_id && o.created_by === currentUserId);
                    const isCollab = collabOppIds.has(o.id);
                    const isTeam = userRole === "COORDINADOR" && o.owner_user_id && subordinateIds.includes(o.owner_user_id);
                    if (!isMine && !isCollab && !isTeam) return false;
                }
            } else if (userFilter === "team") {
                if (userRole === "COORDINADOR" && currentUserId) {
                    const isTeam = o.owner_user_id === currentUserId || (o.owner_user_id && subordinateIds.includes(o.owner_user_id));
                    if (!isTeam) return false;
                } else if (userRole !== "ADMIN" && currentUserId) {
                    if (o.owner_user_id !== currentUserId) return false;
                }
            } else if (userFilter === "web") {
                const hasWebUrl = Boolean(o.url_origen && o.url_origen.trim() !== "");
                const originLower = (o.origen_oportunidad || "").toLowerCase();
                const hasWebOrigin = originLower.includes("web") || originLower.includes("pagina") || originLower.includes("página");
                if (!hasWebUrl && !hasWebOrigin) return false;
            }
        }

        return true;
    });
}

// ---------------------------------------------------------------------------
// CUENTAS
// ---------------------------------------------------------------------------

export interface FilterAccountsParams {
    searchTerm?: string | null;
    assignedUserId?: string | null;
    channelFilter?: string | null;
    subclassificationFilter?: number | null;
    nivelPremiumFilter?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    webFilter?: boolean;
}

export interface FilterAccountsOptions {
    currentUserId?: string | null;
    userRole?: string | null;
    subordinateIds?: string[];
    collabAccountIds?: Set<string>;
    webAccountIds?: Set<string>;
}

export function filterAccounts<T extends {
    id: string;
    nombre?: string | null;
    nit?: string | null;
    nit_base?: string | null;
    ciudad?: string | null;
    direccion?: string | null;
    email?: string | null;
    telefono?: string | null;
    owner_user_id?: string | null;
    created_by?: string | null;
    canal_id?: string | null;
    subclasificacion_id?: number | null;
    nivel_premium?: string | null;
    created_at?: string | null;
}>(
    accounts: T[],
    filters: FilterAccountsParams,
    options: FilterAccountsOptions = {}
): T[] {
    const {
        searchTerm,
        assignedUserId,
        channelFilter,
        subclassificationFilter,
        nivelPremiumFilter,
        startDate,
        endDate,
        webFilter = false
    } = filters;

    const {
        currentUserId,
        userRole,
        subordinateIds = [],
        collabAccountIds = new Set(),
        webAccountIds = new Set()
    } = options;

    const isVendedor = userRole === "VENDEDOR";

    return accounts.filter(a => {
        // Role permissions
        if (isVendedor && currentUserId) {
            const isOwner = a.owner_user_id === currentUserId || (!a.owner_user_id && a.created_by === currentUserId);
            const isCollab = collabAccountIds.has(a.id);
            if (!isOwner && !isCollab) return false;
        } else if (userRole === "COORDINADOR" && currentUserId) {
            const isOwner = a.owner_user_id === currentUserId || (!a.owner_user_id && a.created_by === currentUserId);
            const isTeam = (a.owner_user_id && subordinateIds.includes(a.owner_user_id)) ||
                (!a.owner_user_id && a.created_by && subordinateIds.includes(a.created_by));
            const isCollab = collabAccountIds.has(a.id);
            if (!isOwner && !isTeam && !isCollab) return false;
        }

        // Web Filter
        if (webFilter) {
            if (!webAccountIds.has(a.id)) return false;
        }

        // Search Term (multi-token search)
        if (searchTerm && searchTerm.trim()) {
            const match = matchesSearchTokens([
                a.nombre,
                a.nit_base || a.nit,
                a.ciudad,
                a.direccion,
                a.email,
                a.telefono
            ], searchTerm);
            if (!match) return false;
        }

        // Assigned user filter
        if (assignedUserId) {
            if (a.owner_user_id !== assignedUserId) return false;
        }

        // Channel filter
        if (channelFilter) {
            if (a.canal_id !== channelFilter) return false;
        }

        // Subclassification filter
        if (subclassificationFilter) {
            if (a.subclasificacion_id !== subclassificationFilter) return false;
        }

        // Premium level filter
        if (nivelPremiumFilter) {
            if (a.nivel_premium !== nivelPremiumFilter) return false;
        }

        // Created Date filters
        if (startDate && a.created_at) {
            if (new Date(a.created_at) < new Date(startDate)) return false;
        }
        if (endDate && a.created_at) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (new Date(a.created_at) > end) return false;
        }

        return true;
    });
}

// ---------------------------------------------------------------------------
// ACTIVIDADES
// ---------------------------------------------------------------------------

export interface FilterActivitiesParams {
    searchQuery?: string;
    filterType?: string;
    filterClassification?: string;
    filterSubclassification?: string;
    filterUser?: string;
    filterStatus?: "all" | "completed" | "pending" | "overdue";
    filterChannel?: string;
    filterDateFrom?: string;
    filterDateTo?: string;
}

export interface FilterActivitiesOptions {
    currentUserId?: string | null;
    canViewAll?: boolean;
    collaborativeOppIds?: Set<string>;
    oppMap?: Map<string, { account_id?: string | null; nombre?: string | null }>;
    accMap?: Map<string, { canal_id?: string | null; nombre?: string | null }>;
    now?: Date;
}

export function filterActivities<T extends {
    id: string;
    asunto?: string | null;
    descripcion?: string | null;
    tipo_actividad?: string | null;
    clasificacion_id?: number | string | null;
    subclasificacion_id?: number | string | null;
    user_id?: string | null;
    opportunity_id?: string | null;
    account_id?: string | null;
    is_completed?: boolean;
    fecha_inicio: string;
    fecha_fin?: string | null;
}>(
    activities: T[],
    filters: FilterActivitiesParams,
    options: FilterActivitiesOptions = {}
): T[] {
    const {
        searchQuery = "",
        filterType = "",
        filterClassification = "",
        filterSubclassification = "",
        filterUser = "",
        filterStatus = "all",
        filterChannel = "",
        filterDateFrom = "",
        filterDateTo = ""
    } = filters;

    const {
        currentUserId,
        canViewAll = false,
        collaborativeOppIds = new Set(),
        oppMap = new Map(),
        accMap = new Map(),
        now = new Date()
    } = options;

    const lowerQuery = searchQuery.trim().toLowerCase();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    return activities.filter(act => {
        // Ownership / permissions
        if (!canViewAll) {
            if (!currentUserId) return false;
            const isOwner = act.user_id === currentUserId;
            const isCollab = act.opportunity_id ? collaborativeOppIds.has(act.opportunity_id) : false;
            if (!isOwner && !isCollab) return false;
        }

        // Search Query (activity fields + related account / opportunity names)
        if (lowerQuery) {
            const opp = act.opportunity_id ? oppMap.get(act.opportunity_id) : null;
            const resolvedAccountId = act.account_id || opp?.account_id;
            const acc = resolvedAccountId ? accMap.get(resolvedAccountId) : null;

            const searchMatch =
                act.asunto?.toLowerCase().includes(lowerQuery) ||
                act.descripcion?.toLowerCase().includes(lowerQuery) ||
                acc?.nombre?.toLowerCase().includes(lowerQuery) ||
                opp?.nombre?.toLowerCase().includes(lowerQuery);

            if (!searchMatch) return false;
        }

        // Type / Classification / Subclassification
        if (filterType && act.tipo_actividad !== filterType) return false;
        if (filterClassification && String(act.clasificacion_id) !== String(filterClassification)) return false;
        if (filterSubclassification && String(act.subclasificacion_id) !== String(filterSubclassification)) return false;

        // User
        if (filterUser && act.user_id !== filterUser) return false;

        // Status (completed, pending, overdue)
        if (filterStatus === "completed" && !act.is_completed) return false;
        if (filterStatus === "pending" && act.is_completed) return false;
        if (filterStatus === "overdue") {
            if (act.is_completed) return false;
            const actDate = new Date(act.fecha_inicio);
            actDate.setHours(0, 0, 0, 0);
            if (actDate >= today) return false;
        }

        // Channel (resolved via account_id or opportunity account)
        if (filterChannel) {
            const opp = act.opportunity_id ? oppMap.get(act.opportunity_id) : null;
            const resolvedAccountId = act.account_id || opp?.account_id;
            const acc = resolvedAccountId ? accMap.get(resolvedAccountId) : null;
            const actChannel = acc?.canal_id || "";
            if (actChannel !== filterChannel) return false;
        }

        // Date Range
        if (filterDateFrom) {
            if (new Date(act.fecha_inicio) < new Date(`${filterDateFrom}T00:00:00`)) return false;
        }
        if (filterDateTo) {
            if (new Date(act.fecha_inicio) > new Date(`${filterDateTo}T23:59:59`)) return false;
        }

        return true;
    });
}

// ---------------------------------------------------------------------------
// CONTACTOS
// ---------------------------------------------------------------------------

export interface FilterContactsParams {
    searchTerm?: string | null;
    accountFilter?: string | null;
    principalFilter?: "all" | "principal" | "secondary";
    accountId?: string | null;
}

export interface FilterContactsOptions {
    currentUserId?: string | null;
    userRole?: string | null;
    allowedAccountIds?: Set<string>;
}

export function filterContacts<T extends {
    id: string;
    account_id?: string | null;
    nombre?: string | null;
    cargo?: string | null;
    email?: string | null;
    telefono?: string | null;
    es_principal?: boolean;
}>(
    contacts: T[],
    filters: FilterContactsParams,
    options: FilterContactsOptions = {}
): T[] {
    const {
        searchTerm,
        accountFilter,
        principalFilter = "all",
        accountId
    } = filters;

    const {
        currentUserId,
        userRole,
        allowedAccountIds
    } = options;

    const isRestrictedRole = userRole === "VENDEDOR" || userRole === "COORDINADOR";

    return contacts.filter(c => {
        // Role-based account security (must belong to accounts user owns, created, or collaborates in)
        if (isRestrictedRole && currentUserId && allowedAccountIds) {
            if (!c.account_id || !allowedAccountIds.has(c.account_id)) {
                return false;
            }
        }

        // Direct account ID filter (e.g. from parent component)
        if (accountId && c.account_id !== accountId) {
            return false;
        }

        // Dropdown account filter
        if (accountFilter && c.account_id !== accountFilter) {
            return false;
        }

        // Principal / Secondary filter
        if (principalFilter === "principal" && !c.es_principal) return false;
        if (principalFilter === "secondary" && c.es_principal) return false;

        // Search Term (multi-token search across nombre, email, telefono, cargo)
        if (searchTerm && searchTerm.trim()) {
            const match = matchesSearchTokens([
                c.nombre,
                c.email,
                c.telefono,
                c.cargo
            ], searchTerm);
            if (!match) return false;
        }

        return true;
    });
}
