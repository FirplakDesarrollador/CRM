import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getMicrosoftTokens, findMicrosoftEvent } from '@/lib/microsoft';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const subject = searchParams.get('subject');
        const startTime = searchParams.get('startTime');

        if (!subject || !startTime) {
            return NextResponse.json({ error: 'Subject and startTime are required' }, { status: 400 });
        }

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

        const event = await findMicrosoftEvent(tokens.access_token, subject, startTime);
        return NextResponse.json({ event });
    } catch (error: any) {
        console.error('[API Search Event] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
