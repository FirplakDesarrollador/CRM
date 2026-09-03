"use client"; 


import { db } from "@/lib/db";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
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
import { AccountCombobox } from "@/components/accounts/AccountCombobox";
import { ArrowUpDown, ChevronDown, ChevronUp, X } from "lucide-react";
import { DataListToolbar } from "@/components/ui/DataListToolbar";

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
        setAccountFilter,
        setPrincipalFilter,
        setSortField,
        setSortAsc,
        sortField,
        sortAsc,
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
    const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>(() => searchParams.get('account') || (typeof window !== 'undefined' ? new URLSearchParams(sessionStorage.getItem('crm_contactos_state') || '').get('account') || '' : ''));
    const [principalFilter, setPrincipalFilterState] = useState<'all' | 'principal' | 'secondary'>(() => (searchParams.get('principal') as any) || 'all');
    const [showFilters, setShowFilters] = useState(() => Boolean(searchParams.get('account') || searchParams.get('principal')));
    const [selectedAccountIdForCreate, setSelectedAccountIdForCreate] = useState<string>("");
    const [accountSearchTerm, setAccountSearchTerm] = useState("");
    const [editingContact, setEditingContact] = useState<any>(undefined);

    // Deep linking for edit: Automatically fetch and open contact by ID from URL
    useEffect(() => {
        const id = searchParams.get('id');
        if (!id) {
            setEditingContact((prev: unknown) => (prev ? undefined : prev));
            return;
        }

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
                const savedParams = new URLSearchParams(savedState);
                savedParams.delete('id'); // Nunca restaurar el ID (para no abrir el modal directamente sin querer al navegar)
                const restoredState = savedParams.toString();
                if (restoredState !== '') {
                    router.replace(`/contactos?${restoredState}`, { scroll: false });
                } else {
                    sessionStorage.removeItem('crm_contactos_state');
                }
            }
        }
    }, [searchParams, router]);

    const handleSort = (field: 'updated_at' | 'nombre' | 'email') => {
        if (sortField === field) setSortAsc(!sortAsc);
        else {
            setSortField(field);
            setSortAsc(true);
        }
    };

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
            if (selectedAccountFilter) params.set('account', selectedAccountFilter); else params.delete('account');
            if (principalFilter !== 'all') params.set('principal', principalFilter); else params.delete('principal');
            if (sortField !== 'updated_at') params.set('sort', sortField); else params.delete('sort');
            if (sortAsc) params.set('dir', 'asc'); else params.delete('dir');
            
            const queryString = params.toString();
            
            // Evitar bucles infinitos
            const paramsForCompare = new URLSearchParams(queryString);
            paramsForCompare.sort();
            const currentParamsForCompare = new URLSearchParams(searchParams.toString());
            currentParamsForCompare.sort();
            
            if (paramsForCompare.toString() === currentParamsForCompare.toString()) return;
            
            // Save to sessionStorage without ID for cross-module persistence
            const storageParams = new URLSearchParams(params);
            storageParams.delete('id');
            const storageQuery = storageParams.toString();
            if (storageQuery) {
                sessionStorage.setItem('crm_contactos_state', storageQuery);
            } else if (searchParams.toString() !== '') {
                sessionStorage.removeItem('crm_contactos_state');
            }

            const query = queryString ? `?${queryString}` : window.location.pathname;
            router.replace(query.startsWith('?') ? `${window.location.pathname}${query}` : query, { scroll: false });
        }, 500);
        return () => clearTimeout(timer);
    }, [inputValue, selectedAccountFilter, principalFilter, sortField, sortAsc, searchParams, setSearchTerm, router]);

    useEffect(() => {
        const saved = new URLSearchParams(typeof window !== 'undefined' ? sessionStorage.getItem('crm_contactos_state') || '' : '');
        const account = searchParams.get('account') || saved.get('account') || '';
        const principal = (searchParams.get('principal') || saved.get('principal') || 'all') as 'all' | 'principal' | 'secondary';
        const sort = (searchParams.get('sort') || saved.get('sort')) as 'updated_at' | 'nombre' | 'email' | null;
        const direction = searchParams.get('dir') || saved.get('dir');
        const search = searchParams.get('search') || saved.get('search') || '';

        setAccountFilter(account || null);
        setSelectedAccountFilter(account || '');
        setPrincipalFilter(principal);
        setPrincipalFilterState(principal);
        setInputValue(search);
        if (sort) setSortField(sort);
        if (direction) setSortAsc(direction === 'asc');
    }, [searchParams]);

    // Handle Edit
    const handleEdit = (contact: any) => {
        setEditingContact(contact);

        // Sync to URL immediately for selection persistence
        const params = new URLSearchParams(Array.from(searchParams.entries()));
        params.set('id', contact.id);
        const queryString = params.toString();
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
        const storageParams = new URLSearchParams(params);
        storageParams.delete('id');
        const storageQuery = storageParams.toString();
        if (storageQuery) {
            sessionStorage.setItem('crm_contactos_state', storageQuery);
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
            String(acc.nit || '').toLowerCase().includes(term)
        );
    }, [accounts, accountSearchTerm]);

    // --- VIEW: Create Contact Flow (Step 1: Select Account) ---
    if (isCreating && !selectedAccountIdForCreate) {
        return (
            <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 sm:space-y-8">
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
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                                    Selecciona una Cuenta
                                </h1>
                                <p className="text-slate-500 font-medium text-sm sm:text-base">Elige la empresa vinculada al nuevo contacto</p>
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
                        className="w-full pl-12 pr-4 py-3.5 sm:py-4 border border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-[#254153]/5 focus:border-[#254153] bg-white transition-all outline-none text-slate-700 font-medium placeholder:text-slate-400"
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
                                className="group p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl hover:border-[#254153] hover:shadow-xl hover:shadow-slate-200/50 transition-all text-left relative flex flex-col gap-3"
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
            <div className="p-4 sm:p-6 max-w-2xl mx-auto">
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
    const { user } = useCurrentUser();
    const colStorageKey = `crm_col_widths_contactos_${user?.id || 'default'}`;
    const [colWidths, setColWidths] = useState<Record<string, number>>({});

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem(colStorageKey);
                if (saved) setColWidths(JSON.parse(saved));
            } catch (e) {}
        }
    }, [colStorageKey]);

    const handleColumnResize = useCallback((arg1: number, arg2: number) => {
        let width = arg1;
        let colIndex = arg2;
        if (arg1 < 20 && arg2 > 20) {
            colIndex = arg1;
            width = arg2;
        }
        const fields: Record<number, string> = {
            0: 'nombre', 1: 'cargo', 2: 'principal', 3: 'cuenta', 4: 'email', 5: 'telefono'
        };
        const fieldName = fields[colIndex];
        if (fieldName && width > 30) {
            setColWidths(prev => {
                const next = { ...prev, [fieldName]: width };
                if (typeof window !== 'undefined') {
                    localStorage.setItem(colStorageKey, JSON.stringify(next));
                }
                return next;
            });
        }
    }, [colStorageKey]);

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
        { data: 'nombre', title: 'Contacto', readOnly: true, width: colWidths['nombre'] || 200, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                const v = value || '';
                const safe = v.replace(/"/g, '&quot;');
                td.innerHTML = `<div style="font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;" title="${safe}">${v}</div>`;
                td.style.overflow = 'hidden';
                return td;
            }
        },
        { data: 'cargo', title: 'Cargo', readOnly: true, width: colWidths['cargo'] || 160, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                const v = value || '';
                const safe = v.replace(/"/g, '&quot;');
                td.innerHTML = `<div style="color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;" title="${safe}">${v}</div>`;
                td.style.overflow = 'hidden';
                return td;
            }
        },
        { data: 'principal', title: 'Principal', readOnly: true, width: colWidths['principal'] || 100, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                const isPrincipal = value === 'Principal';
                const bg = isPrincipal ? '#dcfce7' : '#f1f5f9';
                const c = isPrincipal ? '#166534' : '#64748b';
                td.innerHTML = `<div style="display:flex;align-items:center;height:100%;"><span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;white-space:nowrap;background:${bg};color:${c};line-height:1.4;">${value || '-'}</span></div>`;
                td.style.overflow = 'visible';
                return td;
            }
        },
        { data: 'cuenta', title: 'Cuenta', readOnly: true, width: colWidths['cuenta'] || 180, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                const v = value || '';
                const safe = v.replace(/"/g, '&quot;');
                td.innerHTML = `<div style="font-weight:600;color:#3b82f6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;" title="${safe}">${v}</div>`;
                td.style.overflow = 'hidden';
                return td;
            }
        },
        { data: 'email', title: 'Email', readOnly: true, width: colWidths['email'] || 180, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                const v = value || '';
                const safe = v.replace(/"/g, '&quot;');
                td.innerHTML = `<div style="color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;" title="${safe}">${v}</div>`;
                td.style.overflow = 'hidden';
                return td;
            }
        },
        { data: 'telefono', title: 'Teléfono', readOnly: true, width: colWidths['telefono'] || 130, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                td.innerHTML = `<span style="font-size:12.5px;color:#64748b;font-weight:500;font-variant-numeric:tabular-nums;">${value || '-'}</span>`;
                return td;
            }
        }
    ];

    // --- VIEW: Global List ---
    return (
        <div data-testid="contacts-page" className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
                    className="w-full sm:w-auto px-4 py-2.5 bg-[#254153] text-white rounded-lg hover:bg-[#1a2f3d] flex items-center justify-center gap-2 shadow-sm transition-all font-bold"
                >
                    <Plus size={18} />
                    Nuevo Contacto
                </button>
            </div>

            <DataListToolbar
                searchValue={inputValue}
                onSearchChange={setInputValue}
                searchPlaceholder="Buscar por nombre, cuenta, email o teléfono…"
                searchTestId="contacts-search"
                filtersOpen={showFilters}
                onFiltersOpenChange={setShowFilters}
                activeFilterCount={(selectedAccountFilter ? 1 : 0) + (principalFilter !== 'all' ? 1 : 0)}
                onClear={() => { setInputValue(''); setSelectedAccountFilter(''); setAccountFilter(null); setPrincipalFilterState('all'); setPrincipalFilter('all'); }}
                filters={<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 sm:max-w-sm">
                    <AccountCombobox
                        value={selectedAccountFilter}
                        onChange={(id) => { setSelectedAccountFilter(id); setAccountFilter(id || null); }}
                        initialLabel={selectedAccountFilter ? accountMap.get(selectedAccountFilter) : undefined}
                    />
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-white p-1 ring-1 ring-slate-200">
                    {([['all', 'Todos'], ['principal', 'Principales'], ['secondary', 'Secundarios']] as const).map(([value, label]) => (
                        <button key={value} onClick={() => { setPrincipalFilterState(value); setPrincipalFilter(value); }} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${principalFilter === value ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>
                    ))}
                </div>
                <div className="flex items-center gap-1 sm:ml-auto">
                    <span className="text-xs font-semibold text-slate-500">Ordenar:</span>
                    {([['updated_at', 'Recientes'], ['nombre', 'Nombre'], ['email', 'Email']] as const).map(([field, label]) => (
                        <button key={field} onClick={() => handleSort(field)} className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${sortField === field ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-white'}`}>
                            {label}{sortField === field ? (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-50" />}
                        </button>
                    ))}
                </div>
                </div>}
            />

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
                    {/* VISTA MÓVIL: Tarjetas */}
                    <div className="grid grid-cols-1 gap-3 md:hidden">
                        {contacts.map((contact) => {
                            const accountName = contact.account_name || accountMap.get(contact.account_id) || "Sin cuenta";
                            return (
                                <div 
                                    key={contact.id}
                                    onClick={() => handleEdit(contact)}
                                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-blue-300 active:scale-[0.99] transition-all relative cursor-pointer"
                                >
                                    <div className="p-4 border-b border-slate-100 flex justify-between items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-900 text-sm mb-0.5 truncate">
                                                {contact.nombre || "Sin nombre"}
                                            </div>
                                            <div className="text-slate-500 text-xs truncate">
                                                {contact.cargo || "Sin cargo registrado"}
                                            </div>
                                        </div>
                                        {contact.es_principal && (
                                            <div className="shrink-0 flex items-start">
                                                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap bg-emerald-50 text-emerald-700 border-emerald-200">
                                                    Principal
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="p-4 bg-slate-50/50 flex flex-col gap-2 text-xs">
                                        <div className="flex items-center gap-2 text-slate-700 font-medium truncate">
                                            <Building className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                            <span className="truncate text-blue-700 font-semibold">{accountName}</span>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                                            <div className="flex items-center gap-2 text-slate-600 truncate">
                                                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="truncate">{contact.email || "Sin email"}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-600 truncate">
                                                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="truncate">{contact.telefono || "Sin teléfono"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* VISTA DESKTOP: Tabla */}
                    <div data-testid="contacts-list" className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="w-full relative z-0 opp-hot-wrap" style={{ minHeight: '400px' }}>
                            <style>{`
                                /* ── Scrollbar ── */
                                .opp-hot-wrap .ht_master .wtHolder {
                                    scrollbar-width: thin;
                                    scrollbar-color: #c7d2de transparent;
                                }
                                .opp-hot-wrap .ht_master .wtHolder::-webkit-scrollbar { width: 6px; height: 6px; }
                                .opp-hot-wrap .ht_master .wtHolder::-webkit-scrollbar-thumb {
                                    background: #c7d2de; border-radius: 99px;
                                }
                                .opp-hot-wrap .ht_master .wtHolder::-webkit-scrollbar-track { background: transparent; }

                                /* ── Header Cells (Column Titles & Corner) ── */
                                .opp-hot-wrap .handsontable thead th,
                                .opp-hot-wrap .handsontable .ht_clone_top th,
                                .opp-hot-wrap .handsontable .ht_clone_top_inline_start_corner th {
                                    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%) !important;
                                    color: #475569 !important;
                                    font-size: 10.5px !important;
                                    font-weight: 800 !important;
                                    letter-spacing: 0.08em !important;
                                    text-transform: uppercase !important;
                                    border-bottom: 2px solid #e2e8f0 !important;
                                    border-right: 1px solid #e8ecf1 !important;
                                    padding: 0 14px !important;
                                    height: 40px !important;
                                    min-height: 40px !important;
                                    max-height: 40px !important;
                                    line-height: 40px !important;
                                    white-space: nowrap !important;
                                    box-sizing: border-box !important;
                                }
                                .opp-hot-wrap .handsontable th:last-child {
                                    border-right: none !important;
                                }

                                /* ── Body Cells & Row Headers Alignment ── */
                                .opp-hot-wrap .handsontable tbody tr,
                                .opp-hot-wrap .handsontable tbody td,
                                .opp-hot-wrap .handsontable tbody th,
                                .opp-hot-wrap .handsontable .ht_clone_inline_start tbody th,
                                .opp-hot-wrap .handsontable .ht_clone_inline_start tbody td {
                                    height: 38px !important;
                                    min-height: 38px !important;
                                    max-height: 38px !important;
                                    line-height: 38px !important;
                                    box-sizing: border-box !important;
                                    vertical-align: middle !important;
                                    white-space: nowrap !important;
                                    overflow: hidden !important;
                                    text-overflow: ellipsis !important;
                                }

                                .opp-hot-wrap .handsontable tbody th.rowHeader {
                                    background: #f8fafc !important;
                                    color: #94a3b8 !important;
                                    font-size: 10px !important;
                                    font-weight: 600 !important;
                                    border-right: 1px solid #e2e8f0 !important;
                                    border-bottom: 1px solid #f1f5f9 !important;
                                    text-align: center !important;
                                    width: 42px !important;
                                    min-width: 42px !important;
                                    max-width: 42px !important;
                                }

                                .opp-hot-wrap .handsontable tbody td {
                                    font-size: 13px !important;
                                    color: #334155 !important;
                                    border-bottom: 1px solid #f1f5f9 !important;
                                    border-right: 1px solid transparent !important;
                                    padding: 0 14px !important;
                                    font-family: inherit !important;
                                    transition: background 0.15s ease, box-shadow 0.15s ease !important;
                                }

                                /* ── Zebra Striping ── */
                                .opp-hot-wrap .handsontable tr:nth-child(even) td {
                                    background: #fafbfd !important;
                                }
                                .opp-hot-wrap .handsontable tr:nth-child(odd) td {
                                    background: #ffffff !important;
                                }

                                /* ── Row Hover ── */
                                .opp-hot-wrap .handsontable tbody tr:hover td {
                                    background: #eff6ff !important;
                                    cursor: pointer;
                                }
                                .opp-hot-wrap .handsontable tbody tr:hover td:first-child {
                                    box-shadow: inset 3px 0 0 0 #3b82f6 !important;
                                }

                                /* ── Selection ── */
                                .opp-hot-wrap .handsontable .wtBorder.current {
                                    background: #3b82f6 !important;
                                }
                                .opp-hot-wrap .handsontable td.area {
                                    background: #eff6ff !important;
                                }
                                .opp-hot-wrap .handsontable td.current {
                                    background: #e0edff !important;
                                }

                                /* ── Dropdown Filter Popover ── */
                                .opp-hot-wrap .handsontable .htDropdownMenu,
                                .htDropdownMenu .ht_master .wtHolder {
                                    border-radius: 12px !important;
                                    overflow: hidden !important;
                                }
                                .htDropdownMenu {
                                    box-shadow: 0 12px 40px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(15, 23, 42, 0.06) !important;
                                    border: none !important;
                                    border-radius: 12px !important;
                                }
                                .opp-hot-wrap .handsontable .changeType {
                                    border-color: #e2e8f0 !important;
                                }

                                /* ── Column Resize Handle ── */
                                .opp-hot-wrap .handsontable .manualColumnResizer {
                                    border-right: 2px solid #3b82f6 !important;
                                    opacity: 0;
                                    transition: opacity 0.2s ease;
                                }
                                .opp-hot-wrap .handsontable th:hover .manualColumnResizer {
                                    opacity: 1;
                                }

                                /* ── Corner Header ── */
                                .opp-hot-wrap .handsontable .ht_clone_top_inline_start_corner th {
                                    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%) !important;
                                    border-right: 1px solid #e2e8f0 !important;
                                    border-bottom: 2px solid #e2e8f0 !important;
                                }

                                /* ── Force single-line cells ── */
                                .opp-hot-wrap .handsontable td {
                                    white-space: nowrap !important;
                                    overflow: hidden !important;
                                    text-overflow: ellipsis !important;
                                }
                            `}</style>
                            <HotTable
                                data={hotData}
                                columns={hotColumns}
                                rowHeaders={true}
                                manualColumnResize={true}
                                afterColumnResize={(width: number, col: number) => handleColumnResize(width, col)}
                                filters={true}
                                dropdownMenu={true}
                                width="100%"
                                height="calc(100vh - 280px)"
                                autoColumnSize={false}
                                autoRowSize={false}
                                rowHeights={38}
                                renderAllRows={false}
                                licenseKey="non-commercial-and-evaluation"
                                afterOnCellMouseDown={(event: any, coords: any, td: any) => {
                                    if (coords.row === -1) {
                                        const target = event?.target as HTMLElement;
                                        const isDropdownBtn = target?.closest('.changeType') || target?.closest('.htDropdownMenu') || target?.classList?.contains('changeType');
                                        if (isDropdownBtn) {
                                            // User clicked the filter dropdown button [▼], do NOT toggle sort!
                                            return;
                                        }
                                        const fields: Record<number, 'nombre' | 'email'> = { 0: 'nombre', 4: 'email' };
                                        if (fields[coords.col]) handleSort(fields[coords.col]);
                                        return;
                                    }
                                    if (coords.row >= 0) {
                                        const contact = hotData[coords.row]?._original;
                                        if (contact) {
                                            handleEdit(contact);
                                        }
                                    }
                                }}
                                afterGetColHeader={(column: number, TH: HTMLTableCellElement) => {
                                    const fields: Record<number, 'nombre' | 'email'> = { 0: 'nombre', 4: 'email' };
                                    const labels: Record<number, string> = { 0: 'Contacto', 4: 'Email' };
                                    if (fields[column]) {
                                        TH.style.cursor = 'pointer';
                                        TH.title = 'Clic para ordenar A–Z o Z–A';
                                        const header = TH.querySelector('.colHeader');
                                        if (header) header.textContent = `${labels[column]} ${sortField === fields[column] ? (sortAsc ? '↑' : '↓') : '↕'}`;
                                    }
                                }}
                                stretchH="all"
                                className="text-sm font-sans"
                            />
                        </div>
                    </div>

                    {hasMore && (
                        <div className="flex justify-center mt-8 mb-8 px-2">
                            <button
                                onClick={loadMore}
                                disabled={loading}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 sm:py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50"
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
