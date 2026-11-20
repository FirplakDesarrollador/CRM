export interface ActivityPlatformUser {
    id: string;
    full_name: string | null;
    email: string;
}

export interface ActivityUserOption {
    value: string;
    label: string;
    searchValue: string;
}

/**
 * Resolves the default user_id for an activity in CreateActivityModal:
 * - When editing an existing activity, keeps its assigned user_id.
 * - When creating a new activity, defaults to the currently logged-in user.
 */
export function resolveDefaultActivityUserId(params: {
    initialDataUserId?: string | null;
    currentUserId?: string | null;
    activeLocalUserId?: string | null;
}): string {
    const fromInitial = typeof params.initialDataUserId === 'string' ? params.initialDataUserId.trim() : '';
    if (fromInitial) return fromInitial;

    const fromCurrent = typeof params.currentUserId === 'string' ? params.currentUserId.trim() : '';
    if (fromCurrent) return fromCurrent;

    const fromLocal = typeof params.activeLocalUserId === 'string' ? params.activeLocalUserId.trim() : '';
    if (fromLocal) return fromLocal;

    return '';
}

/**
 * Builds the SearchableSelect options for platform users, guaranteeing that the
 * currently logged-in user is present in the options list immediately (even before
 * the remote CRM_Usuarios query resolves or while offline).
 */
export function buildActivityUserOptions(
    users: ActivityPlatformUser[],
    currentUser?: { id?: string | null; full_name?: string | null; email?: string | null } | null
): ActivityUserOption[] {
    const list: ActivityPlatformUser[] = [...users];
    const currentId = typeof currentUser?.id === 'string' ? currentUser.id.trim() : '';

    if (currentId && !list.some((u) => u.id === currentId)) {
        list.unshift({
            id: currentId,
            full_name: currentUser?.full_name ?? null,
            email: currentUser?.email ?? '',
        });
    }

    return list.map((u) => ({
        value: u.id,
        label: u.full_name || u.email || `Usuario ${u.id}`,
        searchValue: `${u.full_name || ''} ${u.email || ''}`.trim(),
    }));
}

/**
 * Resolves the final user_id to persist when creating a new activity.
 * Uses the user selected in the dropdown if valid, falling back to the active session user.
 */
export function resolveActivityUserId(
    requestedUserId: string | null | undefined,
    sessionUserId: string
): string {
    const cleaned = typeof requestedUserId === 'string' ? requestedUserId.trim() : '';
    return cleaned || sessionUserId;
}
