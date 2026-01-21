import { useState, useCallback } from 'react';
import { parseVCard, ParsedContact } from '../vcard';

export interface UseContactImportReturn {
    isNativeSupported: boolean;
    triggerNativeImport: () => Promise<ParsedContact | null>;
    parseVCardFile: (file: File) => Promise<ParsedContact | null>;
    error: string | null;
}

export function useContactImport(): UseContactImportReturn {
    const isNativeSupported = typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;
    const [error, setError] = useState<string | null>(null);

    const triggerNativeImport = useCallback(async (): Promise<ParsedContact | null> => {
        setError(null);
        if (!isNativeSupported) {
            setError("La API de Contactos no es soportada en este navegador.");
            return null;
        }

        try {
            const props = ['name', 'tel', 'email', 'address'];
            const opts = { multiple: false };

            // @ts-ignore - Navigator Contacts API types might be missing in some setups
            const contacts = await navigator.contacts.select(props, opts);

            if (contacts && contacts.length > 0) {
                const contact = contacts[0];
                // Native API returns arrays for tel/email

                const name = contact.name?.[0] || "";
                const tel = contact.tel?.[0] || "";
                const email = contact.email?.[0] || "";
                // Address is usually an object in the API, but simplified here for now
                // We might not get ORG/TITLE from standard web API easily without more granular props often not supported

                return {
                    name: name,
                    tel: tel,
                    email: email,
                    // address: contact.address?.[0]
                };
            }
        } catch (err) {
            console.error("Error picking contact:", err);
            // Don't show error if user just cancelled
            // @ts-ignore
            if (err.name !== 'AbortError' && err.name !== 'SecurityError') {
                setError("Error al importar contacto.");
            }
        }
        return null;
    }, [isNativeSupported]);

    const parseVCardFile = useCallback(async (file: File): Promise<ParsedContact | null> => {
        setError(null);
        try {
            const text = await file.text();
            return parseVCard(text);
        } catch (err) {
            console.error("Error reading file:", err);
            setError("No se pudo leer el archivo vCard.");
            return null;
        }
    }, []);

    return {
        isNativeSupported,
        triggerNativeImport,
        parseVCardFile,
        error
    };
}
