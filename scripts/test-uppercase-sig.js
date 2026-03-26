const crypto = require('crypto');
const https = require('https');
require('dotenv').config({ path: 'c:\\Users\\isaza\\OneDrive\\Documentos\\CRM FIRPLAK\\CRM\\.env' });

const PUBLIC_KEY = process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY ? process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY.trim() : '';
const PRIVATE_KEY = process.env.FORCEMANAGER_PRIVATE_KEY ? process.env.FORCEMANAGER_PRIVATE_KEY.trim() : '';
const API_URL = 'https://api.forcemanager.com/api/v4';

function testRequest(url, headers) {
    return new Promise(resolve => {
        const req = https.request(url, { method: 'GET', headers }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode < 300) {
                    console.log(`✅ SUCCESS! Body: ${data.substring(0, 100)}`);
                    resolve(true);
                } else {
                    console.log(`❌ FAIL Status: ${res.statusCode} Body: ${data.substring(0, 100)}`);
                    resolve(false);
                }
            });
        });
        req.end();
    });
}

async function main() {
    const ts = Math.floor(Date.now() / 1000).toString();
    const signature = crypto.createHash('sha1').update(ts + PUBLIC_KEY + PRIVATE_KEY).digest('hex');

    console.log('Testing Uppercase Signature...');
    const headers = {
        'X-FM-PublicKey': PUBLIC_KEY,
        'X-FM-UnixTimestamp': ts,
        'X-FM-Signature': signature.toUpperCase(), // Try Uppercase
        'Content-Type': 'application/json'
    };

    await testRequest(`${API_URL}/accounts?limit=1`, headers);
}

main();
