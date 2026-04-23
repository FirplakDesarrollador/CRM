"use client"; 


import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalContact } from "@/lib/db";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useMemo, useEffect, Suspense, useCallback } from "react";
import { ContactForm } from "@/components/contactos/ContactForm";
import Link from "next/link";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { Edit2, Trash2, Phone, Mail, User, Building, Search, Plus, CloudUpload, Loader2 } from "lucide-react";
import { useContacts } from "@/lib/hooks/useContacts";
import { useContactsServer } from "@/lib/hooks/useContactsServer";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { supabase } from "@/lib/supabase";

function ContactsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const {
        data: contacts,
        loading,
        hasMore,
        loadMore,
        setSearchTerm,
        refresh
    } = useContactsServer({ pageSize: 12 });

    const { accounts } = useAccounts();
    const { deleteContact } = useContacts();

    // UI States
    const [inputValue, setInputValue] = useState(() => {
        const fromUrl = searchParams.get('search');
        if (fromUrl) return fromUrl;
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('crm_contactos_state');
            if (saved) return new URLSearchParams(saved).get('search') || "";
        }
        return "";
    });
    const [isCreating, setIsCreating] = useState(false);
    const [selectedAccountIdForCreate, setSelectedAccountIdForCreate] = useState<string>("");
    const [accountSearchTerm, setAccountSearchTerm] = useState("");
    const [editingContact, setEditingContact] = useState<any>(undefined);

    // Deep linking for edit: Automatically fetch and open contact by ID from URL
    useEffect(() => {
        const id = searchParams.get('id');
        if (!id) return;

        const findAndOpen = async () => {
            // 1. Check if already in current list
            const existing = contacts.find(c => c.id === id);
            if (existing) {
                setEditingContact(existing);
                setIsCreating(false);
                return;
            }

            // 2. Try local IndexedDB
            try {
                const localContact = await db.contacts.get(id);
                if (localContact) {
                    setEditingContact(localContact);
                    setIsCreating(false);
                    return;
                }
            } catch (e) {
                console.warn("[ContactsPage] local DB fetch failed", e);
            }

            // 3. Fallback to Supabase
            try {
                const { data: contact, error } = await supabase
                    .from('CRM_Contactos')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (contact && !error) {
                    setEditingContact(contact);
                    setIsCreating(false);
                }
            } catch (err) {
                console.error("Error fetching contact for deep link:", err);
            }
        };

        findAndOpen();
    }, [searchParams, contacts]);

    // Restore state from sessionStorage if navigating from sidebar (empty query)
    useEffect(() => {
        if (typeof window !== 'undefined' && searchParams.toString() === '') {
            const savedState = sessionStorage.getItem('crm_contactos_state');
            if (savedState) {
                router.replace(`/contactos?${savedState}`, { scroll: false });
            }
        }
    }, [searchParams, router]);

    // Modal State
    const [contactToDelete, setContactToDelete] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!contactToDelete) return;
        setIsDeleting(true);
        try {
            await deleteContact(contactToDelete.id);
            setContactToDelete(null);
            refresh();
        } catch (error) {
            console.error("Error deleting contact:", error);
        } finally {
            setIsDeleting(false);
        }
    };

    // PERF FIX: Build account lookup Map once (O(m)) instead of .find() per contact (O(n*m))
    const accountMap = useMemo(() => {
        const map = new Map<string, string>();
        accounts?.forEach((a: any) => map.set(a.id, a.nombre));
        return map;
    }, [accounts]);

    // Handle Search Debounce & URL Sync
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchTerm(inputValue);
            
            // Sync to URL to persist across "back" navigations
            const params = new URLSearchParams(Array.from(searchParams.entries()));
            if (inputValue) params.set('search', inputValue);
            else params.delete('search');
            
            const queryString = params.toString();
            
            // Save to sessionStorage for cross-module persistence
            if (queryString) {
                sessionStorage.setItem('crm_contactos_state', queryString);
            } else if (searchParams.toString() !== '') {
                sessionStorage.removeItem('crm_contactos_state');
            }

            const query = queryString ? `?${queryString}` : window.location.pathname;
            router.replace(query.startsWith('?') ? `${window.location.pathname}${query}` : query, { scroll: false });
        }, 500);
        return () => clearTimeout(timer);
    }, [inputValue, searchParams, setSearchTerm, router]);

    // Handle Edit
    const handleEdit = (contact: any) => {
        setEditingContact(contact);

        // Sync to URL immediately for selection persistence
        const params = new URLSearchParams(Array.from(searchParams.entries()));
        params.set('id', contact.id);
        const queryString = params.toString();
        sessionStorage.setItem('crm_contactos_state', queryString);
        router.replace(`${window.location.pathname}?${queryString}`, { scroll: false });

        document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Close Modals/Forms
    const resetView = () => {
        setIsCreating(false);
        setSelectedAccountIdForCreate("");
        setEditingContact(undefined);
        refresh();

        // Clear ID from URL
        const params = new URLSearchParams(Array.from(searchParams.entries()));
        params.delete('id');
        const queryString = params.toString();
        if (queryString) {
            sessionStorage.setItem('crm_contactos_state', queryString);
        } else {
            sessionStorage.removeItem('crm_contactos_state');
        }
        router.replace(queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname, { scroll: false });
    };

    // Filtered accounts for selection
    const filteredAccounts = useMemo(() => {
        if (!accounts) return [];
        if (!accountSearchTerm) return accounts;
        const term = accountSearchTerm.toLowerCase();
        return accounts.filter((acc: any) => 
            acc.nombre?.toLowerCase().includes(term) || 
            acc.nit?.toLowerCase().includes(term)
        );
    }, [accounts, accountSearchTerm]);

    // --- VIEW: Create Contact Flow (Step 1: Select Account) ---
    if (isCreating && !selectedAccountIdForCreate) {
        return (
            <div className="p-6 max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col gap-4">
                    <button
                        onClick={() => setIsCreating(false)}
                        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#254153] transition-colors w-fit"
                    >
                        <Plus className="rotate-45" size={16} />
                        Volver al listado
                    </button>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="bg-[#254153] p-3 rounded-2xl text-white shadow-lg shadow-[#254153]/20">
                                <Building size={32} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                                    Selecciona una Cuenta
                                </h1>
                                <p className="text-slate-500 font-medium">Elige la empresa vinculada al nuevo contacto</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Account Search Bar */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-[#254153] transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar cuenta por nombre o NIT..."
                        value={accountSearchTerm}
                        onChange={(e) => setAccountSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-[#254153]/5 focus:border-[#254153] bg-white transition-all outline-none text-slate-700 font-medium placeholder:text-slate-400"
                    />
                </div>

                {filteredAccounts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                            <Building size={40} className="text-slate-300" />
                        </div>
                        <p className="text-lg font-bold text-slate-600">No se encontraron cuentas</p>
                        <p className="text-sm">Prueba con otro término de búsqueda</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredAccounts.map((acc: any) => (
                            <button
                                key={acc.id}
                                onClick={() => setSelectedAccountIdForCreate(acc.id)}
                                className="group p-5 bg-white border border-slate-200 rounded-2xl hover:border-[#254153] hover:shadow-xl hover:shadow-slate-200/50 transition-all text-left relative flex flex-col gap-3"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-slate-50 p-2 rounded-xl group-hover:bg-[#254153]/5 transition-colors">
                                        <Building size={18} className="text-[#254153]" />
                                    </div>
                                    <span className="font-extrabold text-slate-900 group-hover:text-[#254153] transition-colors">{acc.nombre}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 ml-10">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">NIT: {acc.nit || 'Sin NIT'}</span>
                                </div>
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="bg-[#254153] text-white p-1.5 rounded-lg">
                                        <Plus size={16} />
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // --- VIEW: Create/Edit Form ---
    if (selectedAccountIdForCreate || editingContact) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                    <button
                        onClick={resetView}
                        className="text-sm text-blue-600 hover:underline"
                    >
                        ← Volver al listado
                    </button>
                    {(editingContact || selectedAccountIdForCreate) && (
                        <Link
                            href={`/cuentas?id=${editingContact ? editingContact.account_id : selectedAccountIdForCreate}`}
                            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors"
                        >
                            <Building size={12} />
                            Ver Cuenta: {editingContact?.account_name || accountMap.get(editingContact?.account_id || selectedAccountIdForCreate) || 'Cuenta'}
                        </Link>
                    )}
                </div>
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
        <div data-testid="contacts-page" className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="bg-[#254153] p-3 rounded-2xl text-white shadow-lg shadow-[#254153]/20">
                        <User size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                            Contactos
                        </h1>
                        <p className="text-slate-500 font-medium">Gestiona tu red de contactos y clientes</p>
                    </div>
                </div>
                <button
                    data-testid="contacts-create-button"
                    onClick={() => setIsCreating(true)}
                    className="w-full md:w-auto px-6 py-3 bg-[#254153] text-white rounded-xl hover:bg-[#1a2f3d] flex items-center justify-center gap-2 shadow-xl shadow-[#254153]/10 transition-all hover:scale-[1.02] active:scale-[0.98] font-bold"
                >
                    <Plus size={20} />
                    Nuevo Contacto
                </button>
            </div>

            {/* Total Count */}
            {!loading && contacts && contacts.length > 0 && (
                <p className="text-sm text-slate-500 font-medium">
                    Mostrando {contacts.length} contactos
                </p>
            )}

            {/* Search Bar */}
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-[#254153] transition-colors" size={20} />
                <input
                    type="text"
                    data-testid="contacts-search"
                    placeholder="Buscar por nombre, cuenta o email..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-[#254153]/5 focus:border-[#254153] bg-white transition-all outline-none text-slate-700 font-medium placeholder:text-slate-400"
                />
            </div>

            {/* List */}
            {(loading && contacts.length === 0) ? (
                <div data-testid="contacts-loading" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-48 bg-slate-100 rounded-2xl animate-pulse border border-slate-200" />
                    ))}
                </div>
            ) : (!contacts || contacts.length === 0) ? (
                <div data-testid="contacts-empty-state" className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                        <User size={40} className="text-slate-300" />
                    </div>
                    <p className="text-lg font-bold text-slate-600">
                        {inputValue ? "No se encontraron coincidencias" : "No hay contactos registrados"}
                    </p>
                    <p className="text-sm">{inputValue ? "Prueba con otros términos de búsqueda" : "Empieza por añadir tu primer contacto"}</p>
                </div>
            ) : (
                <>
                    <div data-testid="contacts-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {contacts.map(contact => {
                            const accountName = contact.account_name || accountMap.get(contact.account_id);
                            return (
                                <div 
                                    key={contact.id} 
                                    data-testid={`contacts-row-${contact.id}`} 
                                    onClick={() => handleEdit(contact)}
                                    className="group bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 relative flex flex-col h-full cursor-pointer"
                                >
                                    {/* Actions Overlay */}
                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        <button
                                            data-testid={`contacts-edit-${contact.id}`}
                                            onClick={(e) => { e.stopPropagation(); handleEdit(contact); }}
                                            className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm"
                                            title="Editar"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            data-testid={`contacts-delete-${contact.id}`}
                                            onClick={(e) => { e.stopPropagation(); setContactToDelete(contact); }}
                                            className="p-2 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-sm"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <div className="flex flex-col gap-4 flex-1">
                                        {/* Account Link */}
                                        <Link
                                            href={`/cuentas?id=${contact.account_id}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex items-center gap-1.5 text-sm text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-xl w-fit hover:bg-blue-100 transition-all cursor-pointer group/acc border border-blue-100 shadow-sm"
                                        >
                                            <Building size={14} className="group-hover/acc:scale-110 transition-transform" />
                                            <span className="font-bold truncate max-w-[200px]">{accountName || 'Cuenta Desconocida'}</span>
                                        </Link>

                                        <div className="space-y-1 pr-16 relative">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-extrabold text-xl text-slate-900 leading-tight">
                                                    {contact.nombre}
                                                </span>
                                                {contact.es_principal && (
                                                    <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider border border-emerald-100">
                                                        Principal
                                                    </span>
                                                )}
                                                {contact._hasPendingSync && (
                                                    <div className="absolute -top-1 -right-1 bg-amber-100 text-amber-600 rounded-full p-0.5 animate-pulse" title="Sincronizando cambios...">
                                                        <CloudUpload className="w-3 h-3" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs uppercase tracking-tight">
                                                <span className="truncate">{contact.cargo || "Sin cargo registrado"}</span>
                                            </div>
                                        </div>

                                        {/* Contact Details */}
                                        <div className="space-y-3 mt-auto pt-4 border-t border-slate-50">
                                            {contact.email && (
                                                <a
                                                    href={`mailto:${contact.email}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="flex items-center gap-3 text-slate-600 hover:text-[#254153] transition-colors group/link"
                                                >
                                                    <div className="bg-slate-100 p-2 rounded-lg group-hover/link:bg-blue-50 transition-colors">
                                                        <Mail size={14} className="text-slate-400 group-hover/link:text-blue-500" />
                                                    </div>
                                                    <span className="text-sm font-medium truncate">{contact.email}</span>
                                                </a>
                                            )}
                                            {contact.telefono && (
                                                <a
                                                    href={`tel:${contact.telefono}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="flex items-center gap-3 text-slate-600 hover:text-[#254153] transition-colors group/link"
                                                >
                                                    <div className="bg-slate-100 p-2 rounded-lg group-hover/link:bg-emerald-50 transition-colors">
                                                        <Phone size={14} className="text-slate-400 group-hover/link:text-emerald-500" />
                                                    </div>
                                                    <span className="text-sm font-medium">{contact.telefono}</span>
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {hasMore && (
                        <div className="flex justify-center mt-12 mb-8">
                            <button
                                onClick={loadMore}
                                disabled={loading}
                                className="flex items-center gap-2 px-8 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                            >
                                {loading && <Loader2 size={16} className="animate-spin" />}
                                {loading ? "Cargando..." : "Cargar más contactos"}
                            </button>
                        </div>
                    )}
                </>
            )}

            <ConfirmationModal
                isOpen={!!contactToDelete}
                onClose={() => setContactToDelete(null)}
                onConfirm={handleDelete}
                title="Eliminar Contacto"
                message={`¿Estás seguro de que deseas eliminar a ${contactToDelete?.nombre}?`}
                confirmLabel="Eliminar"
                variant="danger"
                isLoading={isDeleting}
            />
        </div>
    );
}

export default function ContactsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando aplicación...</div>}>
            <ContactsContent />
        </Suspense>
    );
}
