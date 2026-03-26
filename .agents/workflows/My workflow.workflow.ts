import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : My workflow
// Nodes   : 4  |  Connections: 1
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WhenClickingexecuteWorkflow        manualTrigger
// CreateChatMessage                  microsoftTeams             [creds]
// Opor                               mySql                      [creds]
// Opor1                              mySql                      [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenClickingexecuteWorkflow
//    → CreateChatMessage
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: '5kJw0qHrFghdybVp',
    name: 'My workflow',
    active: false,
    settings: { executionOrder: 'v1', binaryMode: 'separate', availableInMCP: false },
})
export class MyWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        name: 'When clicking ‘Execute workflow’',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [0, 0],
    })
    WhenClickingexecuteWorkflow = {};

    @node({
        name: 'Create chat message',
        type: 'n8n-nodes-base.microsoftTeams',
        version: 2,
        position: [208, 0],
        credentials: { microsoftTeamsOAuth2Api: { id: '0Zm87fjGEBcj3jz1', name: 'Microsoft Teams account 2' } },
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
        message: 'esto es una prueba de desarrollo',
        options: {},
    };

    @node({
        name: 'Opor',
        type: 'n8n-nodes-base.mySql',
        version: 2.5,
        position: [0, 208],
        credentials: { mySql: { id: 'MxoNNWdlZ63uD2EA', name: 'MySQL account' } },
    })
    Opor = {
        operation: 'select',
        table: {
            __rl: true,
            value: 'vtiger_relcriteria_grouping',
            mode: 'list',
        },
        options: {},
    };

    @node({
        name: 'Opor1',
        type: 'n8n-nodes-base.mySql',
        version: 2.5,
        position: [0, 416],
        credentials: { mySql: { id: 'MxoNNWdlZ63uD2EA', name: 'MySQL account' } },
    })
    Opor1 = {
        operation: 'select',
        table: {
            __rl: true,
            value: 'vtiger_relcriteria_grouping',
            mode: 'list',
        },
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenClickingexecuteWorkflow.out(0).to(this.CreateChatMessage.in(0));
    }
}
