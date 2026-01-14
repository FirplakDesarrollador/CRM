
import { useContacts } from "@/lib/hooks/useContacts";
import { useState } from "react";
import { ContactForm } from "./ContactForm";
import { LocalContact } from "@/lib/db";
import { Edit2, Trash2, Phone, Mail, User } from "lucide-react";

interface ContactListProps {
    accountId: string;
}

export function ContactList({ accountId }: ContactListProps) {
    const { contacts, deleteContact } = useContacts(accountId);
    const [isEditing, setIsEditing] = useState(false);
    const [editingContact, setEditingContact] = useState<LocalContact | undefined>(undefined);

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
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Contactos</h3>
                <button
                    onClick={handleCreate}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                >
                    <User size={16} />
                    Nuevo Contacto
                </button>
            </div>

            {!contacts || contacts.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No hay contactos registrados.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contacts.map(contact => (
                        <div key={contact.id} className="p-4 border rounded-lg bg-white dark:bg-slate-900 shadow-sm relative group">
                            <div className="absolute top-2 right-2 flex gap-1">
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
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-900 dark:text-gray-100">{contact.nombre}</span>
                                    {contact.es_principal && (
                                        <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">Principal</span>
                                    )}
                                </div>
                                <span className="text-sm text-gray-500 dark:text-gray-400">{contact.cargo || "Sin cargo"}</span>

                                <div className="mt-2 text-sm space-y-1">
                                    {contact.email && (
                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                            <Mail size={14} />
                                            <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
                                        </div>
                                    )}
                                    {contact.telefono && (
                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                            <Phone size={14} />
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
