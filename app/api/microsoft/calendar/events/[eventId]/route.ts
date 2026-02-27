import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getMicrosoftTokens, getMicrosoftEvent, updateMicrosoftEvent, deleteMicrosoftEvent } from '@/lib/microsoft';

export async function GET(req: NextRequest, { params }: { params: { eventId: string } }) {
    try {
        const { eventId } = params;

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

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tokens = await getMicrosoftTokens(user.id, supabase);
        if (!tokens || !tokens.access_token) {
            return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 400 });
        }

        const event = await getMicrosoftEvent(tokens.access_token, eventId);
        return NextResponse.json(event);
    } catch (error: any) {
        console.error('[API Get Event] Error:', error);
        if (error.status === 404) {
            return NextResponse.json({ error: 'Event not found in Outlook' }, { status: 404 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: { eventId: string } }) {
    try {
        const { eventId } = params;
        const body = await req.json();

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

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tokens = await getMicrosoftTokens(user.id, supabase);
        if (!tokens || !tokens.access_token) {
            return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 400 });
        }

        const event = await updateMicrosoftEvent(tokens.access_token, eventId, body);
        return NextResponse.json(event);
    } catch (error: any) {
        console.error('[API Update Event] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { eventId: string } }) {
    try {
        const { eventId } = params;

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

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tokens = await getMicrosoftTokens(user.id, supabase);
        if (!tokens || !tokens.access_token) {
            return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 400 });
        }

        await deleteMicrosoftEvent(tokens.access_token, eventId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API Delete Event] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
