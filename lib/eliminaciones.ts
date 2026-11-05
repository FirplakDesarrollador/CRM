import { supabase } from "@/lib/supabase";

export type TablaEliminable = 'CRM_Cuentas' | 'CRM_Oportunidades' | 'CRM_Contactos';

/**
 * Registra en el backup de eliminaciones un intento de borrado que falló.
 * Nunca lanza error: si no hay conexión o el RPC falla, solo lo deja en consola.
 */
export async function registrarEliminacionFallida(
    tabla: TablaEliminable,
    registroId: string,
    error: unknown,
    origen: 'UI' | 'SYNC_OFFLINE' = 'UI'
): Promise<void> {
    try {
        const motivo = error instanceof Error ? error.message : String(error ?? 'Error desconocido');
        const { error: rpcError } = await supabase.rpc('crm_registrar_eliminacion_fallida', {
            p_tabla: tabla,
            p_registro_id: registroId,
            p_motivo: motivo.slice(0, 1000),
            p_origen: origen,
        });
        if (rpcError) console.warn('[eliminaciones] No se pudo registrar el fallo:', rpcError.message);
    } catch (e) {
        console.warn('[eliminaciones] No se pudo registrar el fallo:', e);
    }
}
