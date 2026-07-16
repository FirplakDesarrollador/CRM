"use server";

import { createClient } from "@/lib/supabase/server";

export async function registrarFeria(formData: FormData) {
    const supabase = await createClient();

    // Obtener el usuario autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return { success: false, error: "Usuario no autenticado." };
    }

    const data = {
        nombre_contacto: formData.get("nombre_contacto") as string,
        nombre_cuenta: formData.get("nombre_cuenta") as string,
        telefono: formData.get("telefono") as string,
        email: formData.get("email") as string,
        zona: formData.get("zona") as string,
        categoria: formData.get("categoria") as string,
        canal_venta: formData.get("canal_venta") as string,
        fecha_cierre: formData.get("fecha_cierre") ? formData.get("fecha_cierre") as string : null,
        comentarios: formData.get("comentarios") as string,
        created_by: user.id, // el usuario quien lo crea (auth.users id)
    };

    const { error } = await supabase
        .from("CRM_Ferias")
        .insert([data]);

    if (error) {
        console.error("Error al registrar feria:", error);
        return { success: false, error: error.message };
    }

    return { success: true };
}
