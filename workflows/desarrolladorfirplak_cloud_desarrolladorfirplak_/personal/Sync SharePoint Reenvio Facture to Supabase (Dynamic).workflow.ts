import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Sync SharePoint Reenvio Facture to Supabase (Dynamic)
// Nodes   : 8  |  Connections: 7
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ScheduleTrigger                    scheduleTrigger            
// SearchTargetFolder                 microsoftOneDrive          [creds]
// ListInvoiceFolders                 microsoftOneDrive          [creds]
// FilterFoldersOnly                  filter                     
// ListFilesInFolder                  microsoftOneDrive          [creds]
// DownloadFile                       microsoftOneDrive          [creds]
// ExtractMetadata                    code                       
// UploadToSupabase                   httpRequest                
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ScheduleTrigger
//    → SearchTargetFolder
//      → ListInvoiceFolders
//        → FilterFoldersOnly
//          → ListFilesInFolder
//            → DownloadFile
//              → ExtractMetadata
//                → UploadToSupabase
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: "obowjBxClLR1VDv8",
    name: "Sync SharePoint Reenvio Facture to Supabase (Dynamic)",
    active: false,
    settings: {executionOrder:"v1",binaryMode:"separate",availableInMCP:false}
})
export class SyncSharepointReenvioFactureToSupabase(dynamic)Workflow {

    // =====================================================================
// CONFIGURATION DES NOEUDS
// =====================================================================

    @node({
        name: "Schedule Trigger",
        type: "n8n-nodes-base.scheduleTrigger",
        version: 1.1,
        position: [-128, -128]
    })
    ScheduleTrigger = {
        "rule": {
            "interval": [
                {
                    "field": "minutes",
                    "minutesInterval": 30
                }
            ]
        }
    };

    @node({
        name: "Search Target Folder",
        type: "n8n-nodes-base.microsoftOneDrive",
        version: 1,
        position: [96, -128],
        credentials: {microsoftOneDriveOAuth2Api:{id:"S1U4l0j3vsGAD5iI",name:"Microsoft Drive account"}}
    })
    SearchTargetFolder = {
        "resource": "folder",
        "operation": "search",
        "query": "Reenvio facture"
    };

    @node({
        name: "List Invoice Folders",
        type: "n8n-nodes-base.microsoftOneDrive",
        version: 1,
        position: [320, -128],
        credentials: {microsoftOneDriveOAuth2Api:{id:"S1U4l0j3vsGAD5iI",name:"Microsoft Drive account"}}
    })
    ListInvoiceFolders = {
        "resource": "folder",
        "folderId": "={{ $json.id }}"
    };

    @node({
        name: "Filter: Folders Only",
        type: "n8n-nodes-base.filter",
        version: 1,
        position: [544, -128]
    })
    FilterFoldersOnly = {
        "conditions": {
            "boolean": [
                {
                    "value1": "={{ $json.folder ? true : false }}",
                    "value2": true
                }
            ]
        }
    };

    @node({
        name: "List Files in Folder",
        type: "n8n-nodes-base.microsoftOneDrive",
        version: 1,
        position: [752, -128],
        credentials: {microsoftOneDriveOAuth2Api:{id:"S1U4l0j3vsGAD5iI",name:"Microsoft Drive account"}}
    })
    ListFilesInFolder = {
        "resource": "folder",
        "folderId": "={{ $json.id }}"
    };

    @node({
        name: "Download File",
        type: "n8n-nodes-base.microsoftOneDrive",
        version: 1,
        position: [976, -128],
        credentials: {microsoftOneDriveOAuth2Api:{id:"S1U4l0j3vsGAD5iI",name:"Microsoft Drive account"}}
    })
    DownloadFile = {
        "operation": "download",
        "fileId": "={{ $json.id }}"
    };

    @node({
        name: "Extract Metadata",
        type: "n8n-nodes-base.code",
        version: 1,
        position: [1200, -128]
    })
    ExtractMetadata = {
        "jsCode": "const folderName = $node[\"Filter: Folders Only\"].json.name;\nconst fileName = $json.name;\nlet invoiceNumber = 'unknown';\n\n// Extract invoice number from FACTURA-UBL(NIT;NRO;DATE;...)\nconst match = folderName.match(/\\(([^)]+)\\)/);\nif (match) {\n  const parts = match[1].split(';');\n  if (parts.length >= 2) {\n    invoiceNumber = parts[1].trim();\n  }\n}\n\nreturn {\n  invoiceNumber,\n  fileName,\n  folderName\n};"
    };

    @node({
        name: "Upload to Supabase",
        type: "n8n-nodes-base.httpRequest",
        version: 4.1,
        position: [1424, -128]
    })
    UploadToSupabase = {
        "method": "POST",
        "url": "=https://zohdtksgxhbheaftgmsi.supabase.co/storage/v1/object/facturas_desde_n8n/{{ $json.invoiceNumber }}/{{ $json.fileName }}",
        "options": {}
    };


    // =====================================================================
// ROUTAGE ET CONNEXIONS
// =====================================================================

    @links()
    defineRouting() {
        this.ScheduleTrigger.out(0).to(this.SearchTargetFolder.in(0));
        this.SearchTargetFolder.out(0).to(this.ListInvoiceFolders.in(0));
        this.ListInvoiceFolders.out(0).to(this.FilterFoldersOnly.in(0));
        this.FilterFoldersOnly.out(0).to(this.ListFilesInFolder.in(0));
        this.ListFilesInFolder.out(0).to(this.DownloadFile.in(0));
        this.DownloadFile.out(0).to(this.ExtractMetadata.in(0));
        this.ExtractMetadata.out(0).to(this.UploadToSupabase.in(0));
    }
}