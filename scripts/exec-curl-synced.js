const crypto = require('crypto');
const { exec } = require('child_process');
const https = require('https');
require('dotenv').config({ path: 'c:\\Users\\isaza\\OneDrive\\Documentos\\CRM FIRPLAK\\CRM\\.env' });

const pub = process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY ? process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY.trim() : '';
const priv = process.env.FORCEMANAGER_PRIVATE_KEY ? process.env.FORCEMANAGER_PRIVATE_KEY.trim() : '';
const url = 'https://api.forcemanager.com/api/v4/accounts?limit=1';

function runCurl(offset) {
    return new Promise(resolve => {
        const ts = (Math.floor(Date.now() / 1000) + offset).toString();
        const payload = ts + pub + priv;
        const sig = crypto.createHash('sha1').update(payload).digest('hex');

        const cmd = `curl -s -v -H "Content-Type: application/json" -H "X-FM-PublicKey: ${pub}" -H "X-FM-UnixTimestamp: ${ts}" -H "X-FM-Signature: ${sig}" "${url}"`;

        console.log(`[Offset ${offset}s] Running: ${cmd.substring(0, 50)}...`);

        exec(cmd, (error, stdout, stderr) => {
            if (stdout.includes('"error":')) {
                console.log(`❌ FAIL [Offset ${offset}s]: ${stdout.substring(0, 100)}`);
                resolve(false);
            } else if (stdout.length > 0) {
                console.log(`✅ SUCCESS [Offset ${offset}s]: ${stdout.substring(0, 100)}`);
                resolve(true);
            } else {
                console.log(`❓ UNKNOWN [Offset ${offset}s]: ${stderr.substring(0, 100)}`);
                resolve(false);
            }
        });
    });
}

async function main() {
    // 1. Get server time
    const start = Date.now();
    https.request('https://api.forcemanager.com/api/v4/accounts', { method: 'HEAD' }, async (res) => {
        const serverDate = new Date(res.headers.date);
        const end = Date.now();
        const latency = (end - start) / 2;
        const now = Date.now(); // local

        // Calculate offset in seconds
        // Server time - Local time
        const timeDiff = Math.floor((serverDate.getTime() - now) / 1000);
        console.log(`Server Time Diff: ${timeDiff}s`);

        // Try exact sync
        await runCurl(timeDiff);

        // Try exact sync - 1s
        await runCurl(timeDiff - 1);

        // Try exact sync + 1s
        await runCurl(timeDiff + 1);

        // Try UTC+1 (add 3600s)
        await runCurl(timeDiff + 3600);

        // Try local time (standard)
        await runCurl(0);

    }).end();
}

main();
