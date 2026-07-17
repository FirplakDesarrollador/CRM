"use client";

import { CreateStoreSaleForm } from "@/components/tiendas/CreateStoreSaleForm";

export default function TiendasPage() {
    return (
        <div className="flex-1 flex flex-col p-6 max-w-[1600px] mx-auto w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Tiendas-Ferias</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Registro de clientes, oportunidades, ventas de feria y reservas de inventario
                    </p>
                </div>
            </div>

            <div className="w-full flex-1">
                <CreateStoreSaleForm 
                    onSuccess={() => {
                        alert("¡Registro creado exitosamente!");
                    }}
                />
            </div>
        </div>
    );
}
