// Shared "estado" (open/won/lost) bucketing used across the native indicadores
// report pages, following the same convention as lib/filterUtils.ts and
// app/informes/page.tsx: won = estado_id 2 or 11, lost = 3, 4 or 14, everything
// else (including null, which covers legacy rows) counts as open.

export type EstadoBucket = "open" | "won" | "lost";

export const ESTADO_BUCKET_LABELS: Record<EstadoBucket, string> = {
    open: "Abierta",
    won: "Cerrado Ganado",
    lost: "Cerrado Perdido",
};

export const ESTADO_BUCKET_COLORS: Record<EstadoBucket, string> = {
    open: "#3b82f6",
    won: "#22c55e",
    lost: "#ef4444",
};

const WON_IDS = [2, 11];
const LOST_IDS = [3, 4, 14];

export function getEstadoBucket(estadoId?: number | null): EstadoBucket {
    if (estadoId != null && WON_IDS.includes(estadoId)) return "won";
    if (estadoId != null && LOST_IDS.includes(estadoId)) return "lost";
    return "open";
}

export const ESTADO_BUCKET_ORDER: EstadoBucket[] = ["open", "won", "lost"];
