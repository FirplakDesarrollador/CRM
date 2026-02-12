require('dotenv').config({ path: 'c:\\Users\\isaza\\OneDrive\\Documentos\\CRM FIRPLAK\\CRM\\.env' });

const pub = process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY;
const priv = process.env.FORCEMANAGER_PRIVATE_KEY;

console.log('--- Key Inspection ---');
console.log(`Public Key Length: ${pub ? pub.length : 'N/A'}`);
console.log(`Public Key (quoted): "${pub}"`);
console.log(`Private Key Length: ${priv ? priv.length : 'N/A'}`);
console.log(`Private Key (quoted): "${priv}"`);

if (pub && pub.trim() !== pub) {
    console.log('⚠️ WARNING: Public key has leading/trailing whitespace!');
}
if (priv && priv.trim() !== priv) {
    console.log('⚠️ WARNING: Private key has leading/trailing whitespace!');
}

const crypto = require('crypto');
// Generate a sample signature to see what it looks like
const ts = Math.floor(Date.now() / 1000).toString();
const payload = ts + (pub ? pub.trim() : '') + (priv ? priv.trim() : '');
const sig = crypto.createHash('sha1').update(payload).digest('hex');

console.log(` Sample Signature (TS=${ts}): ${sig}`);
