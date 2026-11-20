"use server";

import { createClient } from "@supabase/supabase-js";

export async function recoverPasswordAction(email: string, origin: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Initialize a fresh client on the server to ensure clean state
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const cleanOrigin = (origin || process.env.NEXT_PUBLIC_SITE_URL || "https://crm-64yu.vercel.app").replace(/\/+$/, "");
        const redirectUrl = `${cleanOrigin}/auth/callback?next=/update-password`;

        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: redirectUrl,
        });

        if (error) {
            console.error("Supabase Recovery Error:", error);
            if (error.status === 504 || error.message?.includes("504") || error.name === "AuthRetryableFetchError") {
                return {
                    success: false,
                    error: "El servidor de correo de Supabase no respondió a tiempo (Error 504 / SMTP Timeout). Por favor verifica la configuración SMTP en Supabase."
                };
            }
            return { success: false, error: error.message || "Error al solicitar recuperación de contraseña" };
        }

        return { success: true };
    } catch (e: any) {
        console.error("Server Action Error:", e);
        const errMsg = e.message || "";
        if (errMsg.includes("504") || e.status === 504 || e.name === "AuthRetryableFetchError") {
            return {
                success: false,
                error: "El servidor de correo de Supabase no respondió a tiempo (Error 504 / SMTP Timeout). Por favor verifica la configuración SMTP en Supabase."
            };
        }
        return { success: false, error: errMsg || "Error desconocido en el servidor de autenticación" };
    }
}
