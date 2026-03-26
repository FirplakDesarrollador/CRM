import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getMicrosoftTokens, searchMicrosoftUsers } from '@/lib/microsoft';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');

    console.log('[API Users] Request received, query:', query);

    if (!query) {
        return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
    }

    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value
                    },
                },
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        console.log('[API Users] Auth result - User:', user?.email, '| Error:', authError?.message || 'none');

        if (!user) {
            console.log('[API Users] No authenticated user found');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[API Users] Getting Microsoft tokens for user:', user.id);
        const tokens = await getMicrosoftTokens(user.id, supabase);

        if (!tokens || !tokens.access_token) {
            console.log('[API Users] No Microsoft tokens found');
            return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 400 });
        }

        console.log('[API Users] Tokens obtained, searching users...');
        const users = await searchMicrosoftUsers(tokens.access_token, query);
        console.log(`[API Users] Search complete. Found ${users?.length || 0} users for query: ${query}`);

        return NextResponse.json(users || []);
    } catch (error: any) {
        console.error('[API Users] Full error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

