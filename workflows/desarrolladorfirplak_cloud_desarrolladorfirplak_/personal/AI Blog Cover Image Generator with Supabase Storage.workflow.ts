import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : AI Blog Cover Image Generator with Supabase Storage
// Nodes   : 11  |  Connections: 10
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ManualTrigger                      manualTrigger
// PrepareBlogPosts                   set
// SplitPosts                         splitOut
// BuildImagePrompt                   set
// GenerateCoverImage                 googleGemini               [creds]
// UploadToSupabaseStorage            httpRequest
// PrepareDatabaseUpdate              set
// UpdatePostCoverImage               supabase                   [creds]
// CollectResults                     aggregate
// FetchPostContent                   httpRequest                [onError→regular]
// SynthesizeWithGemini               googleGemini               [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ManualTrigger
//    → PrepareBlogPosts
//      → SplitPosts
//        → FetchPostContent
//          → SynthesizeWithGemini
//            → BuildImagePrompt
//              → GenerateCoverImage
//                → UploadToSupabaseStorage
//                  → PrepareDatabaseUpdate
//                    → UpdatePostCoverImage
//                      → CollectResults
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'ZG1eMuloOXloZYjx',
    name: 'AI Blog Cover Image Generator with Supabase Storage',
    active: false,
    settings: {
        executionOrder: 'v1',
        binaryMode: 'separate',
        timeSavedMode: 'fixed',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: true,
    },
})
export class AiBlogCoverImageGeneratorWithSupabaseStorageWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [288, 304],
    })
    ManualTrigger = {};

    @node({
        name: 'Prepare Blog Posts',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [480, 304],
    })
    PrepareBlogPosts = {
        assignments: {
            assignments: [
                {
                    id: 'posts',
                    name: 'posts',
                    type: 'array',
                    value: '[{"id":"10a88d69-a2c8-4ed7-91f2-d80af5f2803c","slug":"su-negocio-tiene-un-adn-sabe-donde-lo-esta-guardando","title":"Tu negocio tiene un ADN. ¿Sabes dónde lo estás guardando?","prompt":"Kurzgesagt-style illustration of DNA double helix transforming into business workflow diagrams and organizational charts, vibrant blues and greens, flat design, digital knowledge storage"},{"id":"5cd8fa82-4096-46d7-a826-671ecd5c1912","slug":"cuanto-le-cuesta-que-alguien-se-vaya","title":"¿Cuánto le cuesta a tu negocio que alguien se vaya?","prompt":"Kurzgesagt-style illustration of coins and money flying away as an employee walks out of a company building, colorful flat design, cost of employee turnover"},{"id":"bf754b05-5868-4d70-b21d-b39bc4a76cb5","slug":"nuevo-editor-visual-flujos-vibeworkflow","title":"Nuevo editor visual de flujos: mapea procesos en minutos","prompt":"Kurzgesagt-style illustration of colorful workflow diagram being drawn on a digital canvas with drag-and-drop nodes connecting, vibrant flat design, visual process mapping"},{"id":"00ee382d-1952-4a98-b04c-9c1b42857850","slug":"pymes-gestion-del-conocimiento","title":"Por qué las PyMEs necesitan gestión del conocimiento hoy","prompt":"Kurzgesagt-style illustration of small business with glowing knowledge nodes and information flowing between team members, colorful flat design, knowledge management"},{"id":"9c270123-cab6-48b5-ae3a-1b5dcc41436a","slug":"onboarding-empleados-3x-mas-rapido","title":"Cómo onboardear nuevos empleados 3x más rápido","prompt":"Kurzgesagt-style illustration of new employee rocket-launching through onboarding checklist milestones 3x faster, vibrant flat design, accelerated onboarding"},{"id":"37bbbfa3-015f-439f-b2ac-89faffe53761","slug":"ia-detecta-brechas-knowhow-empresarial","title":"Cómo la IA detecta brechas en tu knowhow empresarial","prompt":"Kurzgesagt-style illustration of AI magnifying glass scanning business knowledge map revealing gaps and blind spots, colorful flat design, AI knowledge gap detection"},{"id":"26f72e81-655c-4994-a459-c15bc5bc43a6","slug":"como-crear-tu-primer-flujo-vibeworkflow","title":"Cómo crear tu primer flujo en VIBEWORKFLOW paso a paso","prompt":"Kurzgesagt-style illustration of step-by-step workflow creation with colorful blocks connecting into an automated process flow, vibrant flat design, first workflow tutorial"},{"id":"b348f058-d043-4270-90ce-193daab4a37c","slug":"empresas-que-escalan-vs-se-estancan","title":"Lo que distingue a las empresas que escalan de las que se estancan","prompt":"Kurzgesagt-style illustration contrasting two companies - one launching upward on a rocket versus one stuck in circles, colorful flat design, business scaling vs stagnation"},{"id":"2a4eec32-91d9-4606-a845-1fdb3cb972b3","slug":"documenta-mientras-trabajas-habito-empresas","title":"Documenta mientras trabajas: el hábito que cambia empresas","prompt":"Kurzgesagt-style illustration of worker doing tasks while digital documentation captures the process automatically, vibrant flat design, documentation habit"},{"id":"7b51204e-1789-4870-b547-752a56a096b3","slug":"el-proceso-que-vive-en-la-cabeza-de-una-persona","title":"El proceso que vive solo en la cabeza de una persona (y el riesgo que eso representa)","prompt":"Kurzgesagt-style illustration of a single person with complex process diagram locked inside their head, vulnerability shown if they leave, colorful flat design, knowledge risk"},{"id":"1ce791e4-9c59-4919-9f44-149e142e0dd2","slug":"checklist-vs-proceso-errores-repetidos","title":"El checklist no es un proceso: por qué tu equipo sigue cometiendo los mismos errores","prompt":"Kurzgesagt-style illustration of checklist being ticked while same errors repeat in circular loop, colorful flat design, checklist vs real process"},{"id":"55e87fa8-af26-4dbf-be7d-261c8aa182dc","slug":"como-delegar-sin-miedo-procesos-documentados","title":"Cómo delegar sin miedo: el secreto está en los procesos documentados","prompt":"Kurzgesagt-style illustration of manager confidently passing documented process baton to team member, vibrant flat design, fearless delegation"},{"id":"d127de88-9b87-4d0d-9420-2c9c3d2b0e9b","slug":"costo-real-no-tener-procesos","title":"El costo real de no tener procesos: lo que pierdes sin darte cuenta","prompt":"Kurzgesagt-style illustration of business leaking money and time through invisible holes without documented processes, colorful flat design, hidden costs"},{"id":"11f6bf60-ed8b-47af-9c40-f3ad5755dfe1","slug":"reuniones-vs-procesos-documentados","title":"Reuniones vs. procesos documentados: por qué sigues resolviendo lo mismo una y otra vez","prompt":"Kurzgesagt-style illustration contrasting endless meeting loop versus single documented process that solves issues permanently, vibrant flat design"},{"id":"37df4d38-087f-475a-a5aa-2a483a4e2631","slug":"onboarding-procesos-documentados-equipo-nuevo","title":"Incorporar a alguien nuevo no debería tomar meses: cómo los procesos documentados aceleran el onboarding","prompt":"Kurzgesagt-style illustration of new team member speed-running through documented process pathway in days instead of months, colorful flat design, fast onboarding"}]',
                },
            ],
        },
        options: {},
    };

    @node({
        name: 'Split Posts',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [704, 304],
    })
    SplitPosts = {
        fieldToSplitOut: 'posts',
        options: {},
    };

    @node({
        name: 'Build Image Prompt',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [1504, 304],
    })
    BuildImagePrompt = {
        assignments: {
            assignments: [
                {
                    id: 'id-1',
                    name: 'prompt',
                    value: '=Kurzgesagt style illustration of {{  $json.text }}, vibrant flat vector art, dark navy background, cute cartoon bird mascots with big round eyes, bright neon colors, bold black outlines',
                    type: 'string',
                },
                {
                    id: 'id-2',
                    name: 'id',
                    value: "={{ $('Fetch Post Content').item.json.id }}",
                    type: 'string',
                },
                {
                    id: 'id-3',
                    name: 'slug',
                    value: "={{ $('Fetch Post Content').item.json.slug }}",
                    type: 'string',
                },
                {
                    id: 'id-4',
                    name: 'title',
                    value: "={{ $('Fetch Post Content').item.json.title }}",
                    type: 'string',
                },
            ],
        },
        options: {},
    };

    @node({
        name: 'Generate Cover Image',
        type: '@n8n/n8n-nodes-langchain.googleGemini',
        version: 1.1,
        position: [1728, 304],
        credentials: { googlePalmApi: { id: 'BIJke2vfzFHX7zee', name: 'Google Gemini(PaLM) Api account' } },
    })
    GenerateCoverImage = {
        resource: 'image',
        modelId: {
            __rl: true,
            value: 'models/imagen-4.0-generate-001',
            mode: 'list',
            cachedResultName: 'models/imagen-4.0-generate-001',
        },
        prompt: '={{ $json.prompt }}',
        options: {},
    };

    @node({
        name: 'Upload to Supabase Storage',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1952, 304],
    })
    UploadToSupabaseStorage = {
        method: 'POST',
        url: "=https://sctkrwejpbgurktkzhcc.supabase.co/storage/v1/object/blog-images/covers/{{ $('Build Image Prompt').item.json.slug }}.png",
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Content-Type',
                    value: 'image/png',
                },
                {
                    name: 'Authorization',
                    value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjdGtyd2VqcGJndXJrdGt6aGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1ODk2MTcsImV4cCI6MjA3OTE2NTYxN30._lTqhoUWnzq4XiIxYKkHnmsobwE5ADkA_41lJ7u4FFc',
                },
                {
                    name: 'x-upsert',
                    value: 'true',
                },
            ],
        },
        sendBody: true,
        contentType: 'binaryData',
        inputDataFieldName: 'data',
        options: {},
    };

    @node({
        name: 'Prepare Database Update',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [2176, 304],
    })
    PrepareDatabaseUpdate = {
        assignments: {
            assignments: [
                {
                    id: 'id-1',
                    name: 'id',
                    value: "={{ $('Build Image Prompt').item.json.id }}",
                    type: 'string',
                },
                {
                    id: 'id-2',
                    name: 'slug',
                    value: "={{ $('Build Image Prompt').item.json.slug }}",
                    type: 'string',
                },
                {
                    id: 'id-3',
                    name: 'title',
                    value: "={{ $('Build Image Prompt').item.json.title }}",
                    type: 'string',
                },
                {
                    id: 'id-4',
                    name: 'cover_image_url',
                    value: "=https://sctkrwejpbgurktkzhcc.supabase.co/storage/v1/object/public/blog-images/covers/{{ $('Build Image Prompt').item.json.slug }}.png",
                    type: 'string',
                },
            ],
        },
        options: {},
    };

    @node({
        name: 'Update Post Cover Image',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2400, 304],
        credentials: { supabaseApi: { id: 'slIqUfrtpt1lJmbE', name: 'VIBEWORKFLOW Supabase' } },
    })
    UpdatePostCoverImage = {
        operation: 'update',
        tableId: 'posts',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: '={{ $json.id }}',
                },
            ],
        },
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'cover_image',
                    fieldValue: '={{ $json.cover_image_url }}',
                },
            ],
        },
    };

    @node({
        name: 'Collect Results',
        type: 'n8n-nodes-base.aggregate',
        version: 1,
        position: [2624, 304],
    })
    CollectResults = {
        aggregate: 'aggregateAllItemData',
        options: {},
    };

    @node({
        name: 'Fetch Post Content',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [928, 304],
        onError: 'continueRegularOutput',
    })
    FetchPostContent = {
        url: 'https://sctkrwejpbgurktkzhcc.supabase.co/rest/v1/posts',
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'slug',
                    value: '=eq.{{  $json.slug }}',
                },
                {
                    name: 'select',
                    value: 'id,title,slug,excerpt,content',
                },
            ],
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'apikey',
                    value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjdGtyd2VqcGJndXJrdGt6aGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1ODk2MTcsImV4cCI6MjA3OTE2NTYxN30._lTqhoUWnzq4XiIxYKkHnmsobwE5ADkA_41lJ7u4FFc',
                },
                {
                    name: 'Authorization',
                    value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjdGtyd2VqcGJndXJrdGt6aGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1ODk2MTcsImV4cCI6MjA3OTE2NTYxN30._lTqhoUWnzq4XiIxYKkHnmsobwE5ADkA_41lJ7u4FFc',
                },
                {
                    name: 'Accept',
                    value: 'application/vnd.pgrst.object+json',
                },
            ],
        },
        options: {},
    };

    @node({
        name: 'Synthesize with Gemini',
        type: '@n8n/n8n-nodes-langchain.googleGemini',
        version: 1.1,
        position: [1152, 304],
        credentials: { googlePalmApi: { id: 'BIJke2vfzFHX7zee', name: 'Google Gemini(PaLM) Api account' } },
    })
    SynthesizeWithGemini = {
        modelId: {
            __rl: true,
            value: 'models/gemini-3.1-flash-live-preview',
            mode: 'list',
            cachedResultName: 'models/gemini-3.1-flash-live-preview',
        },
        messages: {
            values: [
                {
                    content: '=="Blog post title: " + $json.title + "\\n\\nSummary: " + $json.excerpt',
                },
            ],
        },
        builtInTools: {},
        options: {
            systemMessage:
                'You are a visual concept designer for a Kurzgesagt-style YouTube channel. Given a blog post about business processes and automation, generate a SHORT image prompt (maximum 15 words) describing a concrete visual scene for a flat vector illustration. Focus on objects and actions that can be drawn. Output ONLY the scene description, nothing else. No quotes, no explanations.',
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ManualTrigger.out(0).to(this.PrepareBlogPosts.in(0));
        this.PrepareBlogPosts.out(0).to(this.SplitPosts.in(0));
        this.SplitPosts.out(0).to(this.FetchPostContent.in(0));
        this.BuildImagePrompt.out(0).to(this.GenerateCoverImage.in(0));
        this.GenerateCoverImage.out(0).to(this.UploadToSupabaseStorage.in(0));
        this.UploadToSupabaseStorage.out(0).to(this.PrepareDatabaseUpdate.in(0));
        this.PrepareDatabaseUpdate.out(0).to(this.UpdatePostCoverImage.in(0));
        this.UpdatePostCoverImage.out(0).to(this.CollectResults.in(0));
        this.FetchPostContent.out(0).to(this.SynthesizeWithGemini.in(0));
        this.SynthesizeWithGemini.out(0).to(this.BuildImagePrompt.in(0));
    }
}
