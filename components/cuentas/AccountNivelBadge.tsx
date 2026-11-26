import { resolveAccountNivelBadge } from "@/lib/accountNivel";
import { cn } from "@/lib/utils";

/** Pastilla de nivel, mismo formato que el listado de Cuentas. */
export function AccountNivelBadge({ nivel }: { nivel: string | null | undefined }) {
    const badge = resolveAccountNivelBadge(nivel);
    return (
        <span
            data-testid="account-nivel-badge"
            title={badge.title}
            className={cn(
                "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap",
                badge.className
            )}
        >
            {badge.label}
        </span>
    );
}
