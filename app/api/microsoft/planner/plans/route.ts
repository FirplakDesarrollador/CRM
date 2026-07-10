import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getGroupPlans, getMyPlans, getMicrosoftTokens } from '@/lib/microsoft';

export async function GET(request: NextRequest) {
    const groupId = request.nextUrl.searchParams.get('groupId');

    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value
                    },
                },
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (!user) {
            console.log('[API Planner Plans] No authenticated user found');
            return NextResponse.json({ error: 'Unauthorized', plans: [] }, { status: 401 });
        }

        // Get Microsoft tokens
        const tokens = await getMicrosoftTokens(user.id, supabase);
        if (!tokens || !tokens.access_token) {
            console.log('[API Planner Plans] No Microsoft tokens found');
            return NextResponse.json({ error: 'Microsoft account not connected', plans: [] }, { status: 400 });
        }

        let plans;
        let crmDefaultPlanId: string | null = null;

        if (groupId) {
            console.log('[API Planner Plans] Getting plans for group from Microsoft Graph...');
            plans = await getGroupPlans(tokens.access_token, groupId);
        } else {
            // First: try to find the "CRM Ventas" group and its plan directly
            // This is more reliable than text-matching from a list of 95 plans
            try {
                const groupRes = await fetch(
                    `https://graph.microsoft.com/v1.0/me/memberOf/microsoft.graph.group?$filter=displayName eq 'CRM Ventas'&$select=id,displayName`,
                    { headers: { 'Authorization': `Bearer ${tokens.access_token}` } }
                );
                if (groupRes.ok) {
                    const groupData = await groupRes.json();
                    const crmGroup = groupData.value?.[0];
                    if (crmGroup) {
                        console.log(`[API Planner Plans] Found CRM Ventas group: ${crmGroup.id}`);
                        const crmPlans = await getGroupPlans(tokens.access_token, crmGroup.id);
                        if (crmPlans && crmPlans.length > 0) {
                            crmDefaultPlanId = crmPlans[0].id;
                            console.log(`[API Planner Plans] CRM default plan: ${crmPlans[0].title} (${crmDefaultPlanId})`);
                        }
                    }
                }
            } catch (groupErr) {
                console.warn('[API Planner Plans] Could not resolve CRM Ventas group, falling back to all plans');
            }

            console.log('[API Planner Plans] Getting all user plans from Microsoft Graph...');
            plans = await getMyPlans(tokens.access_token);
        }

        // Mark the CRM default plan so the frontend can auto-select it reliably
        if (crmDefaultPlanId && plans) {
            plans = plans.map((p: any) => ({
                ...p,
                isCrmDefault: p.id === crmDefaultPlanId
            }));
        }

        console.log(`[API Planner Plans] Found ${plans?.length || 0} plans | CRM default: ${crmDefaultPlanId || 'not found'}`);

        return NextResponse.json({ plans });
    } catch (error: any) {
        console.error('[API Planner Plans] Error:', error);
        return NextResponse.json({ error: error.message, plans: [] }, { status: 500 });
    }
}
