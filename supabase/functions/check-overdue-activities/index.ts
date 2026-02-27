import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Verify the request is authorized (optional but recommended)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Create Supabase client with service role
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        console.log('🔍 Starting overdue activities check...');

        // Call the database function
        const { data, error } = await supabase.rpc('check_overdue_activities');

        if (error) {
            console.error('❌ Error calling check_overdue_activities:', error);
            return new Response(
                JSON.stringify({
                    success: false,
                    error: error.message,
                    details: error
                }),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            );
        }

        // Get statistics about notifications created
        const { data: notifications, error: notifError } = await supabase
            .from('CRM_Notifications')
            .select('id, title, message, created_at')
            .eq('type', 'ACTIVITY_OVERDUE')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (notifError) {
            console.warn('⚠️ Could not fetch notification stats:', notifError);
        }

        const stats = {
            executedAt: new Date().toISOString(),
            notificationsCreatedLast24h: notifications?.length || 0,
            recentNotifications: notifications?.slice(0, 5) || []
        };

        console.log('✅ Check completed successfully');
        console.log('📊 Stats:', stats);

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Overdue activities check completed',
                stats
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );

    } catch (error) {
        console.error('❌ Unexpected error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message || 'Unknown error'
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
});
