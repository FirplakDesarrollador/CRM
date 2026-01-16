
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const excelPath = path.join(__dirname, '../BD precios CRM.xlsx');
const outputPath = path.join(__dirname, '../supabase/migrations/20260115_200000_update_export_prices.sql');

console.log('Reading Excel from:', excelPath);
const workbook = XLSX.readFile(excelPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];

// Read as JSON with headers
// We assume Row 1 (index 0) has headers, but inspect showed fuzzy headers.
// Safe bet: Read as array of arrays to be precise with indexes.
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log(`Found ${rows.length} rows.`);

let sqlContent = `-- Auto-generated migration to populate lista_base_exportaciones from Excel
-- Source: BD precios CRM.xlsx
-- Column L (Index 11) -> lista_base_exportaciones
-- Column A (Index 0) -> numero_articulo

BEGIN;

`;

let updateCount = 0;
let skippedCount = 0;

// Skip header (row 0)
for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawCode = row[0]; // Col A
    const rawPrice = row[11]; // Col L

    if (!rawCode) {
        skippedCount++;
        continue;
    }

    // Clean Code (String)
    const numero_articulo = String(rawCode).trim();

    // Clean Price
    // Excel might return number or formatted string (e.g. "$ 1.200")
    let price = 0;
    if (typeof rawPrice === 'number') {
        price = rawPrice;
    } else if (typeof rawPrice === 'string') {
        // Remove $ . , and parse
        // Assuming Colombian format might use dots for thousands? 
        // Or US format?
        // Let's assume input might be dirty.
        // Wait, 'xlsx' usually parses numbers as numbers unless they are text.
        // If it's a string like " - " or empty, treat as 0 or NULL.
        const clean = rawPrice.replace(/[$,\s]/g, '');
        price = parseFloat(clean);
    }

    if (!price || isNaN(price) || price === 0) {
        // If price is 0 or invalid, maybe we shouldn't overwrite? Or set to 0?
        // User said "popula adecuadamente". 
        // If the excel says 0 or empty, we probably shouldn't wipe existing data unless sure.
        // Let's assume we map valid values.
        skippedCount++;
        continue;
    }

    // Generate Update
    // Using simple UPDATE per row. For large datasets this is slow in execution but safe for migration files (transactions).
    sqlContent += `UPDATE "CRM_ListaDePrecios" SET lista_base_exportaciones = ${price} WHERE numero_articulo = '${numero_articulo}';\n`;
    updateCount++;
}

sqlContent += `
COMMIT;
`;

console.log(`Generated SQL for ${updateCount} updates.`);
console.log(`Skipped ${skippedCount} rows (missing code or invalid price).`);

fs.writeFileSync(outputPath, sqlContent);
console.log('Migration file written to:', outputPath);
