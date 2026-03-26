import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPlanBuckets, getMicrosoftTokens } from '@/lib/microsoft';

export async function GET(request: NextRequest) {
    const planId = request.nextUrl.searchParams.get('planId');
    console.log('[API Planner Buckets] Request received, planId:', planId);

    if (!planId) {
        return NextResponse.json({ error: 'planId is required', buckets: [] }, { status: 400 });
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

        if (!user) {
            console.log('[API Planner Buckets] No authenticated user found');
            return NextResponse.json({ error: 'Unauthorized', buckets: [] }, { status: 401 });
        }

        // Get Microsoft tokens
        const tokens = await getMicrosoftTokens(user.id, supabase);
        if (!tokens || !tokens.access_token) {
            console.log('[API Planner Buckets] No Microsoft tokens found');
            return NextResponse.json({ error: 'Microsoft account not connected', buckets: [] }, { status: 400 });
        }

        console.log('[API Planner Buckets] Getting buckets from Microsoft Graph...');
        const buckets = await getPlanBuckets(tokens.access_token, planId);
        console.log(`[API Planner Buckets] Found ${buckets?.length || 0} buckets`);

        return NextResponse.json({ buckets });
    } catch (error: any) {
        console.error('[API Planner Buckets] Error:', error);
        return NextResponse.json({ error: error.message, buckets: [] }, { status: 500 });
    }
}
