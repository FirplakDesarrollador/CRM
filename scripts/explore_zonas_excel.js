const XLSX = require('xlsx');
const path = require('path');

// Leer el Excel y mostrar su estructura
const filePath = path.join(__dirname, '..', 'Firplak - Zonas por asesor comercial.xlsx');
const wb = XLSX.readFile(filePath);

console.log("Hojas en el archivo:", wb.SheetNames);

wb.SheetNames.forEach(sheetName => {
    console.log(`\n=== Hoja: "${sheetName}" ===`);
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    
    // Mostrar primeras 20 filas
    data.slice(0, 20).forEach((row, i) => {
        console.log(`  Fila ${i + 1}:`, row);
    });
    
    if (data.length > 20) {
        console.log(`  ... (${data.length} filas en total)`);
    }
});
