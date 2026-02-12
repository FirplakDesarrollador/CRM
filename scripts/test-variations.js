const crypto = require('crypto');
const https = require('https');
require('dotenv').config({ path: 'c:\\Users\\isaza\\OneDrive\\Documentos\\CRM FIRPLAK\\CRM\\.env' });

const PUBLIC_KEY = process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY ? process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY.trim() : '';
const PRIVATE_KEY = process.env.FORCEMANAGER_PRIVATE_KEY ? process.env.FORCEMANAGER_PRIVATE_KEY.trim() : '';
const API_URL = 'https://api.forcemanager.com/api/v4'; // Test PROD first, user likely gave PROD keys

function getHeaders(variant, timestamp) {
    let signature;
    const ts = timestamp.toString();

    switch (variant) {
        case 'standard':
            // Standard string concatenation
            signature = crypto.createHash('sha1').update(ts + PUBLIC_KEY + PRIVATE_KEY).digest('hex');
            break;
        case 'private_hex':
            // Treat private key as hex buffer
            try {
                const buf = Buffer.concat([
                    Buffer.from(ts),
                    Buffer.from(PUBLIC_KEY),
                    Buffer.from(PRIVATE_KEY, 'hex')
                ]);
                signature = crypto.createHash('sha1').update(buf).digest('hex');
            } catch (e) { signature = 'invalid'; }
            break;
        case 'private_upper':
            // Upper case private key string
            signature = crypto.createHash('sha1').update(ts + PUBLIC_KEY + PRIVATE_KEY.toUpperCase()).digest('hex');
            break;
        case 'order_ts_priv_pub':
            signature = crypto.createHash('sha1').update(ts + PRIVATE_KEY + PUBLIC_KEY).digest('hex');
            break;
        case 'order_pub_ts_priv':
            signature = crypto.createHash('sha1').update(PUBLIC_KEY + ts + PRIVATE_KEY).digest('hex');
            break;
        case 'order_pub_priv_ts':
            signature = crypto.createHash('sha1').update(PUBLIC_KEY + PRIVATE_KEY + ts).digest('hex');
            break;
        case 'order_priv_pub_ts':
            signature = crypto.createHash('sha1').update(PRIVATE_KEY + PUBLIC_KEY + ts).digest('hex');
            break;
    }

    return {
        'Content-Type': 'application/json',
        'X-FM-PublicKey': PUBLIC_KEY,
        'X-FM-UnixTimestamp': ts,
        'X-FM-Signature': signature,
    };
}

function fetchForceManager(variant) {
    return new Promise((resolve) => {
        // Try standard timestamp (seconds)
        const timestamp = Math.floor(Date.now() / 1000);
        const headers = getHeaders(variant, timestamp);

        if (headers['X-FM-Signature'] === 'invalid') {
            resolve({ variant, success: false, status: 'SKIPPED' });
            return;
        }

        const req = https.request(`${API_URL}/accounts?limit=1`, { method: 'GET', headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ variant, success: true, status: res.statusCode });
                } else {
                    resolve({ variant, success: false, status: res.statusCode, error: data.substring(0, 50) });
                }
            });
        });

        req.on('error', (e) => resolve({ variant, success: false, error: e.message }));
        req.end();
    });
}

async function main() {
    const variants = [
        'standard',
        'private_hex',
        'private_upper',
        'order_ts_priv_pub',
        'order_pub_ts_priv',
        'order_pub_priv_ts',
        'order_priv_pub_ts'
    ];

    console.log('Testing signature variations on PROD...');
    for (const v of variants) {
        console.log(`Testing ${v}...`);
        const result = await fetchForceManager(v);
        if (result.success) {
            console.log(`✅ SUCCESS with variant: ${v}`);
            process.exit(0);
        } else {
            console.log(`❌ Failed ${v}: ${result.status} ${result.error || ''}`);
        }
        await new Promise(r => setTimeout(r, 200));
    }
    console.log('All variations failed on PROD.');
}

main();
