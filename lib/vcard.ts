/**
 * Simple vCard parser
 */
export interface ParsedContact {
    name: string;
    firstName?: string;
    lastName?: string;
    tel?: string;
    email?: string;
    org?: string;
    title?: string;
    address?: string; // Formatted address
}

export function parseVCard(vcard: string): ParsedContact {
    const lines = vcard.split(/\r\n|\r|\n/);
    const result: ParsedContact = { name: "" };

    for (const line of lines) {
        if (!line.includes(':')) continue;

        const [keyPart, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim(); // Re-join in case value has colons (urls etc)

        // keyPart can have params like TEL;TYPE=CELL
        const [key, ...params] = keyPart.split(';');

        switch (key.toUpperCase()) {
            case 'FN': // Full Name
                result.name = value;
                break;
            case 'N': // Structured Name: Surname;Given Name;...
                if (!result.name) {
                    const parts = value.split(';');
                    result.lastName = parts[0] || "";
                    result.firstName = parts[1] || "";
                    result.name = `${result.firstName} ${result.lastName}`.trim();
                }
                break;
            case 'TEL':
                if (!result.tel) result.tel = value; // Take first phone found
                break;
            case 'EMAIL':
                if (!result.email) result.email = value; // Take first email found
                break;
            case 'ORG':
                result.org = value.split(';')[0]; // Sometimes ORG is split by semicolon
                break;
            case 'TITLE':
                result.title = value;
                break;
        }
    }
    return result;
}
