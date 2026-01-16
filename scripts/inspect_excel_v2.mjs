
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../BD precios CRM.xlsx');
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];

const json = XLSX.utils.sheet_to_json(sheet, { header: 'A' }); // Use A, B, C... as keys to see exact columns
const firstRow = json[0]; // Headeers usually in row 1 if not passed in options, but lets see raw letter mapping
const secondRow = json[1]; // First data row

console.log('--- MAPPING ---');
console.log('Col A (0):', firstRow['A'], '->', secondRow['A']);
console.log('Col B (1):', firstRow['B'], '->', secondRow['B']);
console.log('Col C (2):', firstRow['C'], '->', secondRow['C']);
console.log('Col L (11):', firstRow['L'], '->', secondRow['L']);
console.log('--- END ---');
