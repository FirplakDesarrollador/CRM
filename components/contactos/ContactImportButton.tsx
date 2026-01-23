import { useState } from 'react';
import { Smartphone, Upload } from 'lucide-react';
import { useContactImport } from '@/lib/hooks/useContactImport';
import { ParsedContact } from '@/lib/vcard';
import { VCardImportModal } from './VCardImportModal';

interface ContactImportButtonProps {
    onContactImported: (contact: ParsedContact) => void;
}

export function ContactImportButton({ onContactImported }: ContactImportButtonProps) {
    const { isNativeSupported, triggerNativeImport } = useContactImport();
    const [showModal, setShowModal] = useState(false);

    const handleClick = async () => {
        if (isNativeSupported) {
            const contact = await triggerNativeImport();
            if (contact) {
                onContactImported(contact);
            }
        } else {
            setShowModal(true);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={handleClick}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                title={isNativeSupported ? "Importar desde la agenda del teléfono" : "Importar archivo vCard"}
            >
                {isNativeSupported ? <Smartphone className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                <span>Importar desde Teléfono</span>
            </button>

            <VCardImportModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onImport={onContactImported}
            />
        </>
    );
}
