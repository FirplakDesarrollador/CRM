const https = require('https');
require('dotenv').config({ path: 'c:\\Users\\isaza\\OneDrive\\Documentos\\CRM FIRPLAK\\CRM\\.env' });

const PUBLIC_KEY = process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY ? process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY.trim() : '';

const API_URL = 'https://api.forcemanager.com/api/v4';

function testRequest(headers) {
    return new Promise(resolve => {
        const req = https.request(`${API_URL}/accounts?limit=1`, { method: 'GET', headers }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                console.log(`Body: ${data}`);
                resolve(true);
            });
        });
        req.end();
    });
}

async function main() {
    console.log('Testing Garbage Signature...');
    const ts = Math.floor(Date.now() / 1000).toString();
    const headers = {
        'Content-Type': 'application/json',
        'X-FM-PublicKey': PUBLIC_KEY,
        'X-FM-UnixTimestamp': ts,
        'X-FM-Signature': 'THIS_IS_TOTAL_GARBAGE', // Deliberately invalid
    };

    await testRequest(headers);
}

main();
