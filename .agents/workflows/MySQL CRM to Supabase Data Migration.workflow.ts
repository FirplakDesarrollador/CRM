import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : MySQL CRM to Supabase Data Migration
// Nodes   : 6  |  Connections: 4
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// CreateARow                         supabase                   [creds]
// CreateARow1                        supabase                   [creds]
// FilterValidRecords                 if
// Cada5Minutos                       scheduleTrigger
// ObtenerRegistrosNuevos             mySql                      [creds]
// ObtenerRegistrosNuevos1            mySql                      [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Cada5Minutos
//    → ObtenerRegistrosNuevos
//      → FilterValidRecords
//        → CreateARow
//          → CreateARow1
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'sWNoAe4e6yBzHnt7',
    name: 'MySQL CRM to Supabase Data Migration',
    active: true,
    settings: { executionOrder: 'v1', binaryMode: 'separate', availableInMCP: false },
})
export class MysqlCrmToSupabaseDataMigrationWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        name: 'Create a row',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [304, 304],
        credentials: { supabaseApi: { id: 'mQUs9m2a6xzm7cgP', name: 'Supabase account' } },
    })
    CreateARow = {
        tableId: 'CRM_Cuentas',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'nit_base',
                    fieldValue: '={{ Math.floor(100000000 + Math.random() * 900000000) }}',
                },
                {
                    fieldId: 'nombre',
                    fieldValue: "={{ $json['Nombre Contacto'] }} {{ $json['Apellidos Contacto'] }}",
                },
                {
                    fieldId: 'telefono',
                    fieldValue: "={{ $json['Whatsapp'] }}",
                },
                {
                    fieldId: 'email',
                    fieldValue: "={{ $json['Correo'] }}",
                },
                {
                    fieldId: 'canal_id',
                    fieldValue: 'PROPIO',
                },
            ],
        },
    };

    @node({
        name: 'Create a row1',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [448, 304],
        credentials: { supabaseApi: { id: 'mQUs9m2a6xzm7cgP', name: 'Supabase account' } },
    })
    CreateARow1 = {
        tableId: 'CRM_Oportunidades',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'account_id',
                    fieldValue: "={{ $('Create a row').item.json.id }}",
                },
                {
                    fieldId: 'nombre',
                    fieldValue: '=Canal Propio',
                },
                {
                    fieldId: 'owner_user_id',
                    fieldValue: 'f361d4e5-d937-4668-913a-a4359658d6f4',
                },
                {
                    fieldId: 'origen_oportunidad',
                    fieldValue: "={{ $json['Origen de prospecto'] }}",
                },
                {
                    fieldId: 'url_origen',
                    fieldValue: "={{ $json['URL Origen'] }}",
                },
                {
                    fieldId: 'fuente_conversion',
                    fieldValue: "={{ $json['Conversión por'] }}",
                },
            ],
        },
    };

    @node({
        name: 'Filter Valid Records',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [96, 304],
    })
    FilterValidRecords = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
                version: 2,
            },
            conditions: [
                {
                    id: 'id-1',
                    leftValue: "={{ $json['Correo'] }}",
                    operator: {
                        type: 'string',
                        operation: 'notEmpty',
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        name: 'Cada 5 Minutos',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.3,
        position: [-208, 304],
    })
    Cada5Minutos = {
        rule: {
            interval: [
                {
                    field: 'minutes',
                },
            ],
        },
    };

    @node({
        name: 'Obtener Registros Nuevos',
        type: 'n8n-nodes-base.mySql',
        version: 2.5,
        position: [-48, 304],
        credentials: { mySql: { id: 'MxoNNWdlZ63uD2EA', name: 'MySQL account' } },
    })
    ObtenerRegistrosNuevos = {
        operation: 'executeQuery',
        query: "SELECT \n    ce.createdtime AS `Fecha de Creación`,\n    CONCAT(vu.first_name, ' ', vu.last_name) AS `Asignado a`,\n    vp.potentialname AS `Oportunidad`,\n    vp.sales_stage AS `Etapa de Venta`,\n    vpcf.cf_1152 AS `Categoría`,\n    cd.firstname AS `Nombre Contacto`,\n    cd.lastname AS `Apellidos Contacto`,\n    cd.mobile AS `Whatsapp`,\n    cd.email AS `Correo`,\n    vpcf.cf_1191 AS `URL Optin`,\n    vpcf.cf_1193 AS `URL Origen`,\n    vpcf.cf_1146 AS `Origen de prospecto`,\n    vpcf.cf_1144 AS `Conversión por`\nFROM vtiger_potential vp\nINNER JOIN vtiger_crmentity ce \n    ON vp.potentialid = ce.crmid\n    AND ce.deleted = 0\nINNER JOIN vtiger_potentialscf vpcf \n    ON vpcf.potentialid = vp.potentialid\nINNER JOIN vtiger_contactdetails cd \n    ON vp.contact_id = cd.contactid\nINNER JOIN vtiger_contactscf cdcf \n    ON cdcf.contactid = cd.contactid\nINNER JOIN vtiger_users vu \n    ON vu.id = ce.smownerid\nWHERE ce.createdtime >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)\nORDER BY ce.createdtime ASC",
        options: {},
    };

    @node({
        name: 'Obtener Registros Nuevos1',
        type: 'n8n-nodes-base.mySql',
        version: 2.5,
        position: [-80, 528],
        credentials: { mySql: { id: 'MxoNNWdlZ63uD2EA', name: 'MySQL account' } },
    })
    ObtenerRegistrosNuevos1 = {
        operation: 'executeQuery',
        query: "SELECT \n    ce.createdtime AS `Fecha de Creación`,\n    CONCAT(vu.first_name, ' ', vu.last_name) AS `Asignado a`,\n    vp.potentialname AS `Oportunidad`,\n    vp.sales_stage AS `Etapa de Venta`,\n    vpcf.cf_1152 AS `Categoría`,\n    cd.firstname AS `Nombre Contacto`,\n    cd.lastname AS `Apellidos Contacto`,\n    cd.mobile AS `Whatsapp`,\n    cd.email AS `Correo`,\n    vpcf.cf_1191 AS `URL Optin`,\n    vpcf.cf_1193 AS `URL Origen`,\n    vpcf.cf_1146 AS `Origen de prospecto`,\n    vpcf.cf_1144 AS `Conversión por`\nFROM vtiger_potential vp\nINNER JOIN vtiger_crmentity ce \n    ON vp.potentialid = ce.crmid\n    AND ce.deleted = 0\nINNER JOIN vtiger_potentialscf vpcf \n    ON vpcf.potentialid = vp.potentialid\nINNER JOIN vtiger_contactdetails cd \n    ON vp.contact_id = cd.contactid\nINNER JOIN vtiger_contactscf cdcf \n    ON cdcf.contactid = cd.contactid\nINNER JOIN vtiger_users vu \n    ON vu.id = ce.smownerid\nLIMIT 5\n",
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.CreateARow.out(0).to(this.CreateARow1.in(0));
        this.FilterValidRecords.out(0).to(this.CreateARow.in(0));
        this.Cada5Minutos.out(0).to(this.ObtenerRegistrosNuevos.in(0));
        this.ObtenerRegistrosNuevos.out(0).to(this.FilterValidRecords.in(0));
    }
}
