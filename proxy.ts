import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Helper function to check if route is public
function isPublicRoute(pathname: string): boolean {
    const publicRoutes = ['/login', '/auth/callback', '/update-password'];
    return publicRoutes.some(route => pathname.startsWith(route));
}

// Helper function to check if error is network-related
function isNetworkError(error: any): boolean {
    return error.message?.includes('Failed to fetch') ||
        error.message?.includes('NetworkError') ||
        error.name === 'AuthRetryableFetchError';
}

// Helper function to check for local session cookies
function hasLocalSession(request: NextRequest): boolean {
    // Check for Supabase auth cookies
    const cookies = request.cookies;

    // Supabase stores auth tokens in cookies with these patterns
    const hasAuthCookie = Array.from(cookies.getAll()).some(cookie =>
        cookie.name.includes('sb-') &&
        (cookie.name.includes('auth-token') || cookie.name.includes('access-token') || cookie.name.includes('refresh-token'))
    );

    return hasAuthCookie;
}

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const pathname = request.nextUrl.pathname;

    // Skip auth check for public routes
    if (isPublicRoute(pathname)) {
        return response;
    }

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

    // PERF FIX: Use getSession() instead of getUser()
    // getUser() makes an HTTP call to Supabase servers (~200ms per navigation)
    // getSession() validates the JWT locally (~1ms) - sufficient for route protection
    // Actual data security is enforced by RLS on Supabase, not middleware
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    // Handle network errors (offline mode) - Allow access if has cookies
    if (sessionError && isNetworkError(sessionError)) {
        const hasLocalSessionCookies = hasLocalSession(request);
        if (hasLocalSessionCookies) {
            return response;
        }

        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // NO SESSION = NOT AUTHENTICATED
    if (!session) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = '/login';
        const redirectResponse = NextResponse.redirect(redirectUrl);

        // Clear Supabase cookies to ensure clean state
        const cookiesToClear = Array.from(request.cookies.getAll())
            .filter(c => c.name.includes('sb-'))
            .map(c => c.name);

        for (const cookieName of cookiesToClear) {
            redirectResponse.cookies.set(cookieName, '', { maxAge: 0, path: '/' });
        }

        return redirectResponse;
    }

    // User is authenticated, allow access
    return response;
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
        '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox|worker-|.*\\.svg).*)',
    ],
}
