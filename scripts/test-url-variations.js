const crypto = require('crypto');
const https = require('https');
require('dotenv').config({ path: 'c:\\Users\\isaza\\OneDrive\\Documentos\\CRM FIRPLAK\\CRM\\.env' });

const PUB = process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY ? process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY.trim() : '';
const PRIV = process.env.FORCEMANAGER_PRIVATE_KEY ? process.env.FORCEMANAGER_PRIVATE_KEY.trim() : '';
const ORG_ID = '48127';

function getHeaders(ts) {
    const signature = crypto.createHash('sha1').update(ts.toString() + PUB + PRIV).digest('hex');
    return {
        'Content-Type': 'application/json',
        'X-FM-PublicKey': PUB,
        'X-FM-UnixTimestamp': ts.toString(),
        'X-FM-Signature': signature,
    };
}

function testRequest(url, label) {
    return new Promise(resolve => {
        const ts = Math.floor(Date.now() / 1000);
        const headers = getHeaders(ts);

        console.log(`Testing [${label}]: ${url}`);
        const req = https.request(url, { method: 'GET', headers }, (res) => {
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
    const baseURLs = [
        `https://api.forcemanager.com/${ORG_ID}/api/v4/accounts?limit=1`,
        `https://api.forcemanager.com/api/v4/${ORG_ID}/accounts?limit=1`,
        `https://api.forcemanager.com/v4/${ORG_ID}/accounts?limit=1`,
        `https://${ORG_ID}.forcemanager.com/api/v4/accounts?limit=1`,
        `https://firplak.forcemanager.com/api/v4/accounts?limit=1` // Mentioned before as potential custom domain
    ];

    for (const url of baseURLs) {
        await testRequest(url, 'URL Variant');
    }
}

main();
