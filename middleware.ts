import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // Create an authenticated Supabase client for the server environment
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    // Refresh user session if needed
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    // Handle network errors gracefully (offline mode)
    if (userError) {
        console.log("Middleware: getUser error:", userError.message);

        // If it's a network error (offline), allow the request to proceed
        // The app will work in offline mode with cached data
        if (userError.message.includes('Failed to fetch') ||
            userError.message.includes('NetworkError') ||
            userError.name === 'AuthRetryableFetchError') {
            console.log("Middleware: Network error detected, allowing offline access.");
            return response;
        }
    }

    console.log("Middleware Path:", request.nextUrl.pathname, "User:", user?.email || "No User");

    // Protect routes logic
    // If user is NOT logged in and trying to access restricted pages (root, dashboard, etc.)
    // Only redirect if we're sure there's no user (not just a network error)
    if (!user && !userError && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/auth')) {
        console.log("Middleware: Redirecting to /login (no user)");
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // If user IS logged in and tries to access login page
    if (user && request.nextUrl.pathname.startsWith('/login')) {
        console.log("Middleware: Redirecting to / (user already logged in)");
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - icons (PWA icons)
         * - manifest.json (PWA manifest)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)',
    ],
}
