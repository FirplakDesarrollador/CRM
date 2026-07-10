import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : VIBEWORKFLOW - Blog Image Generator
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
    id: 'szsndAgQZM0AFfC6',
    name: 'VIBEWORKFLOW - Blog Image Generator',
    active: false,
    settings: { executionOrder: 'v1', availableInMCP: true },
})
export class VibeworkflowBlogImageGeneratorWorkflow {
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
