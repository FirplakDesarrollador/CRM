import { useContacts } from "@/lib/hooks/useContacts";
import { useState } from "react";
import { ContactForm } from "./ContactForm";
import { LocalContact } from "@/lib/db";
import { Edit2, Trash2, Phone, Mail, User, Search } from "lucide-react";

interface ContactListProps {
    accountId: string;
}

export function ContactList({ accountId }: ContactListProps) {
    const { contacts, deleteContact } = useContacts(accountId);
    const [isEditing, setIsEditing] = useState(false);
    const [editingContact, setEditingContact] = useState<LocalContact | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState("");

    const handleEdit = (contact: LocalContact) => {
        setEditingContact(contact);
        setIsEditing(true);
    };

    const handleCreate = () => {
        setEditingContact(undefined);
        setIsEditing(true);
    };

    const handleSuccess = () => {
        setIsEditing(false);
        setEditingContact(undefined);
    };

    // Filter contacts based on search term
    const filteredContacts = contacts?.filter(contact => {
        if (!searchTerm) return true;
        const lowerTerm = searchTerm.toLowerCase();
        return (
            contact.nombre.toLowerCase().includes(lowerTerm) ||
            (contact.cargo && contact.cargo.toLowerCase().includes(lowerTerm)) ||
            (contact.email && contact.email.toLowerCase().includes(lowerTerm)) ||
            (contact.telefono && contact.telefono.toLowerCase().includes(lowerTerm))
        );
    });

    if (isEditing) {
        return (
            <ContactForm
                accountId={accountId}
                existingContact={editingContact}
                onSuccess={handleSuccess}
                onCancel={() => setIsEditing(false)}
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-lg font-semibold">Contactos</h3>
                <div className="flex flex-1 w-full sm:w-auto sm:justify-end gap-2">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                            placeholder="Buscar contactos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handleCreate}
                        className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 whitespace-nowrap"
                    >
                        <User size={16} />
                        <span className="hidden sm:inline">Nuevo</span>
                    </button>
                </div>
            </div>

            {!filteredContacts || filteredContacts.length === 0 ? (
                <div className="text-center py-8 text-gray-500 italic bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed">
                    {searchTerm ? "No se encontraron contactos que coincidan con tu búsqueda." : "No hay contactos registrados."}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredContacts.map(contact => (
                        <div key={contact.id} className="group p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm relative hover:shadow-lg hover:border-[#254153]/20 transition-all duration-300 flex flex-col h-full">
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <button
                                    onClick={() => handleEdit(contact)}
                                    className="p-2 text-blue-600 hover:bg-blue-600 hover:text-white bg-blue-50 rounded-xl transition-all shadow-sm"
                                    title="Editar"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm('¿Eliminar contacto?')) deleteContact(contact.id);
                                    }}
                                    className="p-2 text-red-600 hover:bg-red-600 hover:text-white bg-red-50 rounded-xl transition-all shadow-sm"
                                    title="Eliminar"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-3 flex-1">
                                <div className="space-y-1 pr-16">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-extrabold text-slate-900 dark:text-slate-100 truncate" title={contact.nombre}>
                                            {contact.nombre}
                                        </span>
                                        {contact.es_principal && (
                                            <span className="bg-emerald-50 text-emerald-700 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-emerald-100">
                                                Principal
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-tight uppercase tracking-tight">
                                        {contact.cargo || "Sin cargo registrado"}
                                    </span>
                                </div>

                                <div className="mt-auto space-y-2.5 pt-4 border-t border-slate-50 dark:border-slate-800">
                                    {contact.email && (
                                        <a
                                            href={`mailto:${contact.email}`}
                                            className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300 hover:text-[#254153] transition-colors group/link"
                                        >
                                            <Mail size={13} className="text-slate-400 group-hover/link:text-blue-500 shrink-0" />
                                            <span className="text-sm font-medium truncate" title={contact.email}>{contact.email}</span>
                                        </a>
                                    )}
                                    {contact.telefono && (
                                        <a
                                            href={`tel:${contact.telefono}`}
                                            className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300 hover:text-[#254153] transition-colors group/link"
                                        >
                                            <Phone size={13} className="text-slate-400 group-hover/link:text-emerald-500 shrink-0" />
                                            <span className="text-sm font-medium">{contact.telefono}</span>
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
