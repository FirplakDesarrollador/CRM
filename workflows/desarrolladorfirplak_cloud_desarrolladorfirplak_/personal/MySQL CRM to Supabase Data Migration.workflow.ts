import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : MySQL CRM to Supabase Data Migration
// Nodes   : 4  |  Connections: 4
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ProcesarEnLotes                    splitInBatches
// IniciarMigracion                   manualTrigger
// ObtenerTodosLosRegistrosMysql      mySql                      [creds]
// InsertarEnSupabase                 supabase                   [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// IniciarMigracion
//    → ObtenerTodosLosRegistrosMysql
//      → ProcesarEnLotes
//       .out(1) → InsertarEnSupabase
//          → ProcesarEnLotes (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'PEbHgZlNQ0YkStMd',
    name: 'MySQL CRM to Supabase Data Migration',
    active: false,
    settings: { executionOrder: 'v1', binaryMode: 'separate', availableInMCP: false },
})
export class MysqlCrmToSupabaseDataMigrationWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        name: 'Procesar en Lotes',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [400, 0],
    })
    ProcesarEnLotes = {
        batchSize: 100,
        options: {
            reset: true,
        },
    };

    @node({
        name: 'Iniciar Migración',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-16, 0],
    })
    IniciarMigracion = {};

    @node({
        name: 'Obtener TODOS los Registros MySQL',
        type: 'n8n-nodes-base.mySql',
        version: 2.5,
        position: [208, 0],
        credentials: { mySql: { id: 'MxoNNWdlZ63uD2EA', name: 'MySQL account' } },
    })
    ObtenerTodosLosRegistrosMysql = {
        operation: 'executeQuery',
        query: "SELECT \n    ce.createdtime AS `Fecha de Creación`,\n    CONCAT(vu.first_name, ' ', vu.last_name) AS `Asignado a`,\n    vp.potentialname AS `Oportunidad`,\n    vp.sales_stage AS `Etapa de Venta`,\n    vpcf.cf_1152 AS `Categoría`,\n    cd.firstname AS `Nombre Contacto`,\n    cd.lastname AS `Apellidos Contacto`,\n    cd.mobile AS `Whatsapp`,\n    cd.email AS `Correo`,\n    vpcf.cf_1191 AS `URL Optin`,\n    vpcf.cf_1193 AS `URL Origen`,\n    vpcf.cf_1146 AS `Origen de prospecto`,\n    vpcf.cf_1144 AS `Conversión por`\nFROM vtiger_potential vp\nINNER JOIN vtiger_crmentity ce \n    ON vp.potentialid = ce.crmid\n    AND ce.deleted = 0\nINNER JOIN vtiger_potentialscf vpcf \n    ON vpcf.potentialid = vp.potentialid\nINNER JOIN vtiger_contactdetails cd \n    ON vp.contact_id = cd.contactid\nINNER JOIN vtiger_contactscf cdcf \n    ON cdcf.contactid = cd.contactid\nINNER JOIN vtiger_users vu \n    ON vu.id = ce.smownerid",
        options: {},
    };

    @node({
        name: 'Insertar en Supabase',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [624, 0],
        credentials: { supabaseApi: { id: 'mQUs9m2a6xzm7cgP', name: 'Supabase account' } },
    })
    InsertarEnSupabase = {
        tableId: 'crm_oportunidades_vtiger',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'fecha_creacion',
                    fieldValue: "={{ $json['Fecha de Creación'] }}",
                },
                {
                    fieldId: 'asignado_a',
                    fieldValue: "={{ $json['Asignado a'] }}",
                },
                {
                    fieldId: 'oportunidad',
                    fieldValue: '={{ $json.Oportunidad }}',
                },
                {
                    fieldId: 'etapa_venta',
                    fieldValue: "={{ $json['Etapa de Venta'] }}",
                },
                {
                    fieldId: 'nombre_contacto',
                    fieldValue: "={{ $json['Nombre Contacto'] }}",
                },
                {
                    fieldId: 'apellidos_contacto',
                    fieldValue: "={{ $json['Apellidos Contacto'] }}",
                },
                {
                    fieldId: 'whatsapp',
                    fieldValue: '={{ $json.Whatsapp }}',
                },
                {
                    fieldId: 'correo',
                    fieldValue: '={{ $json.Correo }}',
                },
                {
                    fieldId: 'url_optin',
                    fieldValue: "={{ $json['URL Origen'] }}",
                },
                {
                    fieldId: 'url_origen',
                    fieldValue: "={{ $json['URL Origen'] }}",
                },
                {
                    fieldId: 'origen_prospecto',
                    fieldValue: "={{ $json['Origen de prospecto'] }}",
                },
                {
                    fieldId: 'conversion_por',
                    fieldValue: "={{ $json['Conversión por'] }}",
                },
            ],
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ProcesarEnLotes.out(1).to(this.InsertarEnSupabase.in(0));
        this.IniciarMigracion.out(0).to(this.ObtenerTodosLosRegistrosMysql.in(0));
        this.ObtenerTodosLosRegistrosMysql.out(0).to(this.ProcesarEnLotes.in(0));
        this.InsertarEnSupabase.out(0).to(this.ProcesarEnLotes.in(0));
    }
}
