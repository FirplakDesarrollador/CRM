"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { CreateStoreSaleModal } from "@/components/tiendas/CreateStoreSaleModal";

export default function TiendasPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    return (
        <div className="flex-1 flex flex-col p-6 max-w-[1600px] mx-auto w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Tiendas</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Gestión de tiendas
                    </p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Plus className="w-5 h-5" />
                    Crear Venta
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/60 p-8 flex items-center justify-center min-h-[400px] shadow-sm">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-slate-700 mb-2">Próximamente</h2>
                    <p className="text-slate-500">Este módulo está en construcción.</p>
                </div>
            </div>

            <CreateStoreSaleModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSuccess={() => {
                    alert("¡Registro creado exitosamente!");
                }}
            />
        </div>
    );
}
