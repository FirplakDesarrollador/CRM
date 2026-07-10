const https = require('https');

async function getExistingBPAddresses() {
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
        const cookie = `B1SESSION=${loginData.SessionId}`;

        console.log('2. Obteniendo direcciones de un Socio de Negocio existente...');
        const bpResponse = await fetch(`${baseUrl}/BusinessPartners('AC 22449174-01')`, {
            method: 'GET',
            headers: { 'Cookie': cookie },
            agent: new https.Agent({ rejectUnauthorized: false })
        });

        const bpData = await bpResponse.json();
        
        if (bpData.BPAddresses && bpData.BPAddresses.length > 0) {
            console.log('\n--- DIRECCIONES DEL BP ---');
            console.log(JSON.stringify(bpData.BPAddresses, null, 2));
            console.log('\n--- FIN DIRECCIONES ---');
        } else {
            console.log('No se encontraron direcciones.');
        }
        
    } catch (error) {
        console.error('ERROR:', error.message);
    }
}

getExistingBPAddresses();
