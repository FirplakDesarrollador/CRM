import { describe, it, expect } from 'vitest';
import { resolveNetworkStatus, resolveStatusLineVisuals } from '@/lib/hooks/useNetworkQuality';

describe('resolveNetworkStatus', () => {
    it('retorna online cuando hay conexión normal y baja latencia', () => {
        const status = resolveNetworkStatus({
            isOnline: true,
            latency: 120,
            effectiveType: '4g',
            consecutiveFailures: 0,
        });
        expect(status).toBe('online');
    });

    it('retorna offline cuando isOnline es false', () => {
        const status = resolveNetworkStatus({
            isOnline: false,
            latency: null,
            effectiveType: '4g',
            consecutiveFailures: 0,
        });
        expect(status).toBe('offline');
    });

    it('retorna offline tras 2 o más fallos consecutivos de red', () => {
        const status = resolveNetworkStatus({
            isOnline: true,
            latency: null,
            consecutiveFailures: 2,
        });
        expect(status).toBe('offline');
    });

    it('retorna unstable cuando la latencia supera el umbral (>1200ms)', () => {
        const status = resolveNetworkStatus({
            isOnline: true,
            latency: 1450,
            effectiveType: '4g',
            consecutiveFailures: 0,
        });
        expect(status).toBe('unstable');
    });

    it('retorna unstable en conexiones lentas 2g o slow-2g', () => {
        expect(
            resolveNetworkStatus({
                isOnline: true,
                latency: 200,
                effectiveType: '2g',
                consecutiveFailures: 0,
            })
        ).toBe('unstable');

        expect(
            resolveNetworkStatus({
                isOnline: true,
                latency: 150,
                effectiveType: 'slow-2g',
                consecutiveFailures: 0,
            })
        ).toBe('unstable');
    });

    it('retorna unstable en el primer fallo antes de confirmar offline', () => {
        const status = resolveNetworkStatus({
            isOnline: true,
            latency: null,
            consecutiveFailures: 1,
        });
        expect(status).toBe('unstable');
    });
});

describe('resolveStatusLineVisuals', () => {
    it('retorna gradiente estático y glow sutil cuando está online sin sincronización', () => {
        const visuals = resolveStatusLineVisuals('online', { isSyncing: false, latency: 80 });
        expect(visuals.label).toBe('En línea');
        expect(visuals.bgClass).toContain('from-[#254153]');
        expect(visuals.bgClass).not.toContain('animate-luminous-flow');
    });

    it('activa animación de haz de luz fluyente y glow neón cuando está sincronizando en segundo plano', () => {
        const visuals = resolveStatusLineVisuals('online', { isSyncing: true });
        expect(visuals.label).toBe('Sincronizando');
        expect(visuals.description).toBe('Cargando información en segundo plano...');
        expect(visuals.bgClass).toContain('animate-luminous-flow');
        expect(visuals.glowStyle.boxShadow).toContain('rgba(56, 189, 248, 0.85)');
    });

    it('retorna estilo de advertencia ámbar cuando está en conexión inestable', () => {
        const visuals = resolveStatusLineVisuals('unstable', { latency: 1500 });
        expect(visuals.label).toBe('Conexión inestable');
        expect(visuals.pulseClass).toBe('animate-pulse');
        expect(visuals.bgClass).toContain('from-[#d97706]');
    });

    it('retorna estilo rojo de alerta cuando está sin conexión', () => {
        const visuals = resolveStatusLineVisuals('offline');
        expect(visuals.label).toBe('Sin conexión');
        expect(visuals.pulseClass).toBe('animate-pulse');
        expect(visuals.bgClass).toContain('from-[#991b1b]');
    });
});
