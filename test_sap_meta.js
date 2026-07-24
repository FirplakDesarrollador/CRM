const https = require('https');
const fs = require('fs');

async function checkMetadata() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignore self-signed certs

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
        const cookie = loginResponse.headers.get('set-cookie')?.split(';')[0] || `B1SESSION=${loginData.SessionId}`;

        console.log('2. Fetching metadata...');
        const metaResponse = await fetch(`${baseUrl}/$metadata`, {
            method: 'GET',
            headers: { 'Cookie': cookie },
            agent: new https.Agent({ rejectUnauthorized: false })
        });

        const metaText = await metaResponse.text();
        fs.writeFileSync('sap_metadata.xml', metaText);
        console.log('Metadata saved to sap_metadata.xml');

    } catch (error) {
        console.error('ERROR:', error.message);
    }
}

checkMetadata();
