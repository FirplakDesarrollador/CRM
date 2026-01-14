import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log("Supabase URL (Browser Client):", supabaseUrl);

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Persist session in localStorage for offline access
        persistSession: true,
        // Auto-refresh will still run but we'll handle errors gracefully
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
    global: {
        // Custom fetch that doesn't throw on network errors
        fetch: async (url, options) => {
            try {
                return await fetch(url, options);
            } catch (err: any) {
                // If offline, return a fake response to prevent crashes
                if (!navigator.onLine || err.message?.includes('Failed to fetch')) {
                    console.warn('[Supabase] Offline - suppressing network error');
                    return new Response(JSON.stringify({ error: 'offline' }), {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                throw err;
            }
        }
    }
});

// Listen to auth state changes and suppress errors when offline
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') {
        console.log('[Supabase] Token refreshed successfully');
    } else if (event === 'SIGNED_OUT' && !navigator.onLine) {
        // Prevent logout when offline (this is a network error, not a real logout)
        console.warn('[Supabase] Ignoring SIGNED_OUT event while offline');
    }
});
