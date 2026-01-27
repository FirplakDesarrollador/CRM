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
                        <div key={contact.id} className="p-4 border rounded-lg bg-white dark:bg-slate-900 shadow-sm relative group hover:border-blue-300 transition-colors">
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleEdit(contact)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                    title="Editar"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm('¿Eliminar contacto?')) deleteContact(contact.id);
                                    }}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                    title="Eliminar"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 pr-16">
                                    <span className="font-bold text-gray-900 dark:text-gray-100 truncate" title={contact.nombre}>{contact.nombre}</span>
                                    {contact.es_principal && (
                                        <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Principal</span>
                                    )}
                                </div>
                                <span className="text-sm text-gray-500 dark:text-gray-400">{contact.cargo || "Sin cargo"}</span>

                                <div className="mt-3 text-sm space-y-1.5 pt-3 border-t border-gray-100 dark:border-gray-800">
                                    {contact.email && (
                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                            <Mail size={14} className="text-gray-400" />
                                            <a href={`mailto:${contact.email}`} className="hover:underline truncate" title={contact.email}>{contact.email}</a>
                                        </div>
                                    )}
                                    {contact.telefono && (
                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                            <Phone size={14} className="text-gray-400" />
                                            <a href={`tel:${contact.telefono}`} className="hover:underline">{contact.telefono}</a>
                                        </div>
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
