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

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const pathname = request.nextUrl.pathname;

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

    console.log("Middleware Path:", pathname, "User:", user?.email || "No User", "Error:", userError?.message || "None");

    // Handle network errors (offline mode)
    if (userError && isNetworkError(userError)) {
        console.log("Middleware: Network error detected (offline mode)");

        // Check if there's a local session
        const hasSession = hasLocalSession(request);

        if (!hasSession && !isPublicRoute(pathname)) {
            // No local session and trying to access protected route
            console.log("Middleware: No local session, redirecting to /login");
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            return NextResponse.redirect(url);
        }

        // Has local session or is public route, allow access
        console.log("Middleware: Local session found or public route, allowing offline access");
        return response;
    }

    // If there's a non-network error, treat as no user
    if (userError && !isNetworkError(userError)) {
        console.log("Middleware: Auth error (not network):", userError.message);
    }

    // Protect routes: redirect to login if no user and not on public route
    if (!user && !isPublicRoute(pathname)) {
        console.log("Middleware: No user, redirecting to /login");
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // If user is logged in and tries to access login page, redirect to home
    if (user && pathname === '/login') {
        console.log("Middleware: User already logged in, redirecting to /");
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
    }

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
        '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox|worker-).*)',
    ],
}
