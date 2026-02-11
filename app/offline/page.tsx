"use client";

import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function OfflinePage() {
    const router = useRouter();

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 text-center">
            <div className="bg-slate-100 p-6 rounded-full mb-6 text-slate-400">
                <WifiOff size={64} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Sin conexión a Internet</h1>
            <p className="text-slate-600 mb-8 max-w-md">
                Actualmente no tienes conexión. Puedes navegar por las secciones que ya has visitado o intentar recargar cuando vuelvas a tener señal.
            </p>
            <div className="space-y-4">
                <Button
                    onClick={() => window.location.reload()}
                    className="bg-[#254153] hover:bg-[#1a2e3b] text-white w-full sm:w-auto px-8"
                >
                    Reintentar conexión
                </Button>
                <br />
                <Button
                    variant="outline"
                    onClick={() => router.back()}
                    className="w-full sm:w-auto px-8"
                >
                    Volver atrás
                </Button>
            </div>
        </div>
    );
}
