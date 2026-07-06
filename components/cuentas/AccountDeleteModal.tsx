import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Trash2, Loader2, Building, Users, Briefcase } from 'lucide-react';
import { useOpportunities } from '@/lib/hooks/useOpportunities';
import { useContacts } from '@/lib/hooks/useContacts';
import { cn } from '@/components/ui/utils';

interface AccountDeleteModalProps {
    account: any;
    onClose: () => void;
    onConfirm: (accountId: string) => Promise<void>;
}

export function AccountDeleteModal({ account, onClose, onConfirm }: AccountDeleteModalProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    
    const { contacts, deleteContact } = useContacts(account.id);
    const { opportunities, deleteOpportunity } = useOpportunities();

    // Filter opportunities for this specific account
    const accountOpportunities = (opportunities || []).filter(o => o.account_id === account.id && !o.is_deleted);
    // Filter out deleted contacts locally just in case
    const accountContacts = (contacts || []).filter(c => !c.is_deleted);

    const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

    const handleDeleteContact = async (id: string) => {
        try {
            setDeletingItemId(id);
            await deleteContact(id);
        } catch (error) {
            console.error("Error al eliminar contacto:", error);
            alert("No se pudo eliminar el contacto.");
        } finally {
            setDeletingItemId(null);
        }
    };

    const handleDeleteOpportunity = async (id: string) => {
        try {
            setDeletingItemId(id);
            await deleteOpportunity(id);
        } catch (error: any) {
            console.error("Error al eliminar oportunidad:", error);
            alert(error.message || "No se pudo eliminar la oportunidad.");
        } finally {
            setDeletingItemId(null);
        }
    };

    const handleConfirm = async () => {
        if (accountOpportunities.length > 0 || accountContacts.length > 0) return;
        
        try {
            setIsDeleting(true);
            await onConfirm(account.id);
            onClose();
        } catch (error) {
            console.error("Error deleting account:", error);
            alert("Ocurrió un error al eliminar la cuenta.");
            setIsDeleting(false);
        }
    };

    const hasRelations = accountOpportunities.length > 0 || accountContacts.length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="bg-red-50 p-5 border-b border-red-100 flex items-start justify-between">
                    <div className="flex gap-3">
                        <div className="p-2 bg-red-100 text-red-600 rounded-lg shrink-0">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-red-900">Eliminar Cuenta</h2>
                            <p className="text-sm text-red-700 mt-1">
                                ¿Estás seguro que quieres eliminar la cuenta <span className="font-bold">{account.nombre}</span>?
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={isDeleting} className="p-2 text-red-400 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    {hasRelations ? (
                        <div className="space-y-6">
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm flex gap-3">
                                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                                <p>Esta cuenta tiene registros asociados. <strong>Debes eliminarlos individualmente</strong> antes de poder eliminar la cuenta.</p>
                            </div>

                            {/* Oportunidades */}
                            {accountOpportunities.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Briefcase className="w-4 h-4 text-slate-400" /> 
                                        Oportunidades ({accountOpportunities.length})
                                    </h3>
                                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                                        {accountOpportunities.map(opp => (
                                            <div key={opp.id} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors group">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-800 text-sm">{opp.nombre}</span>
                                                    <span className="text-xs text-slate-500">
                                                        Monto: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(opp.amount || 0)}
                                                    </span>
                                                </div>
                                                <button
                                                    disabled={deletingItemId === opp.id}
                                                    onClick={() => handleDeleteOpportunity(opp.id)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Eliminar Oportunidad"
                                                >
                                                    {deletingItemId === opp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Contactos */}
                            {accountContacts.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Users className="w-4 h-4 text-slate-400" /> 
                                        Contactos ({accountContacts.length})
                                    </h3>
                                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                                        {accountContacts.map(contact => (
                                            <div key={contact.id} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors group">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                                                        {contact.nombre}
                                                        {contact.es_principal && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold">PRINCIPAL</span>}
                                                    </span>
                                                    <span className="text-xs text-slate-500">{contact.cargo || "Sin cargo"}</span>
                                                </div>
                                                <button
                                                    disabled={deletingItemId === contact.id}
                                                    onClick={() => handleDeleteContact(contact.id)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Eliminar Contacto"
                                                >
                                                    {deletingItemId === contact.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="py-8 flex flex-col items-center justify-center text-center">
                            <Building className="w-16 h-16 text-slate-200 mb-4" />
                            <h3 className="text-lg font-medium text-slate-900">Listo para eliminar</h3>
                            <p className="text-slate-500 max-w-sm mt-2">Esta cuenta no tiene contactos ni oportunidades asociadas. Puedes proceder a eliminarla de forma segura.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-xl transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={hasRelations || isDeleting}
                        className={cn(
                            "px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-sm flex items-center gap-2 transition-all",
                            hasRelations || isDeleting 
                                ? "bg-slate-300 cursor-not-allowed" 
                                : "bg-red-600 hover:bg-red-700 active:scale-95"
                        )}
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        {isDeleting ? 'Eliminando...' : 'Eliminar Cuenta'}
                    </button>
                </div>
            </div>
        </div>
    );
}
