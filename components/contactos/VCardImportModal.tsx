import { useState, useRef } from 'react';
import { Upload, X, FileText, AlertCircle } from 'lucide-react';
import { ParsedContact } from '@/lib/vcard';
import { useContactImport } from '@/lib/hooks/useContactImport';

interface VCardImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (contact: ParsedContact) => void;
}

export function VCardImportModal({ isOpen, onClose, onImport }: VCardImportModalProps) {
    const { parseVCardFile, error: hookError } = useContactImport();
    const [dragActive, setDragActive] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFile = async (file: File) => {
        setLocalError(null);
        if (!file.name.toLowerCase().endsWith('.vcf') && !file.type.includes('vcard')) {
            setLocalError("Por favor selecciona un archivo .vcf válido.");
            return;
        }

        const contact = await parseVCardFile(file);
        if (contact) {
            if (!contact.name && !contact.tel && !contact.email) {
                setLocalError("No se encontraron datos de contacto válidos en el archivo.");
            } else {
                onImport(contact);
                onClose();
            }
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const onButtonClick = () => {
        inputRef.current?.click();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center p-4 border-b dark:border-slate-800">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Importar Contacto (vCard)</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    <div
                        className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                            ${dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={onButtonClick}
                    >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                            <Upload className="w-10 h-10 mb-3 text-slate-400" />
                            <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                                <span className="font-semibold">Haz clic para subir</span> o arrastra y suelta
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Archivos .VCF (vCard)</p>
                        </div>
                        <input
                            ref={inputRef}
                            type="file"
                            className="hidden"
                            accept=".vcf,text/vcard"
                            onChange={handleChange}
                        />
                    </div>

                    {(localError || hookError) && (
                        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span>{localError || hookError}</span>
                        </div>
                    )}

                    <div className="mt-6 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                        <p className="font-medium">¿Cómo obtener un vCard?</p>
                        <p>• <span className="font-semibold">iPhone:</span> Abre Contactos → Selecciona uno → Compartir Contacto → Guardar en Archivos.</p>
                        <p>• <span className="font-semibold">Android:</span> Abre Contactos → Compartir → Guardar como .vcf.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
