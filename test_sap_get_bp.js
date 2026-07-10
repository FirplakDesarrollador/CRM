const https = require('https');

async function getExistingBP() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    const baseUrl = 'https://200.7.96.194:50000/b1s/v1';

    try {
        console.log('1. Iniciando sesión en SAP Service Layer...');
        const loginResponse = await fetch(`${baseUrl}/Login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                CompanyDB: 'Firplak_SA',
                Password: 'Firplak25*',
                UserName: 'iisaza'
            }),
            agent: new https.Agent({ rejectUnauthorized: false })
        });

        const loginData = await loginResponse.json();
        const setCookieHeader = loginResponse.headers.get('set-cookie');
        const cookie = setCookieHeader ? setCookieHeader.split(';')[0] : `B1SESSION=${loginData.SessionId}`;

        console.log('2. Obteniendo un Socio de Negocio existente...');
        const bpResponse = await fetch(`${baseUrl}/BusinessPartners?$top=5`, {
            method: 'GET',
            headers: { 'Cookie': cookie },
            agent: new https.Agent({ rejectUnauthorized: false })
        });

        const bpData = await bpResponse.json();
        
        if (bpData.value && bpData.value.length > 0) {
            console.log('\n--- PROPIEDADES DE UN BP EXISTENTE ---');
            const bp = bpData.value[0];
            
            // Print all fields that have string values
            for (const key in bp) {
                if (typeof bp[key] === 'string' && bp[key].length > 0) {
                    console.log(`${key}: ${bp[key]}`);
                }
            }
            console.log('\n--- FIN PROPIEDADES ---');
        } else {
            console.log('No se encontraron socios de negocio.');
        }
        
    } catch (error) {
        console.error('ERROR:', error.message);
    }
}

getExistingBP();
