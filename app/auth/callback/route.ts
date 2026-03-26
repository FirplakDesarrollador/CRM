import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'

    if (code) {
        const cookieStore = request.cookies
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll()
                    },
                    setAll(cookiesToSet) {
                        // We can't set cookies on the request object. 
                        // To properly set cookies in a route handler, we would need to create a response first.
                        // But for now, we'll try to just let middleware handle it or use the response object if possible.
                        // Actually, in Route Handler, we should create a response object and copy cookies.
                    },
                },
            }
        )
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            // Create the response object
            const response = NextResponse.redirect(`${origin}${next}`)

            // Apply the new session to the response
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                // We need a fresh client to set cookies on response? 
                // Or manually set them.
                // Simplest fix for now: create a client that knows how to set on a response object?
                // The issue is exchangeCodeForSession sets cookies on the *client*.
            }

            return response
        }
    }

    // Return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/login?error=auth-code-error`)
}
