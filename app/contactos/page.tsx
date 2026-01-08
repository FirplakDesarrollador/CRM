"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalContact } from "@/lib/db";
import { useState } from "react";
import { ContactForm } from "@/components/contactos/ContactForm";
import { Edit2, Trash2, Phone, Mail, User, Building, Search, Plus } from "lucide-react";
import { useContacts } from "@/lib/hooks/useContacts";

export default function ContactsPage() {
    const contacts = useLiveQuery(() => db.contacts.toArray());
    const accounts = useLiveQuery(() => db.accounts.toArray());
    const { deleteContact } = useContacts();

    // UI States
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [selectedAccountIdForCreate, setSelectedAccountIdForCreate] = useState<string>("");
    const [editingContact, setEditingContact] = useState<LocalContact | undefined>(undefined);

    // Derived: Filter contacts
    const filteredContacts = contacts?.filter(contact => {
        const term = searchTerm.toLowerCase();
        const account = accounts?.find(a => a.id === contact.account_id);
        const accountName = account?.nombre.toLowerCase() || "";

        return (
            contact.nombre.toLowerCase().includes(term) ||
            accountName.includes(term) ||
            (contact.email && contact.email.toLowerCase().includes(term))
        );
    });

    // Handle Edit
    const handleEdit = (contact: LocalContact) => {
        setEditingContact(contact);
    };

    // Close Modals/Forms
    const resetView = () => {
        setIsCreating(false);
        setSelectedAccountIdForCreate("");
        setEditingContact(undefined);
    };

    // --- VIEW: Create Contact Flow (Step 1: Select Account) ---
    if (isCreating && !selectedAccountIdForCreate) {
        return (
            <div className="p-6">
                <button
                    onClick={() => setIsCreating(false)}
                    className="mb-4 text-sm text-blue-600 hover:underline"
                >
                    ← Volver al listado
                </button>
                <h1 className="text-2xl font-bold mb-6">Selecciona una Cuenta</h1>
                <p className="mb-4 text-gray-600">Para crear un contacto, primero selecciona la cuenta:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {accounts?.map((acc: any) => (
                        <button
                            key={acc.id}
                            onClick={() => setSelectedAccountIdForCreate(acc.id)}
                            className="p-4 border rounded hover:bg-blue-50 text-left bg-white dark:bg-slate-800 shadow-sm transition-colors"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Building size={16} className="text-blue-500" />
                                <span className="font-bold">{acc.nombre}</span>
                            </div>
                            <div className="text-xs text-gray-500 ml-6">{acc.nit}</div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // --- VIEW: Create/Edit Form ---
    if (selectedAccountIdForCreate || editingContact) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <button
                    onClick={resetView}
                    className="mb-4 text-sm text-blue-600 hover:underline"
                >
                    ← Volver al listado
                </button>
                <ContactForm
                    accountId={editingContact ? editingContact.account_id : selectedAccountIdForCreate}
                    existingContact={editingContact}
                    onSuccess={resetView}
                    onCancel={resetView}
                />
            </div>
        );
    }

    // --- VIEW: Global List ---
    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <User size={30} />
                    Contactos
                </h1>
                <button
                    onClick={() => setIsCreating(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm"
                >
                    <Plus size={20} />
                    Nuevo Contacto
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por nombre, cuenta o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:border-slate-700"
                />
            </div>

            {/* List */}
            {(!filteredContacts || filteredContacts.length === 0) ? (
                <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-gray-300 dark:border-slate-700">
                    {searchTerm ? "No se encontraron contactos que coincidan con tu búsqueda." : "No hay contactos registrados aún."}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredContacts.map(contact => {
                        const account = accounts?.find(a => a.id === contact.account_id);
                        return (
                            <div key={contact.id} className="p-4 border rounded-lg bg-white dark:bg-slate-900 shadow-sm relative hover:shadow-md transition-shadow">
                                <div className="absolute top-2 right-2 flex gap-1">
                                    <button
                                        onClick={() => handleEdit(contact)}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded bg-blue-50/50"
                                        title="Editar"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (confirm('¿Eliminar contacto?')) deleteContact(contact.id);
                                        }}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded bg-red-50/50"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="flex flex-col gap-1 pr-16">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-lg text-gray-900 dark:text-gray-100 truncate">{contact.nombre}</span>
                                        {contact.es_principal && (
                                            <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded-full font-medium border border-green-200">Principal</span>
                                        )}
                                    </div>

                                    {/* Account Link */}
                                    <div className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 mb-2 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded w-fit">
                                        <Building size={14} />
                                        <span className="font-medium">{account?.nombre || 'Cuenta Desconocida'}</span>
                                    </div>

                                    <span className="text-sm text-gray-500 dark:text-gray-400 mb-2 truncate">{contact.cargo || "Sin cargo"}</span>

                                    <div className="mt-auto pt-3 border-t text-sm space-y-1.5">
                                        {contact.email && (
                                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                                <Mail size={14} className="shrink-0" />
                                                <a href={`mailto:${contact.email}`} className="hover:underline truncate">{contact.email}</a>
                                            </div>
                                        )}
                                        {contact.telefono && (
                                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                                <Phone size={14} className="shrink-0" />
                                                <a href={`tel:${contact.telefono}`} className="hover:underline">{contact.telefono}</a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
