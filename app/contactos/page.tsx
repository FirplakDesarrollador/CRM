"use client"; 


import { db } from "@/lib/db";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useMemo, useEffect, Suspense } from "react";
import { ContactForm } from "@/components/contactos/ContactForm";
import Link from "next/link";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { Edit2, Trash2, Phone, Mail, User, Building, Search, Plus, CloudUpload, Loader2 } from "lucide-react";
import { useContacts } from "@/lib/hooks/useContacts";
import { useContactsServer } from "@/lib/hooks/useContactsServer";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";
import dynamic from 'next/dynamic';

const HotTable = dynamic(() => import('@/components/HotTableWrapper'), { ssr: false });

function ContactsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const {
        data: contacts,
        count,
        loading,
        hasMore,
        loadMore,
        setSearchTerm,
        refresh
    } = useContactsServer({ pageSize: 50 });

    const { isAdmin } = useCurrentUser();
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

    // Preparar datos para Handsontable
    const hotData = contacts.map(contact => {
        const accountName = contact.account_name || accountMap.get(contact.account_id) || "-";
        return {
            id: contact.id,
            nombre: contact.nombre,
            cargo: contact.cargo || "Sin cargo registrado",
            principal: contact.es_principal ? "Principal" : "-",
            cuenta: accountName,
            email: contact.email || "-",
            telefono: contact.telefono || "-",
            _original: contact
        };
    });

    const hotColumns = [
        { data: 'nombre', title: 'Contacto', type: 'text', readOnly: true },
        { data: 'cargo', title: 'Cargo', type: 'text', readOnly: true },
        { data: 'principal', title: 'Principal', type: 'text', readOnly: true },
        { data: 'cuenta', title: 'Cuenta', type: 'text', readOnly: true },
        { data: 'email', title: 'Email', type: 'text', readOnly: true },
        { data: 'telefono', title: 'Teléfono', type: 'text', readOnly: true }
    ];

    if (isAdmin) {
        hotColumns.unshift({
            data: 'acciones',
            title: 'Acciones',
            renderer: function (instance: any, td: HTMLTableCellElement, row: number, col: number, prop: string, value: any, cellProperties: any) {
                td.innerHTML = `
                    <div style="text-align: center; white-space: nowrap;">
                        <button class="edit-action-btn" title="Editar" style="cursor:pointer; color:#2563eb; background:none; border:none; padding:0 4px; margin:0; display:inline-block; vertical-align:middle;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                        </button>
                        <button class="delete-action-btn" title="Eliminar" style="cursor:pointer; color:#dc2626; background:none; border:none; padding:0 4px; margin:0; display:inline-block; vertical-align:middle;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                        </button>
                    </div>
                `;
                td.className = "htCenter htMiddle";
                return td;
            },
            readOnly: true,
            width: 80
        } as any);
    }

    // --- VIEW: Global List ---
    return (
        <div data-testid="contacts-page" className="p-6 max-w-7xl mx-auto space-y-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-[#254153] p-2.5 rounded-xl text-white shadow-md shadow-[#254153]/15">
                        <User size={26} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                            Contactos
                        </h1>
                        <p className="text-sm text-slate-500 font-medium hidden sm:block">
                            Directorio y gestión de contactos
                        </p>
                    </div>
                </div>
                <button
                    data-testid="contacts-create-button"
                    onClick={() => setIsCreating(true)}
                    className="w-full md:w-auto px-4 py-2.5 bg-[#254153] text-white rounded-lg hover:bg-[#1a2f3d] flex items-center justify-center gap-2 shadow-sm transition-all font-bold"
                >
                    <Plus size={18} />
                    Nuevo Contacto
                </button>
            </div>

            <div className="relative group rounded-xl border border-slate-200 bg-white shadow-sm">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-[#254153] transition-colors" size={18} />
                <input
                    type="text"
                    data-testid="contacts-search"
                    placeholder="Buscar por nombre, cuenta o email..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-transparent transition-all outline-none text-slate-700 font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-[#254153]/10"
                />
            </div>

            {/* List */}
            {(!loading || contacts.length > 0) && (
                <div className="flex items-center justify-end mb-3 px-1 z-10">
                    <span className="text-sm font-medium text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                        Total de registros: <strong className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">{count !== undefined && count !== null ? count : contacts.length}</strong>
                    </span>
                </div>
            )}
            {(loading && contacts.length === 0) ? (
                <div data-testid="contacts-loading" className="space-y-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse border border-slate-200" />
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
                    <div data-testid="contacts-list" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="w-full relative z-0" style={{ minHeight: '400px' }}>
                            <HotTable
                                data={hotData}
                                columns={hotColumns}
                                rowHeaders={true}
                                colHeaders={true}
                                filters={true}
                                dropdownMenu={true}
                                width="100%"
                                height="calc(100vh - 280px)"
                                autoColumnSize={false}
                                autoRowSize={false}
                                rowHeights={38}
                                renderAllRows={false}
                                licenseKey="non-commercial-and-evaluation"
                                afterOnCellMouseDown={(event, coords, td) => {
                                    if (coords.row >= 0) {
                                        const contact = hotData[coords.row]._original;
                                        const target = event.target as HTMLElement;
                                        
                                        if (target.closest('.delete-action-btn')) {
                                            setContactToDelete(contact);
                                            return;
                                        }
                                        
                                        if (target.closest('.edit-action-btn')) {
                                            handleEdit(contact);
                                            return;
                                        }
                                        
                                        handleEdit(contact);
                                    }
                                }}
                                stretchH="all"
                                className="text-sm font-sans"
                            />
                        </div>
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
