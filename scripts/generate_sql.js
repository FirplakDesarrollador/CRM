const fs = require('fs');

const matches = [
    { nombre: 'INNOVA TECNO CONSTRUCCION S A S', nit: '901466110' },
    { nombre: 'MULTINTEGRAL S A S', nit: '900418144' },
    { nombre: 'ARQUITECTURA LIVIANA S A S', nit: '816005813' },
    { nombre: 'GERENCIA DE PROYECTOS E INGENIEROS CONSTRUCTORES LTDA', nit: '900476416' },
    { nombre: 'CONSTRUCTORA EL PORTAL DE LOSANGEL LTDA', nit: '811017640' },
    { nombre: 'TORO HENAO OSCAR ALBEIRO', nit: '15512574' },
    { nombre: 'CONSUMIDOR FINAL', nit: '222222222222' },
    { nombre: 'MAYORISTA DE MATERIALES', nit: '900159362' },
    { nombre: 'SKEMA PROMOTORA S A', nit: '900180277' },
    { nombre: 'AED', nit: '901352535' },
    { nombre: 'CONSTRUCTORA Sas', nit: '901153383' },
    { nombre: 'DISTRIBUIDORA DE HIERRO Y ACERO SA', nit: '444445030' },
    { nombre: 'FLOREZ OCAMPO JUAN MANUEL EL OUTLET DE LA CERAMICA', nit: '94062505' },
    { nombre: 'HOMECENTERS ECUATORIANOS SAS - PROMART CALLE DEL ESTABLO', nit: '444445229' },
    { nombre: 'LOPEZ OSSA WILLIAM FERNANDO (CERÁMICAS CALDAS SUPIA)', nit: '1061696171' },
    { nombre: 'REPRESENTACIONES VALERO CIA LTDA', nit: '444444065' }
];

const csvContent = fs.readFileSync('cuentas_pendientes_final.csv', 'utf8').split('\n');
let sql = '-- ACTUALIZAR NITS ENCONTRADOS EN SAP\n';

for (let m of matches) {
    for (let line of csvContent) {
        if (line.includes(m.nombre)) {
            const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (parts.length >= 2) {
                const id = parts[0].replace(/"/g, '');
                sql += `UPDATE "CRM_Cuentas" SET nit_base = '${m.nit}' WHERE id = '${id}';\n`;
                break;
            }
        }
    }
}

sql += '\n-- ACTUALIZAR NITS ENCONTRADOS MANUALMENTE ANTES\n';
sql += `UPDATE "CRM_Cuentas" SET nit_base = '901108232' WHERE id = '36c43793-4632-4fdd-a2d9-26266f24f024';\n`;
sql += `UPDATE "CRM_Cuentas" SET nit_base = '900232239' WHERE id = 'f51bc8aa-b22e-4761-ace2-dc69b88b1556';\n`;
sql += `UPDATE "CRM_Cuentas" SET nit_base = '900897497' WHERE id = '294a9795-f6e9-48c2-99c1-fbb96739755e';\n`;
sql += `UPDATE "CRM_Cuentas" SET nit_base = '802014471' WHERE id = '5b430319-5acf-40f0-8d41-1c904ea4ad20';\n`;
sql += `UPDATE "CRM_Cuentas" SET nit_base = '816001249' WHERE id = 'c506b696-905f-4614-90c3-a89c4f9da5a3';\n`;
sql += `UPDATE "CRM_Cuentas" SET nit_base = '804002887' WHERE id = '6e8635d7-67a0-4939-b72a-d63119f69972';\n`;
sql += `UPDATE "CRM_Cuentas" SET nit_base = '96556470-5' WHERE id = 'f53e9e95-4626-42c3-80c8-2bce2de7e01f';\n`;

fs.writeFileSync('update_nits.sql', sql);
console.log('Script SQL generado exitosamente: update_nits.sql');
