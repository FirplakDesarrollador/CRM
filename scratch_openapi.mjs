import * as dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';

async function run() {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/?apikey=${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`;
    const res = await fetch(url);
    const schema = await res.json();
    
    // OpenAPI 3.0 uses components.schemas
    const table = schema.components?.schemas?.['CRM_Cuentas'] || schema.definitions?.['CRM_Cuentas'];
    if (table) {
        console.log("CRM_Cuentas properties:", Object.keys(table.properties));
    } else {
        console.log("Table not found. Available schemas:", Object.keys(schema.components?.schemas || schema.definitions || {}));
    }
}
run();
