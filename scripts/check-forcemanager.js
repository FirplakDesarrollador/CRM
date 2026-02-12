const crypto = require('crypto');
const https = require('https');
require('dotenv').config({ path: 'c:\\Users\\isaza\\OneDrive\\Documentos\\CRM FIRPLAK\\CRM\\.env' });

const PUBLIC_KEY = process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY;
const PRIVATE_KEY = process.env.FORCEMANAGER_PRIVATE_KEY;
const API_URL = 'https://api.forcemanager.com/api/v4';

function getForceManagerHeaders() {
    if (!PUBLIC_KEY || !PRIVATE_KEY) {
        throw new Error('Force Manager credentials not found in environment variables');
    }

    // Standard seconds
    const timestamp = Math.floor(Date.now() / 1000).toString();
    console.log('Timestamp being sent:', timestamp);
    const signaturePayload = timestamp + PUBLIC_KEY + PRIVATE_KEY;
    const signature = crypto.createHash('sha1').update(signaturePayload).digest('hex');

    return {
        'Content-Type': 'application/json',
        'X-FM-PublicKey': PUBLIC_KEY,
        'X-FM-UnixTimestamp': timestamp,
        'X-FM-Signature': signature,
    };
}

function fetchForceManager(endpoint) {
    return new Promise((resolve, reject) => {
        const headers = getForceManagerHeaders();
        const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${API_URL}${normalizedEndpoint}`;

        console.log(`Fetching ${url}...`);
        // console.log('Headers:', JSON.stringify(headers, null, 2));

        const options = {
            method: 'GET',
            headers: headers
        };

        const req = https.request(url, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log('### SERVER DATE:', res.headers.date);
                console.log('### LOCAL DATE:', new Date().toUTCString());
                console.log('### LOCAL TIMESTAMP:', Math.floor(Date.now() / 1000));
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${e.message}`));
                    }
                } else {
                    reject(new Error(`Force Manager API Error: ${res.statusCode} ${res.statusMessage} - ${data}`));
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.end();
    });
}

async function main() {
    console.log('Testing Force Manager API connection...');
    try {
        const data = await fetchForceManager('/accounts?limit=1');
        console.log('✅ Connection successful!');
        console.log('Sample data:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        process.exit(1);
    }
}

main();
