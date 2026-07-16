import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

const envFile = readFileSync('.env', 'utf-8');
envFile.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const users = {
    juan_fernando: '31472414-6416-4c11-baa7-11448c44074b',
    claudia: '9bca54d7-45d6-4e79-8dba-be6983a78556',
    analista: '98307347-db51-4c13-8763-15ae55d27a5b'
};

const records = [
    {
        oppName: "HIDROMASAJE GALAPAGOS 250X200",
        amount: 945996,
        contactName: "Marcela Marcela",
        phone: "3137325779",
        category: "Hidromasajes/Jacuzzis y Tinas",
        assignee: users.claudia,
        activity: "Cotizacion Enviada",
        date: "2026-07-10T09:00:00Z"
    },
    {
        oppName: "Por definir",
        amount: 1199900,
        contactName: "Humberto Suarez",
        phone: "3008034901",
        category: "Hidromasajes/Jacuzzis y Tinas",
        assignee: users.claudia,
        activity: "Requerimiento identificado",
        date: "2026-07-15T09:00:00Z"
    },
    {
        oppName: "RH KIT LVT PI",
        amount: 4130100,
        contactName: "Jhon Faber",
        phone: "3128644365",
        category: "Zona de labores",
        assignee: users.analista,
        activity: "Cotizacion Enviada",
        date: "2026-01-09T09:00:00Z"
    },
    {
        oppName: "RH KIT MESA",
        amount: 9617200,
        contactName: "Claudia Velasquez",
        phone: "3136534154",
        category: "Zona de labores",
        assignee: users.analista,
        activity: "Cotizacion Enviada",
        date: "2026-01-09T09:00:00Z"
    },
    {
        oppName: "HIDROMASA",
        amount: 9172091,
        contactName: "Juan Jaramillo",
        phone: "3147728706",
        category: "Hidromasajes/Jacuzzis y Tinas",
        assignee: users.juan_fernando,
        activity: "Cotizacion Enviada",
        date: "2026-06-10T09:00:00Z"
    }
];

async function migrate() {
    for (const r of records) {
        console.log(`Procesando oportunidad: ${r.oppName}...`);
        
        // 1. Account
        const accountId = randomUUID();
        const { error: errAcc } = await supabase.from('CRM_Cuentas').insert({
            id: accountId,
            nombre: r.contactName,
            telefono: r.phone,
            owner_user_id: r.assignee,
            created_by: r.assignee
        });
        if(errAcc) { console.error('Error Cuenta:', errAcc); continue; }

        // 2. Contact
        const contactId = randomUUID();
        const { error: errCont } = await supabase.from('CRM_Contactos').insert({
            id: contactId,
            account_id: accountId,
            nombre: r.contactName,
            telefono: r.phone,
            created_by: r.assignee,
            es_principal: true
        });
        if(errCont) { console.error('Error Contacto:', errCont); continue; }

        // 3. Opportunity
        const oppId = randomUUID();
        const { error: errOpp } = await supabase.from('CRM_Oportunidades').insert({
            id: oppId,
            account_id: accountId,
            nombre: r.oppName,
            amount: r.amount,
            owner_user_id: r.assignee,
            created_by: r.assignee,
            estado_id: 1, // Default state
            fase_id: 1,   // Default stage
            categoria_oportunidad: r.category,
            fecha_cierre_estimada: r.date
        });
        if(errOpp) { console.error('Error Oportunidad:', errOpp); continue; }

        // 4. Activity
        const actId = randomUUID();
        const { error: errAct } = await supabase.from('CRM_Actividades').insert({
            id: actId,
            opportunity_id: oppId,
            account_id: accountId,
            user_id: r.assignee,
            created_by: r.assignee,
            asunto: r.activity,
            tipo_actividad_id: 1, // Tarea
            fecha_inicio: r.date,
            fecha_fin: r.date,
            is_completed: false
        });
        if(errAct) { console.error('Error Actividad:', errAct); continue; }

        console.log(`✅ Creado: ${r.contactName} -> ${r.oppName}`);
    }
    console.log('Migración completa.');
}

migrate();
