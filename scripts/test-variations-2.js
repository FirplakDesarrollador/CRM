const crypto = require('crypto');
const https = require('https');
require('dotenv').config({ path: 'c:\\Users\\isaza\\OneDrive\\Documentos\\CRM FIRPLAK\\CRM\\.env' });

const PUB = process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY ? process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY.trim() : '';
const PRIV = process.env.FORCEMANAGER_PRIVATE_KEY ? process.env.FORCEMANAGER_PRIVATE_KEY.trim() : '';

// Function to generate headers
function makeHeaders(pub, priv, ts, includeContentType) {
    const signature = crypto.createHash('sha1').update(ts.toString() + pub + priv).digest('hex');
    const headers = {
        'X-FM-PublicKey': pub,
        'X-FM-UnixTimestamp': ts.toString(),
        'X-FM-Signature': signature,
    };
    if (includeContentType) headers['Content-Type'] = 'application/json';
    return headers;
}

function testRequest(url, headers, label) {
    return new Promise(resolve => {
        const req = https.request(url, { method: 'GET', headers }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode < 300) {
                    console.log(`✅ SUCCESS [${label}]`);
                    resolve(true);
                } else {
                    console.log(`❌ FAIL [${label}] Status: ${res.statusCode} Body: ${data.substring(0, 50)}`);
                    resolve(false);
                }
            });
        });
        req.on('error', e => {
            console.log(`❌ ERROR [${label}] ${e.message}`);
            resolve(false);
        });
        req.end();
    });
}

async function main() {
    const ts = Math.floor(Date.now() / 1000);
    const tsPlus3600 = ts + 3600;

    const urls = [
        'https://api.forcemanager.com/api/v4/accounts?limit=1',
        'https://sandbox-api.forcemanager.com/api/v4/accounts?limit=1'
    ];

    for (const url of urls) {
        const envName = url.includes('sandbox') ? 'SANDBOX' : 'PROD';
        console.log(`--- Testing ${envName} ---`);

        // 1. Standard
        await testRequest(url, makeHeaders(PUB, PRIV, ts, true), 'Standard');

        // 2. Standard No Content-Type
        await testRequest(url, makeHeaders(PUB, PRIV, ts, false), 'NoContentType');

        // 3. T+3600
        await testRequest(url, makeHeaders(PUB, PRIV, tsPlus3600, true), 'Plus3600');

        // 4. Swap Keys
        await testRequest(url, makeHeaders(PRIV, PUB, ts, true), 'SwapKeys');

        // 5. Swap Keys + Plus3600
        await testRequest(url, makeHeaders(PRIV, PUB, tsPlus3600, true), 'SwapKeys_Plus3600');
    }
}

main();
