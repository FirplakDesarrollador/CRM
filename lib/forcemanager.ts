import crypto from 'crypto';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY;
const PRIVATE_KEY = process.env.FORCEMANAGER_PRIVATE_KEY;
// Default to production, but allow override via environment variable
const API_URL = process.env.FORCEMANAGER_API_URL || 'https://api.forcemanager.com/api/v4';

interface ForceManagerHeaders {
    'Content-Type': string;
    'X-FM-PublicKey': string;
    'X-FM-UnixTimestamp': string;
    'X-FM-Signature': string;
}

export function getForceManagerHeaders(): ForceManagerHeaders {
    if (!PUBLIC_KEY || !PRIVATE_KEY) {
        throw new Error('Force Manager credentials not found in environment variables');
    }

    const pub = PUBLIC_KEY.trim();
    const priv = PRIVATE_KEY.trim();

    // Current Unix Timestamp in seconds (Standard)
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Signature = SHA1(timestamp + publicKey + privateKey)
    const signaturePayload = timestamp + pub + priv;
    const signature = crypto.createHash('sha1').update(signaturePayload).digest('hex');

    return {
        'Content-Type': 'application/json',
        'X-FM-PublicKey': pub,
        'X-FM-UnixTimestamp': timestamp,
        'X-FM-Signature': signature,
    };
}

export async function fetchForceManager(endpoint: string, options: RequestInit = {}) {
    const headers = getForceManagerHeaders();

    // Ensure endpoint starts with slash if not provided
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_URL}${normalizedEndpoint}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            ...headers,
            ...options.headers,
        },
    });

    if (!response.ok) {
        // Try to parse JSON error if possible
        let errorMessage = `Force Manager API Error: ${response.status} ${response.statusText}`;
        try {
            const errorBody = await response.json();
            if (errorBody.error) {
                errorMessage += ` - ${errorBody.error}`;
            } else {
                errorMessage += ` - ${JSON.stringify(errorBody)}`;
            }
        } catch (e) {
            // Fallback to text
            const errorText = await response.text();
            errorMessage += ` - ${errorText}`;
        }

        throw new Error(errorMessage);
    }

    return response.json();
}

/**
 * Checks connection to Force Manager API.
 * Returns true if successful, false otherwise.
 * Useful for health checks or initial setup verification.
 */
export async function checkConnection() {
    try {
        // Fetch a single account to verify auth
        await fetchForceManager('/accounts?limit=1');
        return true;
    } catch (error) {
        console.error('Force Manager Connection Check Failed:', error);
        return false;
    }
}
