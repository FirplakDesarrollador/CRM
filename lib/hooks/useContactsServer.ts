import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useSyncStore } from '@/lib/stores/useSyncStore';
import { matchesSearchTokens, getSearchTokens } from '@/lib/utils';

export type ContactServer = {
    id: string;
    account_id: string;
    nombre: string;
    cargo?: string;
    email?: string;
    telefono?: string;
    es_principal: boolean;
    created_at?: string;
    created_by?: string;
    updated_at: string;
    account_name?: string | null;
    _hasPendingSync?: boolean;
};

type UseContactsServerProps = {
    pageSize?: number;
    accountId?: string;
};

export function useContactsServer({ pageSize = 20, accountId }: UseContactsServerProps = {}) {
    const [data, setData] = useState<ContactServer[]>([]);
    const [count, setCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [page, setPage] = useState<number>(1);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const pageRef = useRef(1);

    // Filters
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [accountFilter, setAccountFilter] = useState<string | null>(null);
    const [principalFilter, setPrincipalFilter] = useState<'all' | 'principal' | 'secondary'>('all');
    const [sortField, setSortField] = useState<'updated_at' | 'nombre' | 'email'>('updated_at');
    const [sortAsc, setSortAsc] = useState(false);

    // User Context
    const { user, role: userRole, isVendedor } = useCurrentUser();
    const currentUserId = user?.id;

    const [subordinateIds, setSubordinateIds] = useState<string[]>([]);

    useEffect(() => {
        if (userRole === 'COORDINADOR' && currentUserId) {
            supabase
                .from('CRM_Usuarios')
                .select('id')
                .contains('coordinadores', [currentUserId])
                .then(({ data, error }) => {
                    if (!error && data) {
                        setSubordinateIds(data.map(u => u.id));
                    }
                });
        }
    }, [userRole, currentUserId]);

    const fetchContacts = useCallback(async (isLoadMore = false) => {
        if (!currentUserId) return; // Prevent leak while user loads
        const setIsLoadingData = useSyncStore.getState().setIsLoadingData;
        setLoading(true);
        setIsLoadingData(true);
        const currentPage = isLoadMore ? pageRef.current + 1 : 1;
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;

        const fetchOffline = async () => {
            console.log("[useContactsServer] Device is offline or server query failed. Falling back to local Dexie database...");
            let localContacts = (await db.contacts.toArray()).filter(c => !c.is_deleted);
            
            // Seller restriction for offline
            if ((isVendedor || userRole === 'COORDINADOR') && currentUserId) {
                const idsToMatch = isVendedor ? [currentUserId] : [currentUserId, ...subordinateIds];

                // Get my accounts: Owner OR (No owner and I am creator)
                const myAccounts = await db.accounts.filter(a => 
                    idsToMatch.includes(a.owner_user_id || 'dummy') || 
                    (!a.owner_user_id && idsToMatch.includes(a.created_by || 'dummy'))
                ).toArray();
                const myAccountIds = new Set(myAccounts.map(a => a.id));

                // Also include accounts where user is collaborator in opportunities
                const localCollabs = await db.opportunityCollaborators
                    .where('usuario_id')
                    .equals(currentUserId || '')
                    .toArray();
                const collabOppIds = localCollabs.filter(c => !c.is_deleted).map(c => c.oportunidad_id);
                const collabOpps = await db.opportunities.where('id').anyOf(collabOppIds).toArray();
                collabOpps.filter(o => !o.is_deleted && o.account_id).forEach(o => myAccountIds.add(o.account_id));
                
                // Filter contacts: MUST belong to my accounts
                localContacts = localContacts.filter(c => myAccountIds.has(c.account_id));
            }

            if (accountId) {
                localContacts = localContacts.filter(c => c.account_id === accountId);
            }

            // Filtering
            if (searchTerm && searchTerm.trim()) {
                localContacts = localContacts.filter(c => 
                    matchesSearchTokens([c.nombre, c.email, c.telefono, c.cargo], searchTerm)
                );
            }

            if (accountFilter) localContacts = localContacts.filter(c => c.account_id === accountFilter);
            if (principalFilter === 'principal') localContacts = localContacts.filter(c => c.es_principal);
            if (principalFilter === 'secondary') localContacts = localContacts.filter(c => !c.es_principal);

            // Sorting
            localContacts.sort((a, b) => {
                const valueA = sortField === 'updated_at' ? (a.updated_at ? new Date(a.updated_at).getTime() : 0) : ((a as any)[sortField] || '').toLocaleLowerCase();
                const valueB = sortField === 'updated_at' ? (b.updated_at ? new Date(b.updated_at).getTime() : 0) : ((b as any)[sortField] || '').toLocaleLowerCase();
                if (valueA < valueB) return sortAsc ? -1 : 1;
                if (valueA > valueB) return sortAsc ? 1 : -1;
                return 0;
            });

            const totalCount = localContacts.length;
            const paginatedContacts = localContacts.slice(from, to + 1);

            if (isLoadMore) {
                setData(prev => {
                    const existingIds = new Set(prev.map(i => i.id));
                    const newItems = paginatedContacts.filter(i => !existingIds.has(i.id));
                    return [...prev, ...newItems] as ContactServer[];
                });
                setPage(currentPage);
                pageRef.current = currentPage;
            } else {
                setData(paginatedContacts as ContactServer[]);
                setPage(1);
                pageRef.current = 1;
            }
            setCount(totalCount);
            setHasMore(from + paginatedContacts.length < totalCount);
        };

        try {
            if (!navigator.onLine) {
                await fetchOffline();
                return;
            }

            // Build query
            // Use !inner join when filtering by account owner to enforce security
            const needsAccountFilter = isVendedor || userRole === 'COORDINADOR';
            const accountSelect = needsAccountFilter ? 'account:CRM_Cuentas!inner(nombre, owner_user_id)' : 'account:CRM_Cuentas(nombre)';
            
            const selectFields = `
                id,
                account_id,
                nombre,
                cargo,
                email,
                telefono,
                es_principal,
                created_at,
                created_by,
                updated_at,
                ${accountSelect}
            `;

            let query = supabase
                .from('CRM_Contactos')
                .select(selectFields, { count: 'exact' })
                .eq('is_deleted', false);

            if ((isVendedor || userRole === 'COORDINADOR') && currentUserId) {
                const idsToMatch = isVendedor ? [currentUserId] : [currentUserId, ...subordinateIds].filter(Boolean);
                const idsString = idsToMatch.join(',');

                // Fetch IDs of accounts where user is owner OR (unassigned and user is creator)
                const { data: myAccounts } = await supabase
                    .from('CRM_Cuentas')
                    .select('id')
                    .or(`owner_user_id.in.(${idsString}),and(owner_user_id.is.null,created_by.in.(${idsString}))`)
                    .eq('is_deleted', false);
                
                let myAccountIds = myAccounts?.map(a => a.id) || [];

                // Also fetch accounts where user is collaborator in opportunities
                const { data: collabData } = await supabase
                    .from('CRM_Oportunidades_Colaboradores')
                    .select('CRM_Oportunidades!inner(account_id)')
                    .eq('usuario_id', currentUserId)
                    .eq('is_deleted', false);
                
                const collabAccountIds = (collabData as any[])
                    ?.map((c: any) => {
                        const opp = Array.isArray(c.CRM_Oportunidades) ? c.CRM_Oportunidades[0] : c.CRM_Oportunidades;
                        return opp?.account_id;
                    })
                    .filter(Boolean) || [];

                if (collabAccountIds.length > 0) {
                    myAccountIds = [...new Set([...myAccountIds, ...collabAccountIds])];
                }
                
                if (myAccountIds.length > 0) {
                    // Contact MUST belong to an account I own/control/collaborate
                    query = query.in('account_id', myAccountIds);
                } else {
                    // I don't own or collaborate in any accounts, so I shouldn't see any contacts in strict mode
                    // Filtering by a non-existent ID to ensure empty list
                    query = query.eq('id', '00000000-0000-0000-0000-000000000000');
                }
            }

            if (accountId) {
                query = query.eq('account_id', accountId);
            }

            if (accountFilter) query = query.eq('account_id', accountFilter);
            if (principalFilter === 'principal') query = query.eq('es_principal', true);
            if (principalFilter === 'secondary') query = query.eq('es_principal', false);

            if (searchTerm && searchTerm.trim()) {
                const tokens = getSearchTokens(searchTerm);
                for (const token of tokens) {
                    query = query.or(`nombre.ilike.%${token}%,email.ilike.%${token}%,telefono.ilike.%${token}%,cargo.ilike.%${token}%`);
                }
            }

            // Order
            query = query.order(sortField, { ascending: sortAsc }).order('id', { ascending: false });

            // Paging
            query = query.range(from, to);

            // Fetch pending local changes
            const pendingChanges = await db.outbox
                .where('entity_type').equals('CRM_Contactos')
                .and(item => item.status === 'PENDING' || item.status === 'SYNCING')
                .toArray();

            const { data: result, error, count: totalCount } = await query;

            if (error) throw error;

            const resultIds = result ? (result as any[]).map(r => r.id) : [];
            const optimisticUpdates: Record<string, Record<string, any>> = {};
            const itemsToAdd: any[] = [];

            // Group existing results for update
            for (const change of pendingChanges) {
                if (resultIds.includes(change.entity_id)) {
                    if (!optimisticUpdates[change.entity_id]) {
                        optimisticUpdates[change.entity_id] = {};
                    }
                    optimisticUpdates[change.entity_id][change.field_name] = change.new_value;
                }
            }

            // Identify NEW items that match the current accountId filter but aren't on server yet
            if (accountId) {
                const newContactIds = new Set(
                    pendingChanges
                        .filter(c => c.field_name === 'account_id' && c.new_value === accountId)
                        .map(c => c.entity_id)
                );

                for (const newId of newContactIds) {
                    if (!resultIds.includes(newId)) {
                        // Find all fields for this new contact in outbox
                        const fields = pendingChanges.filter(c => c.entity_id === newId);
                        const newItem: any = { id: newId, account_id: accountId, _hasPendingSync: true };
                        fields.forEach(f => newItem[f.field_name] = f.new_value);
                        
                        // Basic filtering for searchTerm if applicable
                        if (searchTerm) {
                            const term = searchTerm.toLowerCase();
                            if (!newItem.nombre?.toLowerCase().includes(term) && !newItem.email?.toLowerCase().includes(term)) {
                                continue;
                            }
                        }
                        itemsToAdd.push(newItem);
                    }
                }
            }

            // --- OPTIMISTIC ACCOUNT NAMES ---
            // Fetch account names for ANY contact that has a pending account_id change
            const accountIdsToResolve = new Set<string>();
            pendingChanges.forEach(c => {
                if (c.field_name === 'account_id') accountIdsToResolve.add(c.new_value);
            });
            // Also include account IDs from current result set to be safe
            result?.forEach((item: any) => {
                const pendingId = optimisticUpdates[item.id]?.account_id;
                if (pendingId) accountIdsToResolve.add(pendingId);
            });

            const accountNameMap: Record<string, string> = {};
            if (accountIdsToResolve.size > 0) {
                const localAccounts = await db.accounts.where('id').anyOf(Array.from(accountIdsToResolve)).toArray();
                localAccounts.forEach(a => accountNameMap[a.id] = a.nombre);
            }

            const flattenedResults = (result as any[]).map(item => {
                const pending = optimisticUpdates[item.id];
                const finalItem = pending ? { ...item, ...pending, _hasPendingSync: true } : item;
                
                // If account_id was updated optimistically, prioritize local name
                let accountName = finalItem.account?.nombre || null;
                if (pending?.account_id && accountNameMap[pending.account_id]) {
                    accountName = accountNameMap[pending.account_id];
                }

                return {
                    ...finalItem,
                    cargo: finalItem.cargo || undefined,
                    email: finalItem.email || undefined,
                    telefono: finalItem.telefono || undefined,
                    account_name: accountName
                };
            });

            // Combine server results with new optimistic items
            let finalData = [...itemsToAdd, ...flattenedResults];
            if (searchTerm && searchTerm.trim()) {
                finalData = finalData.filter(c =>
                    matchesSearchTokens([c.nombre, c.email, c.telefono, c.cargo, c.account_name, c.account?.nombre], searchTerm)
                );
            }

            if (isLoadMore) {
                setData(prev => {
                    const existingIds = new Set(prev.map(i => i.id));
                    const newItems = finalData.filter(i => !existingIds.has(i.id));
                    return [...prev, ...newItems];
                });
                setPage(currentPage);
                pageRef.current = currentPage;
            } else {
                setData(finalData as any);
                setPage(1);
                pageRef.current = 1;
            }

            if (totalCount !== null) {
                setCount(totalCount);
                setHasMore(from + (result?.length || 0) < totalCount);
            }

        } catch (err) {
            console.error("Error fetching contacts from server, executing local Dexie fallback:", err);
            try {
                await fetchOffline();
            } catch (fallbackErr) {
                console.error("Dexie fallback exception:", fallbackErr);
            }
        } finally {
            setLoading(false);
            useSyncStore.getState().setIsLoadingData(false);
        }
    }, [pageSize, searchTerm, accountId, accountFilter, principalFilter, sortField, sortAsc, isVendedor, userRole, currentUserId, subordinateIds]);

    // Initial Fetch & Filter Fetch
    useEffect(() => {
        fetchContacts(false);
    }, [fetchContacts]);

    // OPTIMISTIC UI: Listen to broadcasted local mutations for instant UI updates
    useEffect(() => {
        const handleOptimisticUpdate = (e: any) => {
            const { entityType, entityId, updates } = e.detail;
            if (entityType === 'CRM_Contactos') {
                setData(prev => {
                    const exists = prev.find(item => item.id === entityId);
                    if (exists) {
                        return prev.map(item => item.id === entityId ? { ...item, ...updates } : item);
                    }
                    return [{ id: entityId, ...updates }, ...prev] as any[];
                });
            }
        };
        
        if (typeof window !== 'undefined') {
            window.addEventListener('crm-optimistic-update', handleOptimisticUpdate);
            return () => window.removeEventListener('crm-optimistic-update', handleOptimisticUpdate);
        }
    }, []);

    const loadMore = () => {
        if (!loading && hasMore) {
            fetchContacts(true);
        }
    };

    return {
        data,
        count,
        loading,
        hasMore,
        loadMore,
        setSearchTerm,
        setAccountFilter,
        setPrincipalFilter,
        setSortField,
        setSortAsc,
        sortField,
        sortAsc,
        refresh: () => fetchContacts(false)
    };
}
