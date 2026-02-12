/**
 * Script para ejecutar manualmente la verificación de actividades vencidas
 * y generar notificaciones según las reglas configuradas.
 * 
 * Uso:
 *   npx tsx scripts/check-overdue-activities.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing Supabase credentials');
    console.error('   Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkOverdueActivities() {
    console.log('🔍 Checking for overdue activities...\n');

    try {
        // Call the database function
        const { data, error } = await supabase.rpc('check_overdue_activities');

        if (error) {
            console.error('❌ Error calling check_overdue_activities:', error);
            return;
        }

        console.log('✅ Successfully executed check_overdue_activities()');
        console.log('   Result:', data);

        // Get statistics
        const { data: notifications, error: notifError } = await supabase
            .from('CRM_Notifications')
            .select('*')
            .eq('type', 'ACTIVITY_OVERDUE')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (notifError) {
            console.error('❌ Error fetching notifications:', notifError);
            return;
        }

        console.log(`\n📊 Statistics:`);
        console.log(`   Notifications created in last 24h: ${notifications?.length || 0}`);

        if (notifications && notifications.length > 0) {
            console.log('\n📋 Recent notifications:');
            notifications.forEach((notif, index) => {
                console.log(`   ${index + 1}. ${notif.title} - ${notif.message}`);
            });
        }

    } catch (err) {
        console.error('❌ Unexpected error:', err);
    }
}

// Run the function
checkOverdueActivities()
    .then(() => {
        console.log('\n✨ Done!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Fatal error:', err);
        process.exit(1);
    });
