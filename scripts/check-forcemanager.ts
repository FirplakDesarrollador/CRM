import crypto from 'crypto';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY;
const PRIVATE_KEY = process.env.FORCEMANAGER_PRIVATE_KEY;
const API_URL = 'https://api.forcemanager.com/api/v4';

interface ForceManagerHeaders {
    'Content-Type': string;
    'X-FM-PublicKey': string;
    'X-FM-UnixTimestamp': string;
    'X-FM-Signature': string;
}

function getForceManagerHeaders(): ForceManagerHeaders {
    if (!PUBLIC_KEY || !PRIVATE_KEY) {
        throw new Error('Force Manager credentials not found in environment variables');
    }

    // Current Unix Timestamp in seconds (UTC)
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Signature = SHA1(timestamp + publicKey + privateKey)
    const signaturePayload = timestamp + PUBLIC_KEY + PRIVATE_KEY;
    const signature = crypto.createHash('sha1').update(signaturePayload).digest('hex');

    return {
        'Content-Type': 'application/json',
        'X-FM-PublicKey': PUBLIC_KEY,
        'X-FM-UnixTimestamp': timestamp,
        'X-FM-Signature': signature,
    };
}

async function fetchForceManager(endpoint: string, options: RequestInit = {}) {
    const headers = getForceManagerHeaders();

    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_URL}${normalizedEndpoint}`;

    console.log(`Fetching ${url}...`);
    console.log('Headers:', JSON.stringify(headers, null, 2));

    const response = await fetch(url, {
        ...options,
        headers: {
            ...headers,
            ...options.headers,
        },
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Force Manager API Error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return response.json();
}

async function main() {
    console.log('Testing Force Manager API connection...');
    try {
        const data = await fetchForceManager('/accounts?limit=1');
        console.log('✅ Connection successful!', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ Connection failed:', error);
        process.exit(1);
    }
}

main();
