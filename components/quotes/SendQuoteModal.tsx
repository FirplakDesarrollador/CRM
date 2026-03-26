"use client";

import { useState } from "react";
import { Mail, Send, X, AlertTriangle, Loader2 } from "lucide-react";
import { useContacts } from "@/lib/hooks/useContacts";
import { useActivities } from "@/lib/hooks/useActivities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SendQuoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    quote: any;
    account: any;
    opportunity: any;
    quoteItems: any[];
}

export function SendQuoteModal({ isOpen, onClose, quote, account, opportunity, quoteItems }: SendQuoteModalProps) {
    const { contacts } = useContacts(account?.id);
    const { createActivity } = useActivities();
    
    const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
    const [manualEmail, setManualEmail] = useState("");
    const [subject, setSubject] = useState(`Cotización ${quote.numero_cotizacion || 'Borrador'} - ${account?.nombre || ''}`);
    const [body, setBody] = useState(`Estimado cliente,\n\nAdjunto le enviamos la cotización ${quote.numero_cotizacion || 'Borrador'} para su revisión.\n\nQuedamos atentos a cualquier duda o comentario.\n\nSaludos cordiales.`);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const allContacts = contacts?.filter(c => c.email) || [];
    
    const toggleEmail = (email: string) => {
        if (selectedEmails.includes(email)) {
            setSelectedEmails(prev => prev.filter(e => e !== email));
        } else {
            setSelectedEmails(prev => [...prev, email]);
        }
    };

    const addManualEmail = () => {
        if (!manualEmail) return;
        const emailOptions = manualEmail.split(/[,;\s]+/).map(e => e.trim()).filter(e => e.includes('@'));
        
        const newEmails = emailOptions.filter(e => !selectedEmails.includes(e));
        if (newEmails.length > 0) {
            setSelectedEmails(prev => [...prev, ...newEmails]);
        }
        setManualEmail("");
    };

    const handleSend = async () => {
        if (selectedEmails.length === 0) {
            setError("Debe especificar al menos un destinatario.");
            return;
        }

        setIsSending(true);
        setError(null);

        try {
            // 1. Generate PDF in base64
            const { generateQuotePdf } = await import("@/lib/pdfGenerator");
            const base64Pdf = await generateQuotePdf(quote, quoteItems, account, opportunity, false);

            if (!base64Pdf) {
                throw new Error("No se pudo generar el PDF de la cotización.");
            }

            // 2. Send via Outlook API
            const response = await fetch('/api/microsoft/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toRecipients: selectedEmails,
                    subject,
                    emailBody: body,
                    attachment: {
                        name: `Cotizacion_${quote.numero_cotizacion || 'Borrador'}.pdf`,
                        contentBytes: base64Pdf
                    }
                })
            });

            if (!response.ok) {
                const data = await response.json();
                if (response.status === 400 && data.error === 'Microsoft account not connected') {
                    throw new Error("No tienes una cuenta de Microsoft conectada. Por favor, conéctala desde tu perfil (Configuración de la cuenta).");
                }
                throw new Error(data.error || "Error al enviar el correo a través de Outlook.");
            }

            // 3. Register activity
            await createActivity({
                tipo_actividad: 'TAREA',
                asunto: `Envío de Cotización ${quote.numero_cotizacion || 'Borrador'}`,
                descripcion: `Cotización enviada a: ${selectedEmails.join(', ')}\n\nCuerpo del mensaje:\n${body}`,
                is_completed: true,
                opportunity_id: opportunity?.id,
                account_id: account?.id,
                fecha_inicio: new Date().toISOString()
            });

            // 4. Close success
            onClose();
            // Could add a toast notification here
            alert("Cotización enviada exitosamente vía Outlook.");
            
        } catch (err: any) {
            console.error("Error sending quote:", err);
            setError(err.message || "Ocurrió un error inesperado al enviar la cotización.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Mail className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">Enviar Cotización</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100">
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {/* Destinatarios */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-700">Destinatarios</label>
                        
                        {/* Selector manual */}
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Escribe un email y presiona 'Agregar'" 
                                value={manualEmail}
                                onChange={e => setManualEmail(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManualEmail(); } }}
                                className="flex-1"
                            />
                            <Button type="button" variant="secondary" onClick={addManualEmail}>
                                Agregar
                            </Button>
                        </div>

                        {/* Emails seleccionados */}
                        {selectedEmails.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2">
                                {selectedEmails.map(email => (
                                    <span key={email} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-sm">
                                        {email}
                                        <button onClick={() => toggleEmail(email)} className="hover:text-amber-600 focus:outline-none">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Sugerencias de contactos de la cuenta */}
                        {allContacts.length > 0 && (
                            <div className="pt-2">
                                <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Contactos de la cuenta</p>
                                <div className="space-y-1">
                                    {allContacts.map(contact => (
                                        <label key={contact.id} className="cursor-pointer flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 transition-all">
                                            <input 
                                                type="checkbox"
                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" 
                                                checked={contact.email ? selectedEmails.includes(contact.email) : false}
                                                onChange={() => contact.email && toggleEmail(contact.email)}
                                            />
                                            <div className="text-sm">
                                                <span className="font-semibold text-slate-900">{contact.nombre}</span>
                                                {contact.cargo && <span className="text-slate-500 text-xs ml-2">({contact.cargo})</span>}
                                                <div className="text-slate-500">{contact.email}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Asunto */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Asunto</label>
                        <Input 
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            placeholder="Asunto del correo"
                        />
                    </div>

                    {/* Mensaje */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Cuerpo del Mensaje</label>
                        <textarea 
                            rows={8}
                            value={body}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
                            className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                            placeholder="Redacta el mensaje aquí..."
                        />
                    </div>

                    {/* Adjuntos Preview */}
                    <div className="pt-4 border-t border-slate-100">
                        <p className="text-sm font-bold text-slate-700 mb-2">Archivo Adjunto</p>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3">
                            <div className="p-2 bg-red-100 text-red-600 rounded-md">
                                <Mail className="w-5 h-5 shrink-0" /> {/* Should ideally be a File icon, using Mail for reference */}
                            </div>
                            <div className="text-sm font-medium text-slate-800">Cotizacion_{quote.numero_cotizacion || 'Borrador'}.pdf</div>
                            <div className="text-xs text-slate-500 ml-auto">(Generado Automáticamente)</div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
                    <Button variant="outline" onClick={onClose} disabled={isSending}>
                        Cancelar
                    </Button>
                    <Button 
                        onClick={handleSend}
                        disabled={isSending || selectedEmails.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]"
                    >
                        {isSending ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4 mr-2" />
                                Enviar
                            </>
                        )}
                    </Button>
                </div>

            </div>
        </div>
    );
}

