import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMicrosoftTokens, searchMicrosoftUsers } from '@/lib/microsoft';

type MicrosoftDirectoryUser = {
    id: string;
    displayName: string;
    mail: string | null;
    userPrincipalName: string;
    jobTitle: string;
};

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');

    console.log('[API Users] Request received, query:', query);

    if (!query) {
        return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
    }

    try {
        // Inicializar cliente Supabase Server con soporte robusto de cookies y headers
        const supabase = await createClient();

        let user = null;
        const authHeader = req.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.replace('Bearer ', '').trim();
            try {
                const { data } = await supabase.auth.getUser(token);
                user = data?.user || null;
            } catch {
                // Ignore token error and fallback to cookies
            }
        }

        if (!user) {
            try {
                const { data } = await supabase.auth.getUser();
                user = data?.user || null;
            } catch (err: unknown) {
                console.log('[API Users] Auth getUser error:', err instanceof Error ? err.message : err);
            }
        }

        console.log('[API Users] Auth result - User:', user?.email || 'unauthenticated/anon');

        let tokens = null;
        if (user?.id) {
            console.log('[API Users] Getting Microsoft tokens for user:', user.id);
            tokens = await getMicrosoftTokens(user.id, supabase);
        }

        // Fallback: Si el usuario actual no ha conectado Microsoft o expiró,
        // intentar con cualquier token válido del tenant Firplak para resolver el directorio
        if (!tokens || !tokens.access_token) {
            console.log('[API Users] No personal token found, trying tenant pool...');
            const { data: tokenRows } = await supabase
                .from('CRM_MicrosoftTokens')
                .select('user_id')
                .order('updated_at', { ascending: false })
                .limit(5);

            if (tokenRows && tokenRows.length > 0) {
                for (const row of tokenRows) {
                    try {
                        const candidate = await getMicrosoftTokens(row.user_id, supabase);
                        if (candidate && candidate.access_token) {
                            tokens = candidate;
                            console.log('[API Users] Using tenant candidate token from:', row.user_id);
                            break;
                        }
                    } catch {
                        // ignore and try next candidate
                    }
                }
            }
        }

        let users: MicrosoftDirectoryUser[] = [];
        if (tokens && tokens.access_token) {
            console.log('[API Users] Tokens obtained, searching users via Microsoft Graph...');
            try {
                users = await searchMicrosoftUsers(tokens.access_token, query);
            } catch (err) {
                console.warn('[API Users] Graph search error:', err);
            }
        }

        // Resilient Fallback: Si Microsoft Graph no arrojó resultados o no hubo token disponible,
        // consultar los colaboradores activos de CRM_Usuarios
        if (!users || users.length === 0) {
            console.log('[API Users] Fallback: Searching CRM_Usuarios for query:', query);
            const { data: crmUsers } = await supabase
                .from('CRM_Usuarios')
                .select('id, full_name, email, role')
                .eq('is_active', true)
                .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
                .limit(15);

            if (crmUsers && crmUsers.length > 0) {
                users = crmUsers.map(u => ({
                    id: u.id,
                    displayName: u.full_name || u.email,
                    mail: u.email,
                    userPrincipalName: u.email,
                    jobTitle: u.role || 'Usuario CRM'
                }));
            }
        }

        console.log(`[API Users] Search complete. Returning ${users.length} users for query: ${query}`);
        return NextResponse.json(users);
    } catch (error: unknown) {
        console.error('[API Users] Full error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}

