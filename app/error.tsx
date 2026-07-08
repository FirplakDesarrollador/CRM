'use client'; // Los componentes de error deben ser componentes de cliente

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Enviar el error a un servicio de reporte, o al menos mostrarlo en consola
        console.error("CRM Error Capturado:", error);
    }, [error]);

    return (
        <div className="flex h-[80vh] w-full items-center justify-center bg-transparent flex-col space-y-4 px-4">
            <div className="flex flex-col items-center justify-center bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-xl font-bold text-slate-800 mb-2">Error inesperado por falla al conectarse al servidor</h2>
                <p className="text-slate-500 mb-6 text-sm">
                    Ha ocurrido un problema al procesar la información de la aplicación. Por favor, intenta de nuevo.
                </p>
                
                {/* Opcional: Para el desarrollador, muestra el mensaje de error en desarrollo */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-left w-full mb-4 overflow-auto max-h-32">
                        <p className="text-xs text-red-800 font-mono font-semibold">{error.message}</p>
                    </div>
                )}

                <button
                    onClick={() => reset()}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all"
                >
                    <RefreshCw className="w-4 h-4" />
                    Reintentar
                </button>
            </div>
        </div>
    );
}
