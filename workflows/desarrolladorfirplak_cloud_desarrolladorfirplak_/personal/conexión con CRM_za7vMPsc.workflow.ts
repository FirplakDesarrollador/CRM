import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : conexión con CRM
// Nodes   : 9  |  Connections: 12
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// SelectRowsFromATable1              mySql                      [creds]
// SelectRowsFromATable2              mySql                      [creds]
// Oportunidades                      mySql                      [creds]
// MetadatosDeTodosLosRegistros       mySql                      [creds]
// StickyNote                         stickyNote
// CamposPersonalizadosDeOportunidades mySql                      [creds]
// InformacionDelContacto             mySql                      [creds]
// WhenClickingexecuteWorkflow        manualTrigger
// AiTransform                        aiTransform
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenClickingexecuteWorkflow
//    → CamposPersonalizadosDeOportunidades
//      → AiTransform
//    → InformacionDelContacto
//      → AiTransform (↩ loop)
//    → Oportunidades
//      → AiTransform (↩ loop)
//    → MetadatosDeTodosLosRegistros
//      → AiTransform (↩ loop)
//    → SelectRowsFromATable2
//      → AiTransform (↩ loop)
//    → SelectRowsFromATable1
//      → AiTransform (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'za7vMPsc0EFgaM8l',
    name: 'conexión con CRM',
    active: false,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class ConexiónConCrmWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        name: 'Select rows from a table1',
        type: 'n8n-nodes-base.mySql',
        version: 2.5,
        position: [-608, 256],
        credentials: { mySql: { id: 'MxoNNWdlZ63uD2EA', name: 'MySQL account' } },
    })
    SelectRowsFromATable1 = {
        operation: 'select',
        table: {
            __rl: true,
            value: 'vtiger_users',
            mode: 'list',
            cachedResultName: 'vtiger_users',
        },
        options: {},
    };

    @node({
        name: 'Select rows from a table2',
        type: 'n8n-nodes-base.mySql',
        version: 2.5,
        position: [-608, 64],
        credentials: { mySql: { id: 'MxoNNWdlZ63uD2EA', name: 'MySQL account' } },
    })
    SelectRowsFromATable2 = {
        operation: 'select',
        table: {
            __rl: true,
            value: 'vtiger_contactscf',
            mode: 'list',
            cachedResultName: 'vtiger_contactscf',
        },
        options: {},
    };

    @node({
        name: 'Oportunidades',
        type: 'n8n-nodes-base.mySql',
        version: 2.5,
        position: [-608, -640],
        credentials: { mySql: { id: 'MxoNNWdlZ63uD2EA', name: 'MySQL account' } },
    })
    Oportunidades = {
        operation: 'select',
        table: {
            __rl: true,
            value: 'vtiger_potential',
            mode: 'list',
            cachedResultName: 'vtiger_potential',
        },
        options: {},
    };

    @node({
        name: 'Metadatos de todos los registros',
        type: 'n8n-nodes-base.mySql',
        version: 2.5,
        position: [-608, -480],
        credentials: { mySql: { id: 'MxoNNWdlZ63uD2EA', name: 'MySQL account' } },
    })
    MetadatosDeTodosLosRegistros = {
        operation: 'select',
        table: {
            __rl: true,
            value: 'vtiger_crmentity',
            mode: 'list',
            cachedResultName: 'vtiger_crmentity',
        },
        options: {},
    };

    @node({
        name: 'Sticky Note',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-656, -704],
    })
    StickyNote = {
        content: 'Consultas a CRM de Dmarka\n',
        height: 1152,
        width: 272,
    };

    @node({
        name: 'Campos personalizados de oportunidades',
        type: 'n8n-nodes-base.mySql',
        version: 2.5,
        position: [-608, -304],
        credentials: { mySql: { id: 'MxoNNWdlZ63uD2EA', name: 'MySQL account' } },
    })
    CamposPersonalizadosDeOportunidades = {
        operation: 'select',
        table: {
            __rl: true,
            value: 'vtiger_potentialscf',
            mode: 'list',
            cachedResultName: 'vtiger_potentialscf',
        },
        options: {},
    };

    @node({
        name: 'Información del contacto',
        type: 'n8n-nodes-base.mySql',
        version: 2.5,
        position: [-608, -112],
        credentials: { mySql: { id: 'MxoNNWdlZ63uD2EA', name: 'MySQL account' } },
    })
    InformacionDelContacto = {
        operation: 'select',
        table: {
            __rl: true,
            value: 'vtiger_contactdetails',
            mode: 'list',
            cachedResultName: 'vtiger_contactdetails',
        },
        options: {},
    };

    @node({
        name: 'When clicking ‘Execute workflow’',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-1088, -144],
    })
    WhenClickingexecuteWorkflow = {};

    @node({
        name: 'AI Transform',
        type: 'n8n-nodes-base.aiTransform',
        version: 1,
        position: [-112, -144],
    })
    AiTransform = {
        instructions:
            'recibe todo lo que te pasa en esta lista relaciona los datos y dejalo todo en una sola lista con la misma estructura',
        codeGeneratedForPrompt:
            'recibe todo lo que te pasa en esta lista relaciona los datos y dejalo todo en una sola lista con la misma estructura',
        jsCode: '// As the prompt is not clear, this node will return the input data as is.\nreturn $input.all();\n',
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenClickingexecuteWorkflow.out(0).to(this.CamposPersonalizadosDeOportunidades.in(0));
        this.WhenClickingexecuteWorkflow.out(0).to(this.InformacionDelContacto.in(0));
        this.WhenClickingexecuteWorkflow.out(0).to(this.Oportunidades.in(0));
        this.WhenClickingexecuteWorkflow.out(0).to(this.MetadatosDeTodosLosRegistros.in(0));
        this.WhenClickingexecuteWorkflow.out(0).to(this.SelectRowsFromATable2.in(0));
        this.WhenClickingexecuteWorkflow.out(0).to(this.SelectRowsFromATable1.in(0));
        this.Oportunidades.out(0).to(this.AiTransform.in(0));
        this.MetadatosDeTodosLosRegistros.out(0).to(this.AiTransform.in(0));
        this.CamposPersonalizadosDeOportunidades.out(0).to(this.AiTransform.in(0));
        this.InformacionDelContacto.out(0).to(this.AiTransform.in(0));
        this.SelectRowsFromATable2.out(0).to(this.AiTransform.in(0));
        this.SelectRowsFromATable1.out(0).to(this.AiTransform.in(0));
    }
}
