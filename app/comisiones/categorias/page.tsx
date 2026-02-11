"use client";

import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { hasPermission } from '@/lib/permissions';
import { CommissionCategoryManager } from '@/components/comisiones/CommissionCategoryManager';
import Link from 'next/link';

export default function CategoriasComisionPage() {
    const { role } = useCurrentUser();

    if (!hasPermission(role, 'manage_commission_categories')) {
        return (
            <div className="max-w-7xl mx-auto p-6 text-center py-24">
                <p className="text-slate-500">No tienes permisos para acceder a esta pagina.</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            <div className="flex items-center gap-2 mb-2">
                <Link href="/comisiones" className="text-sm text-slate-500 hover:text-slate-700 transition-all">
                    Comisiones
                </Link>
                <span className="text-sm text-slate-400">/</span>
                <span className="text-sm font-semibold text-slate-900">Categorias</span>
            </div>
            <CommissionCategoryManager />
        </div>
    );
}
