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

    // Try to get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    console.log("[Middleware]", pathname, "| User:", user?.email || "NONE", "| Error:", userError?.message || "OK");

    // Handle network errors (offline mode) - Allow access if has cookies
    if (userError && isNetworkError(userError)) {
        console.log("[Middleware] Network error - checking local session cookies");

        const hasSession = hasLocalSession(request);
        if (hasSession) {
            console.log("[Middleware] Offline mode allowed - has local session cookies");
            return response;
        }

        // No cookies, redirect to login
        console.log("[Middleware] No local session, redirecting to /login");
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // NO USER = NOT AUTHENTICATED (regardless of cookies)
    // This is the key fix: if getUser() returns null, the session is invalid
    if (!user) {
        console.log("[Middleware] No valid user session, redirecting to /login");

        // Clear any stale auth cookies to prevent loops
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
