const crypto = require('crypto');
const https = require('https');
require('dotenv').config({ path: 'c:\\Users\\isaza\\OneDrive\\Documentos\\CRM FIRPLAK\\CRM\\.env' });

const PUBLIC_KEY = process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY;
const PRIVATE_KEY = process.env.FORCEMANAGER_PRIVATE_KEY;
// Using Sandbox for safety/testing
const API_URL = 'https://sandbox-api.forcemanager.com/api/v4';

function getForceManagerHeaders(timestamp) {
    if (!PUBLIC_KEY || !PRIVATE_KEY) {
        throw new Error('Force Manager credentials not found');
    }

    const signaturePayload = timestamp + PUBLIC_KEY + PRIVATE_KEY;
    const signature = crypto.createHash('sha1').update(signaturePayload).digest('hex');

    return {
        'Content-Type': 'application/json',
        'X-FM-PublicKey': PUBLIC_KEY,
        'X-FM-UnixTimestamp': timestamp,
        'X-FM-Signature': signature,
    };
}

function fetchForceManager(offset) {
    return new Promise((resolve, reject) => {
        const now = Math.floor(Date.now() / 1000);
        const timestamp = (now + offset).toString();
        const headers = getForceManagerHeaders(timestamp);

        // Only check headers authentication, no need to fetch full body if auth fails
        const url = `${API_URL}/accounts?limit=1`;

        const options = {
            method: 'GET',
            headers: headers
        };

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, offset, text: 'OK' });
                } else {
                    resolve({ success: false, offset, status: res.statusCode, data: data.substring(0, 100) });
                }
            });
        });

        req.on('error', (e) => {
            resolve({ success: false, offset, error: e.message });
        });

        req.end();
    });
}

async function main() {
    console.log('Brute forcing timestamp offset...');
    const offsets = [];
    // From -4000 to +4000 in steps of 600 (10 mins)
    for (let i = -7200; i <= 7200; i += 300) { // +/- 2 hours, step 5 mins
        offsets.push(i);
    }

    for (const offset of offsets) {
        console.log(`Trying offset: ${offset}s...`);
        const result = await fetchForceManager(offset);
        if (result.success) {
            console.log(`✅ SUCCESS at offset ${offset}s!`);
            process.exit(0);
        } else {
            console.log(`❌ Failed at offset ${offset}: ${result.status} ${result.data}`);
        }
        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 200));
    }
    console.log('Finished brute force.');
}

main();
