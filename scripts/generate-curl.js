const crypto = require('crypto');
require('dotenv').config({ path: 'c:\\Users\\isaza\\OneDrive\\Documentos\\CRM FIRPLAK\\CRM\\.env' });

const pub = process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY ? process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY.trim() : '';
const priv = process.env.FORCEMANAGER_PRIVATE_KEY ? process.env.FORCEMANAGER_PRIVATE_KEY.trim() : '';
const url = 'https://api.forcemanager.com/api/v4/accounts?limit=1';

const ts = Math.floor(Date.now() / 1000).toString();
const payload = ts + pub + priv;
const sig = crypto.createHash('sha1').update(payload).digest('hex');

console.log('--- Copy and run this command ---');
console.log(`curl -v -H "Content-Type: application/json" -H "X-FM-PublicKey: ${pub}" -H "X-FM-UnixTimestamp: ${ts}" -H "X-FM-Signature: ${sig}" "${url}"`);
console.log('---------------------------------');
