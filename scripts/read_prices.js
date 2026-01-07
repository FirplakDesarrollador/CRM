const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('BD precios CRM.xlsx');
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('Sheet:', sheetName);
console.log('\nAll Headers:');
const headers = data[0];
headers.forEach((h, idx) => console.log(`  ${idx}: ${h}`));
console.log('\n\nTotal rows:', data.length);

// Write headers to file for easier viewing
fs.writeFileSync('scripts/headers.txt', headers.join('\n'));
console.log('\nHeaders saved to scripts/headers.txt');
