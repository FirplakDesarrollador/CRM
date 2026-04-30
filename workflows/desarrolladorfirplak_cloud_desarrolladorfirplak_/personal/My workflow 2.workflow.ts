import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : My workflow 2
// Nodes   : 1  |  Connections: 0
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WhenClickingexecuteWorkflow        manualTrigger
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'sA6P3n599eZ9P9OC',
    name: 'My workflow 2',
    active: false,
    settings: { executionOrder: 'v1', binaryMode: 'separate', availableInMCP: false },
})
export class MyWorkflow2Workflow {
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

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        // No connections defined
    }
}
