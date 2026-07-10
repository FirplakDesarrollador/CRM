import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : CRM Opportunity Notifications
// Nodes   : 3  |  Connections: 2
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// SupabaseNewRecordTrigger           webhook
// GetARow                            supabase                   [creds]
// CreateChatMessage                  microsoftTeams             [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// SupabaseNewRecordTrigger
//    → GetARow
//      → CreateChatMessage
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'zzOvvl9aPB7ryB25',
    name: 'CRM Opportunity Notifications',
    active: true,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class CrmOpportunityNotificationsWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        name: 'Supabase New Record Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [576, 288],
    })
    SupabaseNewRecordTrigger = {
        httpMethod: 'POST',
        path: 'supabase-new-record',
        options: {
            responseCode: {
                values: {},
            },
        },
    };

    @node({
        name: 'Get a row',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [864, 288],
        credentials: { supabaseApi: { id: 'mQUs9m2a6xzm7cgP', name: 'Supabase account' } },
    })
    GetARow = {
        operation: 'get',
        tableId: 'CRM_Usuarios',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    keyValue: '={{ $json.body.record.owner_user_id }}',
                },
            ],
        },
    };

    @node({
        name: 'Create chat message',
        type: 'n8n-nodes-base.microsoftTeams',
        version: 2,
        position: [1184, 288],
        credentials: { microsoftTeamsOAuth2Api: { id: 'JPxCFagUUPmk1HBe', name: 'Microsoft Teams account' } },
    })
    CreateChatMessage = {
        resource: 'chatMessage',
        chatId: {
            __rl: true,
            value: '19:1dc8619c4bbc4e508c2e586b4ea2a65c@thread.v2',
            mode: 'list',
            cachedResultName: 'Desarrollo de CRM FPK (group)',
            cachedResultUrl:
                'https://teams.microsoft.com/l/chat/19%3A1dc8619c4bbc4e508c2e586b4ea2a65c%40thread.v2/0?tenantId=fa1de04f-4780-4d83-a942-93c7ae8dee9d',
        },
        message:
            "={{ $json.full_name }} creo una nueva oportunidad:\n\n{{ $('Supabase New Record Trigger').item.json.body.record.nombre }}",
        options: {
            includeLinkToWorkflow: true,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.SupabaseNewRecordTrigger.out(0).to(this.GetARow.in(0));
        this.GetARow.out(0).to(this.CreateChatMessage.in(0));
    }
}
