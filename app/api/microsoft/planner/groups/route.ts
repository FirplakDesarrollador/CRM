import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getMyGroups, getMicrosoftTokens } from '@/lib/microsoft';

export async function GET(request: NextRequest) {
    console.log('[API Planner Groups] Request received');

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

        console.log('[API Planner Groups] Auth result - User:', user?.email, '| Error:', authError?.message || 'none');

        if (!user) {
            console.log('[API Planner Groups] No authenticated user found');
            return NextResponse.json({ error: 'Unauthorized', groups: [] }, { status: 401 });
        }

        // Get Microsoft tokens
        const tokens = await getMicrosoftTokens(user.id, supabase);
        if (!tokens || !tokens.access_token) {
            console.log('[API Planner Groups] No Microsoft tokens found');
            return NextResponse.json({ error: 'Microsoft account not connected', groups: [] }, { status: 400 });
        }

        console.log('[API Planner Groups] Getting groups from Microsoft Graph...');
        const groups = await getMyGroups(tokens.access_token);
        console.log(`[API Planner Groups] Found ${groups?.length || 0} groups`);

        return NextResponse.json({ groups });
    } catch (error: any) {
        console.error('[API Planner Groups] Error:', error);
        return NextResponse.json({ error: error.message, groups: [] }, { status: 500 });
    }
}
