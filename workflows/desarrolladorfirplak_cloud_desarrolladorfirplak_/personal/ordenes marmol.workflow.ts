import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : ordenes marmol
// Nodes   : 12  |  Connections: 4
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ScheduleTrigger                    scheduleTrigger
// HttpRequest                        httpRequest
// CodeInJavascript                   code
// GetManyRows                        supabase                   [creds]
// UpdateARow                         supabase                   [creds]
// StickyNote                         stickyNote
// StickyNote1                        stickyNote
// StickyNote2                        stickyNote
// StickyNote3                        stickyNote
// StickyNote4                        stickyNote
// StickyNote5                        stickyNote
// GetManyRows1                       supabase                   [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ScheduleTrigger
//    → HttpRequest
//      → GetManyRows
//        → CodeInJavascript
//          → UpdateARow
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'mTIPIhTPt2mKlip6',
    name: 'ordenes marmol',
    active: true,
    settings: { executionOrder: 'v1', binaryMode: 'separate', availableInMCP: false },
})
export class OrdenesMarmolWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.3,
        position: [96, 208],
    })
    ScheduleTrigger = {
        rule: {
            interval: [
                {
                    field: 'minutes',
                    minutesInterval: 10,
                },
            ],
        },
    };

    @node({
        name: 'HTTP Request',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [416, 208],
    })
    HttpRequest = {
        url: 'https://phytogeographical-spiffy-shalonda.ngrok-free.dev/ordenes_marmol/',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'api-key',
                    value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX3R5cGUiOiJ1c2VyIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNjQyNzY3Njg3LCJleHBpcmVkX3VwIjoxNjQyNzY4NzAxfQ.6eYkakHhU6IvM_Nqd7c6hdAhY79iDoG2RUp9Hi9-2us',
                },
            ],
        },
        options: {},
    };

    @node({
        name: 'Code in JavaScript',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [992, 208],
    })
    CodeInJavascript = {
        jsCode: '// Obtener datos por nombre del nodo (seguro)\nconst supabaseItems = $items("Get many rows");\nconst httpItems = $items("HTTP Request");\n\nconst httpResponse = httpItems[0].json.response || [];\n\nconst resultado = [];\n\nfor (const item of supabaseItems) {\n  const orden = Number(item.json.orden_fabricacion);\n  const id = item.json.id;\n\n  const encontrado = httpResponse.find(\n    r => Number(r.orden_fabricacion) === orden\n  );\n\n  if (encontrado) {\n    resultado.push({\n      json: {\n        id,\n        orden,\n        fecha_ideal_produccion: encontrado.RlsDate\n      }\n    });\n  }\n}\n\nreturn resultado;\n',
    };

    @node({
        name: 'Get many rows',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [704, 208],
        credentials: { supabaseApi: { id: 'BR6F67mqGok1J49N', name: 'Supabase account 2' } },
    })
    GetManyRows = {
        operation: 'getAll',
        tableId: 'ordenes_fabricacion',
        returnAll: true,
        filters: {
            conditions: [
                {
                    keyName: 'fecha_ideal_produccion',
                    condition: 'is',
                    keyValue: 'null',
                },
            ],
        },
    };

    @node({
        name: 'Update a row',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1280, 208],
        credentials: { supabaseApi: { id: 'BR6F67mqGok1J49N', name: 'Supabase account 2' } },
    })
    UpdateARow = {
        operation: 'update',
        tableId: 'ordenes_fabricacion',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'orden_fabricacion',
                    condition: 'eq',
                    keyValue: '={{$json.orden}}',
                },
            ],
        },
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'fecha_ideal_produccion',
                    fieldValue: '={{$json.fecha_ideal_produccion}}',
                },
            ],
        },
    };

    @node({
        name: 'Sticky Note',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [0, 0],
    })
    StickyNote = {
        content:
            'este flujo tiene como proposito actualizar la fecha ideal de produccion en la aplicacion control de piso \n',
    };

    @node({
        name: 'Sticky Note1',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [16, 368],
    })
    StickyNote1 = {
        content: 'Ejecuta el flujo cada 30 minutos',
    };

    @node({
        name: 'Sticky Note2',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [336, 368],
    })
    StickyNote2 = {
        content: 'busca las ordenes en sap funciona con ngrock\n',
    };

    @node({
        name: 'Sticky Note3',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [640, 368],
    })
    StickyNote3 = {
        content: 'consulta que ordenes tienen la fecha ideal de produccion en null',
    };

    @node({
        name: 'Sticky Note4',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [928, 368],
    })
    StickyNote4 = {
        content: 'ordena la lista ',
    };

    @node({
        name: 'Sticky Note5',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [1216, 368],
    })
    StickyNote5 = {
        content: 'Actualiza en supabase',
    };

    @node({
        name: 'Get many rows1',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [288, 32],
        credentials: { supabaseApi: { id: 'BR6F67mqGok1J49N', name: 'Supabase account 2' } },
    })
    GetManyRows1 = {
        operation: 'getAll',
        tableId: 'ordenes_fabricacion',
        returnAll: true,
        filters: {
            conditions: [
                {
                    keyName: 'fecha_ideal_produccion',
                    condition: 'is',
                    keyValue: 'null',
                },
            ],
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ScheduleTrigger.out(0).to(this.HttpRequest.in(0));
        this.HttpRequest.out(0).to(this.GetManyRows.in(0));
        this.CodeInJavascript.out(0).to(this.UpdateARow.in(0));
        this.GetManyRows.out(0).to(this.CodeInJavascript.in(0));
    }
}
