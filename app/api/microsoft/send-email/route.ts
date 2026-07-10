import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendMicrosoftEmail, getMicrosoftTokens } from '@/lib/microsoft';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { toRecipients, subject, emailBody, attachment } = body;

        if (!toRecipients || !toRecipients.length || !subject || !emailBody) {
            return NextResponse.json(
                { error: 'toRecipients, subject, and emailBody are required' },
                { status: 400 }
            );
        }

        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tokens = await getMicrosoftTokens(user.id, supabase);
        if (!tokens || !tokens.access_token) {
            return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 400 });
        }

        await sendMicrosoftEmail(tokens.access_token, {
            toRecipients,
            subject,
            body: emailBody,
            attachment
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API Send Email] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
