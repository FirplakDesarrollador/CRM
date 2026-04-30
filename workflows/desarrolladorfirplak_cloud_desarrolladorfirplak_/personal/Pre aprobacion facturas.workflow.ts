import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Pre aprobacion facturas
// Nodes   : 0  |  Connections: 0
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: '1PDjopQOagKJLyWf',
    name: 'Pre aprobacion facturas',
    active: false,
    settings: { executionOrder: 'v1', binaryMode: 'separate', availableInMCP: true },
})
export class PreAprobacionFacturasWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        // No connections defined
    }
}
