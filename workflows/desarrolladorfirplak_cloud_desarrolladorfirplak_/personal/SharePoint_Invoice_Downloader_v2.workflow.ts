import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SharePoint_Invoice_Downloader_v2
// Nodes   : 6  |  Connections: 5
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// Webhook                            webhook
// Search                             microsoftSharePoint        [creds]
// List                               microsoftSharePoint        [creds]
// Filter                             filter
// Download                           microsoftSharePoint        [creds]
// RespondToWebhook                   webhook_response
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Webhook
//    → Search
//      → List
//        → Filter
//          → Download
//            → RespondToWebhook
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'pyvNX3ifqgmOjibZ',
    name: 'SharePoint_Invoice_Downloader_v2',
    active: false,
    settings: {
        executionOrder: 'v1',
        saveDataErrorExecution: 'all',
        saveDataSuccessExecution: 'all',
        saveManualExecutions: true,
        saveExecutionProgress: true,
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
    },
})
export class SharepointInvoiceDownloaderV2Workflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        version: 1,
        position: [0, 0],
    })
    Webhook = {
        httpMethod: 'POST',
        path: 'descargar-factura-v2',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        name: 'Search',
        type: 'n8n-nodes-base.microsoftSharePoint',
        version: 1,
        position: [208, 0],
        credentials: {
            microsoftSharePointOAuth2Api: { id: 'DgHHFDKm5tIHi1oE', name: 'Microsoft SharePoint account 4' },
        },
    })
    Search = {
        resource: 'item',
        operation: 'search',
        requestOptions: {},
    };

    @node({
        name: 'List',
        type: 'n8n-nodes-base.microsoftSharePoint',
        version: 1,
        position: [400, 0],
        credentials: {
            microsoftSharePointOAuth2Api: { id: 'DgHHFDKm5tIHi1oE', name: 'Microsoft SharePoint account 4' },
        },
    })
    List = {
        resource: 'item',
        site: {
            __rl: true,
            mode: 'id',
            value: 'ITPowerApps',
        },
        list: {
            __rl: true,
            mode: 'list',
            value: '',
        },
        options: {},
        requestOptions: {},
    };

    @node({
        name: 'Filter',
        type: 'n8n-nodes-base.filter',
        version: 1,
        position: [608, 0],
    })
    Filter = {
        conditions: {
            string: [{}],
        },
    };

    @node({
        name: 'Download',
        type: 'n8n-nodes-base.microsoftSharePoint',
        version: 1,
        position: [800, 0],
        credentials: {
            microsoftSharePointOAuth2Api: { id: 'W2okzu0uedfATuIo', name: 'Microsoft SharePoint account 3' },
        },
    })
    Download = {
        site: {
            __rl: true,
            mode: 'id',
            value: 'ITPowerApps',
        },
        folder: {
            __rl: true,
            mode: 'list',
            value: '',
        },
        requestOptions: {},
    };

    @node({
        name: 'Respond to Webhook',
        type: 'n8n-nodes-base.webhook_response',
        version: 1,
        position: [1008, 0],
    })
    RespondToWebhook = {
        options: {
            responseBody: '={{ $binary.data }}',
            responseContentType: 'application/pdf',
        },
        responseCode: 200,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Download.out(0).to(this.RespondToWebhook.in(0));
        this.Filter.out(0).to(this.Download.in(0));
        this.List.out(0).to(this.Filter.in(0));
        this.Search.out(0).to(this.List.in(0));
        this.Webhook.out(0).to(this.Search.in(0));
    }
}
