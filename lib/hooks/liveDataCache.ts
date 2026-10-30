"use client";

import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 1000;
// How long a fetched table stays cached in memory before a hook mount
// re-fetches it. The indicadores report pages (3-6) each mount their own
// useLive* hook instance and unmount it when the user switches tabs, so
// without this every tab switch re-downloaded the whole table from
// scratch. A short TTL keeps tab-switching instant while still picking up
// changes made elsewhere in the CRM within a minute or so; the "Actualizar
// datos" button (app/indicadores/page.tsx) bypasses this entirely via
// refreshLiveData() for someone who just made an edit and wants to see it
// right away instead of waiting out the TTL.
const CACHE_TTL_MS = 60 * 1000;

interface CacheEntry<T> {
    rows: T[];
    fetchedAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown[]>>();
const refreshListeners = new Set<() => void>();

/**
 * Fetches every row of a table in pages of PAGE_SIZE, ordered by `id` for
 * stable pagination (Postgres doesn't guarantee row order across requests
 * without an explicit ORDER BY, so unordered .range() pagination can
 * silently skip or duplicate rows once a table spans multiple pages).
 *
 * The first page also asks Postgres for the exact row count so the
 * remaining pages can be requested concurrently instead of one at a time —
 * for tables with tens of thousands of rows (CRM_Oportunidades,
 * CRM_Actividades, CRM_Cuentas), that turns dozens of serialized round
 * trips into one round-trip's worth of wall-clock time.
 */
async function fetchAllRows<T>(table: string, columns: string): Promise<T[]> {
    const first = await supabase
        .from(table)
        .select(columns, { count: "exact" })
        .order("id", { ascending: true })
        .range(0, PAGE_SIZE - 1);
    if (first.error) throw first.error;

    const rows = ((first.data as T[]) || []).slice();
    const total = first.count ?? rows.length;
    if (rows.length < PAGE_SIZE || rows.length >= total) return rows;

    const remainingPages = Math.ceil((total - rows.length) / PAGE_SIZE);
    const pageResults = await Promise.all(
        Array.from({ length: remainingPages }, (_, i) => {
            const from = PAGE_SIZE * (i + 1);
            return supabase
                .from(table)
                .select(columns)
                .order("id", { ascending: true })
                .range(from, from + PAGE_SIZE - 1);
        })
    );

    for (const { data, error } of pageResults) {
        if (error) throw error;
        rows.push(...((data as T[]) || []));
    }
    return rows;
}

/**
 * Same as fetchAllRows, but shares one in-flight request and caches the
 * result (by table name) for CACHE_TTL_MS, so multiple indicadores pages
 * mounting the same live-data hook within that window reuse one fetch
 * instead of each re-downloading the full table.
 */
export function fetchAllRowsCached<T>(table: string, columns: string): Promise<T[]> {
    const cached = cache.get(table) as CacheEntry<T> | undefined;
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return Promise.resolve(cached.rows);
    }

    const existing = inFlight.get(table) as Promise<T[]> | undefined;
    if (existing) return existing;

    const request = fetchAllRows<T>(table, columns)
        .then(rows => {
            cache.set(table, { rows, fetchedAt: Date.now() });
            inFlight.delete(table);
            return rows;
        })
        .catch(err => {
            inFlight.delete(table);
            throw err;
        });
    inFlight.set(table, request);
    return request;
}

/** Last cached rows for a table, if any, for synchronous initial render. */
export function getCachedRows<T>(table: string): T[] | undefined {
    return (cache.get(table) as CacheEntry<T> | undefined)?.rows;
}

/** A useLive* hook calls this on mount; it re-fetches whenever refreshLiveData() runs. */
export function onLiveDataRefresh(listener: () => void): () => void {
    refreshListeners.add(listener);
    return () => refreshListeners.delete(listener);
}

/**
 * Drops every cached table so the next render of each mounted useLive* hook
 * re-fetches immediately, instead of waiting out CACHE_TTL_MS. Wired to the
 * "Actualizar datos" button in Indicadores for right after someone edits an
 * opportunity/actividad/cuenta and wants the report to pick it up now.
 */
export function refreshLiveData(): void {
    cache.clear();
    refreshListeners.forEach(listener => listener());
}
