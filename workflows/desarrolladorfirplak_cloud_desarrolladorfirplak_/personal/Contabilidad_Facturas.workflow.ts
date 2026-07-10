import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Contabilidad_Facturas
// Nodes   : 3  |  Connections: 2
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WhenClickingexecuteWorkflow        manualTrigger
// GetManyRows                        supabase                   [creds]
// GetManyItems                       microsoftSharePoint        [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenClickingexecuteWorkflow
//    → GetManyRows
//      → GetManyItems
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'KHpQsGxJ3FoT3uR8',
    name: 'Contabilidad_Facturas',
    active: false,
    settings: { executionOrder: 'v1', binaryMode: 'separate', availableInMCP: false },
})
export class ContabilidadFacturasWorkflow {
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
        name: 'Get many rows',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [208, 0],
        credentials: { supabaseApi: { id: 'w4rHU3PbY6fjFl7W', name: 'Contabilidad' } },
    })
    GetManyRows = {
        operation: 'getAll',
        tableId: 'Registro_Facturas',
        returnAll: true,
    };

    @node({
        name: 'Get many items',
        type: 'n8n-nodes-base.microsoftSharePoint',
        version: 1,
        position: [416, 0],
        credentials: {
            microsoftSharePointOAuth2Api: { id: 'fM3DdGR1CIM1Sggp', name: 'Microsoft SharePoint account 2' },
        },
    })
    GetManyItems = {
        resource: 'item',
        site: {
            __rl: true,
            mode: 'list',
            value: '',
        },
        options: {},
        requestOptions: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenClickingexecuteWorkflow.out(0).to(this.GetManyRows.in(0));
        this.GetManyRows.out(0).to(this.GetManyItems.in(0));
    }
}
