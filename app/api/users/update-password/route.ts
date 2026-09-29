import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { userId, newPassword } = await request.json();

        if (!userId || !newPassword) {
            return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
        }

        const cookieStore = cookies();
        const userClient = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll() },
                    setAll() {}
                }
            }
        );

        // Verify that the caller is an ADMIN
        const { data: { session } } = await userClient.auth.getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { data: profile } = await userClient
            .from('CRM_Usuarios')
            .select('role')
            .eq('id', session.user.id)
            .single();

        if (profile?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Solo los administradores pueden cambiar contraseñas de otros usuarios' }, { status: 403 });
        }

        // We MUST use the service role key to change another user's password
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
            return NextResponse.json({ error: 'Falta la clave de servicio (SUPABASE_SERVICE_ROLE_KEY) en el servidor' }, { status: 500 });
        }

        const adminAuthClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        const { data, error } = await adminAuthClient.auth.admin.updateUserById(
            userId,
            { password: newPassword }
        );

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true, user: data.user });
    } catch (error: any) {
        console.error('Error in update-password route:', error);
        return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
    }
}
