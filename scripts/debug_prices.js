const XLSX = require('xlsx');

const wb = XLSX.readFile('BD precios CRM.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

// Check rows 8000-8100 for problematic values
console.log('Checking rows around batch 17 (rows 8000-8100)...\n');
for (let i = 8000; i < Math.min(8100, rawData.length); i++) {
    const row = rawData[i];
    if (!row[0]) continue;

    // Check for very large numbers
    for (let j = 2; j <= 16; j++) {
        const val = parseFloat(row[j]);
        if (!isNaN(val) && Math.abs(val) > 9999999999999999) {
            console.log(`Row ${i}, Col ${j}: ${val}`);
        }
    }
}

console.log('\nSample of row 8000:');
console.log(JSON.stringify(rawData[8000], null, 2));
