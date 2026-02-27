const crypto = require('crypto');
const https = require('https');
require('dotenv').config({ path: 'c:\\Users\\isaza\\OneDrive\\Documentos\\CRM FIRPLAK\\CRM\\.env' });

const PUBLIC_KEY = process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY ? process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY.trim() : '';
const PRIVATE_KEY = process.env.FORCEMANAGER_PRIVATE_KEY ? process.env.FORCEMANAGER_PRIVATE_KEY.trim() : '';
const API_URL = 'https://api.forcemanager.com/api/v4';

function getHeaders(ts) {
    const signature = crypto.createHash('sha1').update(ts.toString() + PUBLIC_KEY + PRIVATE_KEY).digest('hex');
    return {
        'X-FM-PublicKey': PUBLIC_KEY,
        'X-FM-UnixTimestamp': ts.toString(),
        'X-FM-Signature': signature,
        'Content-Type': 'application/json'
    };
}

function attempt(timestamp) {
    return new Promise(resolve => {
        console.log(`Attempting with timestamp: ${timestamp}`);
        const headers = getHeaders(timestamp);
        const req = https.request(`${API_URL}/accounts?limit=1`, { method: 'GET', headers }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode < 300) {
                    console.log(`✅ SUCCESS! Body: ${data.substring(0, 100)}`);
                    resolve(true);
                } else {
                    console.log(`❌ FAIL Status: ${res.statusCode} Body: ${data}`);
                    resolve(false);
                }
            });
        });
        req.end();
    });
}

async function main() {
    // 1. Get Server Time
    console.log('Fetching server time...');
    https.request(`${API_URL}/accounts`, { method: 'HEAD' }, async (res) => {
        const serverDate = new Date(res.headers.date);
        console.log('Server Date:', serverDate.toUTCString());

        // Calculate server timestamp in seconds
        const serverTs = Math.floor(serverDate.getTime() / 1000);

        // Try a range around server time: [-2, +2]
        // This covers T, T-1, T-2, T+1, T+2
        for (let offset = -2; offset <= 2; offset++) {
            const ts = serverTs + offset;
            await attempt(ts);
        }

        // Try also UTC+1 logic? (ServerTs + 3600)
        console.log('Trying UTC+1 interpretation...');
        for (let offset = -2; offset <= 2; offset++) {
            const ts = serverTs + 3600 + offset;
            await attempt(ts);
        }
    }).end();
}

main();
