/**
 * Script para verificar el estado del cron job de actividades vencidas
 * 
 * Uso:
 *   npx tsx scripts/check-cron-status.ts
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

async function checkCronStatus() {
    console.log('🔍 Checking cron job status...\n');

    try {
        // Get cron job configuration
        const { data: jobStatus, error: statusError } = await supabase
            .rpc('get_cron_job_status');

        if (statusError) {
            console.error('❌ Error fetching cron job status:', statusError);
            return;
        }

        if (!jobStatus || jobStatus.length === 0) {
            console.log('⚠️  No cron job found for overdue activities');
            console.log('   Run the setup migration to create the cron job');
            return;
        }

        const job = jobStatus[0];
        console.log('📋 Cron Job Configuration:');
        console.log('   Job ID:', job.jobid);
        console.log('   Name:', job.jobname);
        console.log('   Schedule:', job.schedule);
        console.log('   Active:', job.active ? '✅ Yes' : '❌ No');
        console.log('   Command:', job.command);
        console.log('   Database:', job.database);
        console.log('   Username:', job.username);

        // Get execution history
        const { data: history, error: historyError } = await supabase
            .from('cron_job_run_history')
            .select('*')
            .limit(10);

        if (historyError) {
            console.warn('\n⚠️  Could not fetch execution history:', historyError);
        } else if (history && history.length > 0) {
            console.log('\n📊 Recent Executions (last 10):');
            history.forEach((run, index) => {
                const status = run.status === 'succeeded' ? '✅' : '❌';
                const duration = run.end_time && run.start_time
                    ? `${Math.round((new Date(run.end_time).getTime() - new Date(run.start_time).getTime()) / 1000)}s`
                    : 'N/A';

                console.log(`\n   ${index + 1}. ${status} Run ID: ${run.runid}`);
                console.log(`      Started: ${new Date(run.start_time).toLocaleString()}`);
                console.log(`      Status: ${run.status}`);
                console.log(`      Duration: ${duration}`);
                if (run.return_message) {
                    console.log(`      Message: ${run.return_message}`);
                }
            });
        } else {
            console.log('\n📊 No execution history found yet');
            console.log('   The cron job will run according to its schedule');
        }

        // Get recent notifications
        const { data: notifications, error: notifError } = await supabase
            .from('CRM_Notifications')
            .select('id, title, message, created_at, is_read')
            .eq('type', 'ACTIVITY_OVERDUE')
            .order('created_at', { ascending: false })
            .limit(5);

        if (notifError) {
            console.warn('\n⚠️  Could not fetch recent notifications:', notifError);
        } else if (notifications && notifications.length > 0) {
            console.log('\n🔔 Recent Notifications (last 5):');
            notifications.forEach((notif, index) => {
                const readStatus = notif.is_read ? '📖 Read' : '🔵 Unread';
                console.log(`\n   ${index + 1}. ${readStatus}`);
                console.log(`      ${notif.title}`);
                console.log(`      ${notif.message}`);
                console.log(`      Created: ${new Date(notif.created_at).toLocaleString()}`);
            });
        } else {
            console.log('\n🔔 No notifications created yet');
        }

    } catch (err) {
        console.error('❌ Unexpected error:', err);
    }
}

// Run the function
checkCronStatus()
    .then(() => {
        console.log('\n✨ Done!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Fatal error:', err);
        process.exit(1);
    });
