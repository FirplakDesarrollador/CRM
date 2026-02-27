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

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;
    console.log('[API Planner Task DELETE] Request received, taskId:', taskId);

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

        if (authError || !user) {
            console.log('[API Planner Task DELETE] No authenticated user found');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tokens = await getMicrosoftTokens(user.id, supabase);
        if (!tokens || !tokens.access_token) {
            console.log('[API Planner Task DELETE] No Microsoft tokens found');
            return NextResponse.json({ error: 'Microsoft account not linked' }, { status: 403 });
        }

        const { deletePlannerTask } = await import('@/lib/microsoft');
        console.log('[API Planner Task DELETE] Deleting task from Microsoft Graph...');
        await deletePlannerTask(tokens.access_token, taskId);

        return NextResponse.json({ success: true, message: 'Planner task deleted successfully' });

    } catch (error: any) {
        console.error('[API Planner Task DELETE] Error:', error);

        if (error.message?.includes('404')) {
            return NextResponse.json({ error: 'Task not found in Planner' }, { status: 404 });
        }

        return NextResponse.json(
            { error: error?.message || 'Internal server error while deleting task' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;
    console.log('[API Planner Task PATCH] Request received, taskId:', taskId);

    try {
        const updateBody = await request.json();

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

        if (authError || !user) {
            console.log('[API Planner Task PATCH] No authenticated user found');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tokens = await getMicrosoftTokens(user.id, supabase);
        if (!tokens || !tokens.access_token) {
            console.log('[API Planner Task PATCH] No Microsoft tokens found');
            return NextResponse.json({ error: 'Microsoft account not linked' }, { status: 403 });
        }

        const { updatePlannerTask } = await import('@/lib/microsoft');
        console.log('[API Planner Task PATCH] Updating task in Microsoft Graph...', updateBody);
        const updatedTask = await updatePlannerTask(tokens.access_token, taskId, updateBody);

        return NextResponse.json({ success: true, task: updatedTask });

    } catch (error: any) {
        console.error('[API Planner Task PATCH] Error:', error);

        if (error.message?.includes('404')) {
            return NextResponse.json({ error: 'Task not found in Planner' }, { status: 404 });
        }

        return NextResponse.json(
            { error: error?.message || 'Internal server error while updating task' },
            { status: 500 }
        );
    }
}
