import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getMicrosoftTokens, getPlannerTaskDetails } from '@/lib/microsoft';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;
    console.log('[API Planner Task GET] Request received, taskId:', taskId);

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

        console.log('[API Planner Task GET] Auth result - User:', user?.email, '| Error:', authError?.message || 'none');

        if (authError || !user) {
            console.log('[API Planner Task GET] No authenticated user found');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tokens = await getMicrosoftTokens(user.id, supabase);
        if (!tokens || !tokens.access_token) {
            console.log('[API Planner Task GET] No Microsoft tokens found');
            return NextResponse.json({ error: 'Microsoft account not linked' }, { status: 403 });
        }

        console.log('[API Planner Task GET] Getting task details from Microsoft Graph...');
        const task = await getPlannerTaskDetails(tokens.access_token, taskId);

        return NextResponse.json(task);

    } catch (error: any) {
        console.error('[API Planner Task GET] Error:', error);

        if (error.message?.includes('404')) {
            return NextResponse.json({ error: 'Task not found in Planner' }, { status: 404 });
        }

        return NextResponse.json(
            { error: error?.message || 'Internal server error while fetching task' },
            { status: 500 }
        );
    }
}
