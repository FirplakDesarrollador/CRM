"use server";

import { createClient } from "@supabase/supabase-js";

export async function recoverPasswordAction(email: string, origin: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Initialize a fresh client on the server to ensure clean state
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${origin}/auth/callback?next=/update-password`,
        });

        if (error) {
            console.error("Supabase Recovery Error:", error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (e: any) {
        console.error("Server Action Error:", e);
        return { success: false, error: e.message || "Error desconocido en el servidor" };
    }
}
