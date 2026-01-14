const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lnphhmowklqiomownurw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5MjAzNDAyNSwiZXhwIjoyMDA3NjEwMDI1fQ.J-2EWGSL4Gro06MYBFVLQNnjbeDGYqjeLy1x8SdR2ms';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function uploadPrices() {
    console.log('Reading Excel file...');
    const wb = XLSX.readFile('BD precios CRM.xlsx');
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const headers = rawData[0];
    console.log('Headers:', headers);

    // Helper to sanitize numeric values
    const safeNum = (val) => {
        const num = parseFloat(val);
        if (isNaN(num) || !isFinite(num)) return null;
        // Cap at max safe value for postgres numeric(18,2)
        if (Math.abs(num) > 9999999999999999) return null;
        return Math.round(num * 100) / 100; // Round to 2 decimals
    };

    // Helper for discount (smaller range)
    const safeDiscount = (val) => {
        const num = parseFloat(val);
        if (isNaN(num) || !isFinite(num)) return null;
        // Discount should be between 0 and 1 typically, but cap at 9.9999
        if (num > 9.9999) return 0.9999; // Cap at max for numeric(5,4)
        if (num < -9.9999) return -0.9999;
        return Math.round(num * 10000) / 10000; // Round to 4 decimals
    };

    // Map rows to objects
    const products = [];
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row[0]) continue; // Skip empty rows

        products.push({
            numero_articulo: String(row[0] || '').trim(),
            descripcion: String(row[1] || '').trim().substring(0, 500),
            lista_base_cop: safeNum(row[2]),
            distribuidor_descuento: safeDiscount(row[4]),
            distribuidor_pvp_iva: safeNum(row[6]),
            zona2_pvp: safeNum(row[9] || row[10]),
            mayorista_cop: safeNum(row[11]),
            pvp_sin_iva: safeNum(row[12]),
            lista_base_exportaciones: safeNum(row[14]),
            lista_base_obras: safeNum(row[16])
        });
    }

    console.log(`Parsed ${products.length} products. Uploading in batches...`);

    // Upload in batches of 500
    const BATCH_SIZE = 500;
    let uploaded = 0;
    let errors = 0;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
        const batch = products.slice(i, i + BATCH_SIZE);

        const { data, error } = await supabase
            .from('CRM_ListaDePrecios')
            .upsert(batch, { onConflict: 'numero_articulo' });

        if (error) {
            console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error.message);
            errors += batch.length;
        } else {
            uploaded += batch.length;
            console.log(`Uploaded batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(products.length / BATCH_SIZE)} (${uploaded} products)`);
        }
    }

    console.log(`\nDone! Uploaded: ${uploaded}, Errors: ${errors}`);
}

uploadPrices().catch(console.error);
