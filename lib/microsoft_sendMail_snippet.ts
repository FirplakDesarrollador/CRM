import { supabase } from './supabase';
import crypto from 'crypto';

/**
 * Send an email using Microsoft Graph API, with an optional attachment.
 */
export async function sendMicrosoftEmail(accessToken: string, emailDetails: {
    toRecipients: string[];
    subject: string;
    body: string;
    attachment?: {
        name: string;
        contentBytes: string; // Base64 encoded string
    };
}) {
    if (!accessToken) throw new Error('Access token is required');

    console.log(`[Microsoft API] Sending email: ${emailDetails.subject}...`);

    const message: any = {
        message: {
            subject: emailDetails.subject,
            body: {
                contentType: 'HTML',
                content: emailDetails.body
            },
            toRecipients: emailDetails.toRecipients.map(email => ({
                emailAddress: { address: email }
            }))
        },
        saveToSentItems: 'true'
    };

    if (emailDetails.attachment) {
        message.message.attachments = [
            {
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: emailDetails.attachment.name,
                contentType: 'application/pdf',
                contentBytes: emailDetails.attachment.contentBytes
            }
        ];
    }

    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
    });

    if (!response.ok) {
        let errorText = await response.text();
        try {
            const jsonError = JSON.parse(errorText);
            console.error('[Microsoft API] Error sending email:', response.status, jsonError);
            throw new Error(jsonError.error?.message || `Graph API returned ${response.status}`);
        } catch(e: any) {
            console.error('[Microsoft API] Error sending email:', response.status, errorText);
            throw new Error(e.message || `Graph API returned ${response.status}: ${errorText}`);
        }
    }

    return true;
}
