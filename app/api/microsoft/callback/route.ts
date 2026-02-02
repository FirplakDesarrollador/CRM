import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, storeMicrosoftTokens } from '@/lib/microsoft';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const userId = searchParams.get('state'); // We passed userId as state
    const error = searchParams.get('error');

    if (error) {
        console.error('[Microsoft Callback] Login error:', error);
        return NextResponse.redirect(new URL('/configuracion?ms_error=' + error, request.url));
    }

    if (!code || !userId) {
        return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    try {
        const tokens = await exchangeCodeForTokens(code);

        // Use server-side client to handle RLS
        const { createClient } = await import('@/lib/supabase/server');
        const supabaseServer = await createClient();

        await storeMicrosoftTokens(userId, tokens, supabaseServer);

        // Redirect back to configuration with success
        return NextResponse.redirect(new URL('/configuracion?ms_sync=success', request.url));
    } catch (err: any) {
        console.error('[Microsoft Callback] Token exchange failed:', err);
        const errorMessage = err.message || 'token_exchange_failed';
        return NextResponse.redirect(new URL(`/configuracion?ms_error=${encodeURIComponent(errorMessage)}`, request.url));
    }
}
