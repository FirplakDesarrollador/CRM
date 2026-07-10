const https = require('https');

async function createSAPClient() {
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
        const cookie = loginResponse.headers.get('set-cookie') ? loginResponse.headers.get('set-cookie').split(';')[0] : `B1SESSION=${loginData.SessionId}`;

        const nit = '900123456';
        
        const cardCodes = [
            `CL ${nit}-01`,
            `CL ${nit}-00`,
            `C ${nit}-01`,
            `CL${nit}-01`,
            `CL ${nit}`
        ];

        for (const code of cardCodes) {
            console.log(`\nProbando CardCode: ${code} con FederalTaxID: ${nit}`);
            const newBp = {
                CardCode: code,
                CardName: 'Cliente Prueba IA',
                CardType: 'cCustomer',
                FederalTaxID: nit, // Mismo valor sin dígito de verificación
                U_CentrodeCtos: 'GV_SOPTE',
                Territory: 13 
            };

            const createResponse = await fetch(`${baseUrl}/BusinessPartners`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
                body: JSON.stringify(newBp),
                agent: new https.Agent({ rejectUnauthorized: false })
            });

            if (createResponse.ok) {
                const createdData = await createResponse.json();
                console.log('¡EXITO! Cliente creado:', createdData.CardCode);
                break; // Stop on success
            } else {
                const errText = await createResponse.text();
                console.log('Fallo:', errText.trim());
            }
        }
        
        await fetch(`${baseUrl}/Logout`, {
            method: 'POST',
            headers: { 'Cookie': cookie },
            agent: new https.Agent({ rejectUnauthorized: false })
        });

    } catch (error) {
        console.error('ERROR:', error.message);
    }
}

createSAPClient();
