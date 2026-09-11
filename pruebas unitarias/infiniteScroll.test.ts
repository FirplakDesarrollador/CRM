import { describe, expect, it, vi } from 'vitest';

describe('useInfiniteScroll Logic & Calculations', () => {
    it('debe detectar cuándo el scroll se encuentra cerca del final según el umbral', () => {
        const threshold = 120;
        
        // Caso 1: En la mitad (no cerca del final)
        const scroll1 = { scrollTop: 500, scrollHeight: 2000, clientHeight: 600 };
        const isNearBottom1 = scroll1.scrollTop + scroll1.clientHeight >= scroll1.scrollHeight - threshold;
        expect(isNearBottom1).toBe(false);

        // Caso 2: Cerca del fondo (a 50px del final, menor que threshold 120)
        const scroll2 = { scrollTop: 1350, scrollHeight: 2000, clientHeight: 600 };
        const isNearBottom2 = scroll2.scrollTop + scroll2.clientHeight >= scroll2.scrollHeight - threshold;
        expect(isNearBottom2).toBe(true);

        // Caso 3: Justo en el fondo exacto
        const scroll3 = { scrollTop: 1400, scrollHeight: 2000, clientHeight: 600 };
        const isNearBottom3 = scroll3.scrollTop + scroll3.clientHeight >= scroll3.scrollHeight - threshold;
        expect(isNearBottom3).toBe(true);
    });

    it('no debe disparar carga si ya está cargando o no hay más registros', () => {
        const onLoadMore = vi.fn();
        let loading = true;
        let hasMore = true;

        const attemptLoad = () => {
            if (!hasMore || loading) return;
            onLoadMore();
        };

        attemptLoad();
        expect(onLoadMore).not.toHaveBeenCalled();

        loading = false;
        hasMore = false;
        attemptLoad();
        expect(onLoadMore).not.toHaveBeenCalled();

        hasMore = true;
        attemptLoad();
        expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    it('debe aplicar limitación (throttling) para evitar solicitudes duplicadas en ráfaga', () => {
        const onLoadMore = vi.fn();
        let lastLoadTime = 0;
        const throttleMs = 600;

        const attemptLoad = (now: number) => {
            if (now - lastLoadTime < throttleMs) return;
            lastLoadTime = now;
            onLoadMore();
        };

        // Primera llamada en t=1000
        attemptLoad(1000);
        expect(onLoadMore).toHaveBeenCalledTimes(1);

        // Llamadas consecutivas en ráfaga (t=1100, t=1200, t=1500)
        attemptLoad(1100);
        attemptLoad(1200);
        attemptLoad(1500);
        expect(onLoadMore).toHaveBeenCalledTimes(1);

        // Llamada después del período de throttle (t=1700, 700ms después)
        attemptLoad(1700);
        expect(onLoadMore).toHaveBeenCalledTimes(2);
    });
});
