import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getMicrosoftTokens, createMicrosoftEvent } from '@/lib/microsoft';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { subject, description, start, end, attendees, isOnlineMeeting } = body;

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

        const event = await createMicrosoftEvent(tokens.access_token, {
            subject,
            body: description,
            start,
            end,
            attendees,
            isOnlineMeeting
        });

        return NextResponse.json(event);
    } catch (error: any) {
        console.error('[API Create Event] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
