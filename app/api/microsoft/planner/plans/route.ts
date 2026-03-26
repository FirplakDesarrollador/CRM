import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getGroupPlans, getMyPlans, getMicrosoftTokens } from '@/lib/microsoft';

export async function GET(request: NextRequest) {
    const groupId = request.nextUrl.searchParams.get('groupId');

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

        if (!user) {
            console.log('[API Planner Plans] No authenticated user found');
            return NextResponse.json({ error: 'Unauthorized', plans: [] }, { status: 401 });
        }

        // Get Microsoft tokens
        const tokens = await getMicrosoftTokens(user.id, supabase);
        if (!tokens || !tokens.access_token) {
            console.log('[API Planner Plans] No Microsoft tokens found');
            return NextResponse.json({ error: 'Microsoft account not connected', plans: [] }, { status: 400 });
        }

        let plans;
        if (groupId) {
            console.log('[API Planner Plans] Getting plans for group from Microsoft Graph...');
            plans = await getGroupPlans(tokens.access_token, groupId);
        } else {
            console.log('[API Planner Plans] Getting all user plans from Microsoft Graph...');
            plans = await getMyPlans(tokens.access_token);
        }

        console.log(`[API Planner Plans] Found ${plans?.length || 0} plans`);

        return NextResponse.json({ plans });
    } catch (error: any) {
        console.error('[API Planner Plans] Error:', error);
        return NextResponse.json({ error: error.message, plans: [] }, { status: 500 });
    }
}
