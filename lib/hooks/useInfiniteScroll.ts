import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions {
    loading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    threshold?: number;
    throttleMs?: number;
}

export function useInfiniteScroll({
    loading,
    hasMore,
    onLoadMore,
    threshold = 120,
    throttleMs = 600
}: UseInfiniteScrollOptions) {
    const loadingRef = useRef(loading);
    const hasMoreRef = useRef(hasMore);

    useEffect(() => {
        loadingRef.current = loading;
        hasMoreRef.current = hasMore;
    }, [loading, hasMore]);

    const lastLoadTimeRef = useRef(0);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);

    const triggerLoadMore = useCallback(() => {
        const now = Date.now();
        if (!hasMoreRef.current || loadingRef.current || now - lastLoadTimeRef.current < throttleMs) {
            return;
        }
        lastLoadTimeRef.current = now;
        onLoadMore();
    }, [onLoadMore, throttleMs]);

    // 1. Handsontable / inner element scroll listener
    useEffect(() => {
        const container = tableContainerRef.current;
        if (!container) return;

        let cleanupListener: (() => void) | null = null;

        const attachListener = () => {
            const holder = container.querySelector('.ht_master .wtHolder');
            if (!holder) return false;

            const onScroll = () => {
                const { scrollTop, scrollHeight, clientHeight } = holder;
                if (scrollTop + clientHeight >= scrollHeight - threshold) {
                    triggerLoadMore();
                }
            };

            holder.addEventListener('scroll', onScroll, { passive: true });
            cleanupListener = () => holder.removeEventListener('scroll', onScroll);
            return true;
        };

        if (!attachListener()) {
            const timer = setTimeout(attachListener, 400);
            return () => {
                clearTimeout(timer);
                if (cleanupListener) cleanupListener();
            };
        }

        return () => {
            if (cleanupListener) cleanupListener();
        };
    }, [triggerLoadMore, threshold]);

    // 2. IntersectionObserver for mobile / bottom sentinel
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting) {
                triggerLoadMore();
            }
        }, { rootMargin: '200px' });

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [triggerLoadMore]);

    return {
        tableContainerRef,
        sentinelRef,
        triggerLoadMore
    };
}
