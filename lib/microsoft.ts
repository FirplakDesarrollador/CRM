import { supabase } from './supabase';
import crypto from 'crypto';

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common';
const REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

const SCOPES = [
    'offline_access',
    'openid',
    'profile',
    'email',
    'Tasks.ReadWrite',
    'Tasks.ReadWrite.Shared',
    'Group.Read.All',
    'Calendars.ReadWrite'
].join(' ');

// Encryption helper
const algorithm = 'aes-256-cbc';

function encrypt(text: string) {
    if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY not set');
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string) {
    if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY not set');
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

export function getMicrosoftAuthUrl(userId: string) {
    const params = new URLSearchParams({
        client_id: CLIENT_ID!,
        response_type: 'code',
        redirect_uri: REDIRECT_URI!,
        response_mode: 'query',
        scope: SCOPES,
        state: userId, // Pass userId as state to verify callback
    });

    return `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
    const params = new URLSearchParams({
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        code: code,
        redirect_uri: REDIRECT_URI!,
        grant_type: 'authorization_code',
        scope: SCOPES,
    });

    const response = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('[Microsoft] Token exchange error:', error);
        throw new Error(error.error_description || 'Failed to exchange code for tokens');
    }

    return response.json();
}

export async function refreshMicrosoftToken(userId: string, refreshToken: string, supabaseClient = supabase) {
    const params = new URLSearchParams({
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: SCOPES,
    });

    const response = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('[Microsoft] Token refresh error:', error);
        throw new Error(error.error_description || 'Failed to refresh token');
    }

    const data = await response.json();

    // Store new tokens
    await storeMicrosoftTokens(userId, data, supabaseClient);

    return data;
}

export async function storeMicrosoftTokens(userId: string, tokenData: any, supabaseClient = supabase) {
    const { access_token, refresh_token, id_token, expires_in, scope } = tokenData;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    const { error } = await supabaseClient
        .from('CRM_MicrosoftTokens')
        .upsert({
            user_id: userId,
            access_token: encrypt(access_token),
            refresh_token: refresh_token ? encrypt(refresh_token) : null,
            id_token: id_token ? encrypt(id_token) : null,
            expires_at: expiresAt,
            scope: scope,
            updated_at: new Date().toISOString(),
        });

    if (error) throw error;
}

export async function getMicrosoftTokens(userId: string, supabaseClient = supabase) {
    const { data, error } = await supabaseClient
        .from('CRM_MicrosoftTokens')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error || !data) return null;

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(data.expires_at);

    if (now >= expiresAt && data.refresh_token) {
        console.log('[Microsoft] Token expired, refreshing...');
        return refreshMicrosoftToken(userId, decrypt(data.refresh_token), supabaseClient);
    }

    return {
        access_token: decrypt(data.access_token),
        refresh_token: data.refresh_token ? decrypt(data.refresh_token) : null,
        expires_at: data.expires_at,
        scope: data.scope,
    };
}
