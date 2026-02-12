const crypto = require('crypto');
const https = require('https');
require('dotenv').config({ path: 'c:\\Users\\isaza\\OneDrive\\Documentos\\CRM FIRPLAK\\CRM\\.env' });

const PUB = process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY ? process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY.trim() : '';
const PRIV = process.env.FORCEMANAGER_PRIVATE_KEY ? process.env.FORCEMANAGER_PRIVATE_KEY.trim() : '';
const ORG_ID = '48127';
const API_URL = 'https://api.forcemanager.com/api/v4';

function getHeaders(ts) {
    const signature = crypto.createHash('sha1').update(ts.toString() + PUB + PRIV).digest('hex');
    return {
        'Content-Type': 'application/json',
        'X-FM-PublicKey': PUB,
        'X-FM-UnixTimestamp': ts.toString(),
        'X-FM-Signature': signature,
    };
}

function testRequest(label, headers) {
    return new Promise(resolve => {
        const req = https.request(`${API_URL}/accounts?limit=1`, { method: 'GET', headers }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode < 300) {
                    console.log(`✅ SUCCESS [${label}]`);
                    resolve(true);
                } else {
                    console.log(`❌ FAIL [${label}] Status: ${res.statusCode} Body: ${data.substring(0, 100)}`);
                    resolve(false);
                }
            });
        });
        req.end();
    });
}

async function main() {
    console.log(`Testing Organization ID: ${ORG_ID}`);
    const ts = Math.floor(Date.now() / 1000);

    // 1. Header: X-OrganizationId
    const h1 = getHeaders(ts);
    h1['X-OrganizationId'] = ORG_ID;
    await testRequest('Header: X-OrganizationId', h1);

    // 2. Header: X-PF-OrganizationId (variation)
    const h2 = getHeaders(ts);
    h2['X-PF-OrganizationId'] = ORG_ID;
    await testRequest('Header: X-PF-OrganizationId', h2);

    // 3. Header: X-CompanyId (variation)
    const h3 = getHeaders(ts);
    h3['X-CompanyId'] = ORG_ID;
    await testRequest('Header: X-CompanyId', h3);

    // 4. URL param: organizationId
    const h4 = getHeaders(ts);
    // Modified URL for this test
    const urlWithParam = `${API_URL}/accounts?limit=1&organizationId=${ORG_ID}`;
    /* ... ignoring implementation detail for quick check via testRequest modification ... */
    // Just testing headers for now as per research
}

main();
