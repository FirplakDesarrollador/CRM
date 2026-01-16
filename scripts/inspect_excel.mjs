
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../BD precios CRM.xlsx');
console.log('Reading file from:', filePath);

const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Get range
const range = XLSX.utils.decode_range(sheet['!ref']);
console.log('Range:', range);

// Read headers (Row 0)
const headers = [];
for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: C })];
    headers.push(cell ? cell.v : `UNKNOWN_${C}`);
}

console.log('Headers:', headers);

// Read first 3 data rows
const data = XLSX.utils.sheet_to_json(sheet).slice(0, 3);
console.log('First 3 rows:', JSON.stringify(data, null, 2));

// Check Column L specifically (Index 11)
const colLHeader = headers[11];
console.log('Column L Header:', colLHeader);
