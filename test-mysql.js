const mysql = require('mysql2/promise');

async function testConnection() {
  const connection = await mysql.createConnection({
    host: '65.109.105.125',
    user: 'cfirplak_sql',
    password: 'VjStX2XpEHOP',
    database: 'cfirplak_crmv'
  });

  const query = `
    SELECT 
        ce.createdtime AS \`Fecha de Creación\`,
        CONCAT(vu.first_name, ' ', vu.last_name) AS \`Asignado a\`,
        vp.potentialname AS \`Oportunidad\`,
        vp.sales_stage AS \`Etapa de Venta\`,
        vpcf.cf_1152 AS \`Categoría\`,
        cd.firstname AS \`Nombre Contacto\`,
        cd.lastname AS \`Apellidos Contacto\`,
        cd.mobile AS \`Whatsapp\`,
        cd.email AS \`Correo\`,
        vpcf.cf_1191 AS \`URL Optin\`,
        vpcf.cf_1193 AS \`URL Origen\`,
        vpcf.cf_1146 AS \`Origen de prospecto\`,
        vpcf.cf_1144 AS \`Conversión por\`
    FROM vtiger_potential vp
    INNER JOIN vtiger_crmentity ce 
        ON vp.potentialid = ce.crmid
        AND ce.deleted = 0
    INNER JOIN vtiger_potentialscf vpcf 
        ON vpcf.potentialid = vp.potentialid
    INNER JOIN vtiger_contactdetails cd 
        ON vp.contact_id = cd.contactid
    INNER JOIN vtiger_contactscf cdcf 
        ON cdcf.contactid = cd.contactid
    INNER JOIN vtiger_users vu 
        ON vu.id = ce.smownerid
    LIMIT 5
  `;

  try {
    const [rows, fields] = await connection.execute(query);
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error('Error executing query:', error);
  } finally {
    await connection.end();
  }
}

testConnection();
