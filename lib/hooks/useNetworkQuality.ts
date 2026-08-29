"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSyncStore } from "@/lib/stores/useSyncStore";

export type NetworkStatus = "online" | "unstable" | "offline";

export interface NetworkStatusInput {
    isOnline: boolean;
    latency: number | null;
    effectiveType?: string | null;
    consecutiveFailures?: number;
}

export function resolveNetworkStatus(input: NetworkStatusInput): NetworkStatus {
    if (!input.isOnline || (input.consecutiveFailures !== undefined && input.consecutiveFailures >= 2)) {
        return "offline";
    }

    if (
        (input.latency !== null && input.latency > 1200) ||
        input.effectiveType === "2g" ||
        input.effectiveType === "slow-2g" ||
        (input.consecutiveFailures !== undefined && input.consecutiveFailures === 1)
    ) {
        return "unstable";
    }

    return "online";
}

interface NetworkInformation extends EventTarget {
    effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
    rtt?: number;
    downlink?: number;
    saveData?: boolean;
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
}

export function useNetworkQuality() {
    const setStoreOnline = useSyncStore((state) => state.setOnline);
    const [status, setStatus] = useState<NetworkStatus>("online");
    const [latency, setLatency] = useState<number | null>(null);
    const [effectiveType, setEffectiveType] = useState<string | null>(null);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);
    const [isChecking, setIsChecking] = useState<boolean>(false);
    const consecutiveFailuresRef = useRef<number>(0);

    const checkConnection = useCallback(async () => {
        if (typeof window === "undefined") return;

        if (!navigator.onLine) {
            const nextStatus = resolveNetworkStatus({
                isOnline: false,
                latency: null,
                effectiveType,
                consecutiveFailures: consecutiveFailuresRef.current,
            });
            setStatus(nextStatus);
            setLatency(null);
            setStoreOnline(false);
            return;
        }

        setIsChecking(true);
        const startTime = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        try {
            const res = await fetch(`/api/health?t=${Date.now()}`, {
                method: "HEAD",
                cache: "no-store",
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            const duration = Math.round(performance.now() - startTime);
            setLatency(duration);
            setLastChecked(new Date());

            // Check connection API info if available
            const nav = navigator as Navigator & { connection?: NetworkInformation };
            const conn = nav.connection;
            const netType = conn?.effectiveType || null;
            if (netType) setEffectiveType(netType);

            if (res.ok || res.status === 204 || res.status === 200) {
                consecutiveFailuresRef.current = 0;
                const nextStatus = resolveNetworkStatus({
                    isOnline: true,
                    latency: duration,
                    effectiveType: netType,
                    consecutiveFailures: 0,
                });
                setStatus(nextStatus);
                setStoreOnline(true);
            } else {
                consecutiveFailuresRef.current += 1;
                const nextStatus = resolveNetworkStatus({
                    isOnline: true,
                    latency: duration,
                    effectiveType: netType,
                    consecutiveFailures: consecutiveFailuresRef.current,
                });
                setStatus(nextStatus);
                setStoreOnline(nextStatus !== "offline");
            }
        } catch {
            clearTimeout(timeoutId);
            consecutiveFailuresRef.current += 1;
            setLastChecked(new Date());

            const nextStatus = resolveNetworkStatus({
                isOnline: navigator.onLine,
                latency: null,
                effectiveType,
                consecutiveFailures: consecutiveFailuresRef.current,
            });
            setStatus(nextStatus);
            setStoreOnline(nextStatus !== "offline");
        } finally {
            setIsChecking(false);
        }
    }, [effectiveType, setStoreOnline]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        // Initial status based on navigator
        if (!navigator.onLine) {
            setStatus("offline");
            setStoreOnline(false);
        } else {
            // Initial active verification
            checkConnection();
        }

        const handleOnline = () => {
            consecutiveFailuresRef.current = 0;
            checkConnection();
        };

        const handleOffline = () => {
            setStatus("offline");
            setStoreOnline(false);
            setLatency(null);
        };

        const handleVisibility = () => {
            if (document.visibilityState === "visible" && navigator.onLine) {
                checkConnection();
            }
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        document.addEventListener("visibilitychange", handleVisibility);

        const nav = navigator as Navigator & { connection?: NetworkInformation };
        const conn = nav.connection;
        const handleConnChange = () => {
            if (conn?.effectiveType) {
                setEffectiveType(conn.effectiveType);
                if (conn.effectiveType === "slow-2g" || conn.effectiveType === "2g") {
                    setStatus("unstable");
                } else {
                    checkConnection();
                }
            }
        };

        if (conn && typeof conn.addEventListener === "function") {
            conn.addEventListener("change", handleConnChange);
        }

        // Periodic heartbeat every 30 seconds
        const intervalId = setInterval(() => {
            if (document.visibilityState === "visible") {
                checkConnection();
            }
        }, 30000);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            document.removeEventListener("visibilitychange", handleVisibility);
            if (conn && typeof conn.removeEventListener === "function") {
                conn.removeEventListener("change", handleConnChange);
            }
            clearInterval(intervalId);
        };
    }, [checkConnection, setStoreOnline]);

    return {
        status,
        latency,
        effectiveType,
        lastChecked,
        isChecking,
        checkConnection,
    };
}
