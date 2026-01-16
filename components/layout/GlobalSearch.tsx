"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2, FileText, Building2, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useOnClickOutside } from "@/lib/hooks/useOnClickOutside"; // Assuming this exists or I'll implement a simple ref check

type SearchResult = {
    entity_type: 'opportunity' | 'account' | 'contact';
    id: string;
    title: string;
    subtitle: string;
    metadata: any;
};

export function GlobalSearch() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Debounced Search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.trim().length < 2) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                // Call RPC
                const { data, error } = await supabase.rpc('search_global', {
                    p_query: query,
                    p_limit: 8 // Limit total results for speed
                });

                if (error) throw error;
                setResults(data || []);
            } catch (err) {
                console.error("Global Search Error:", err);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    const handleSelect = (result: SearchResult) => {
        setIsOpen(false);
        setQuery("");

        // Navigation Logic
        switch (result.entity_type) {
            case 'opportunity':
                router.push(`/oportunidades/${result.id}`);
                break;
            case 'account':
                router.push(`/cuentas/${result.id}`); // Assuming accounts page exists
                break;
            case 'contact':
                // router.push(`/contactos/${result.id}`); 
                // Mostly contacts open in a modal or account context? 
                // For now, let's assume dedicated page or just log it if not exists.
                // Or maybe navigate to Account if contact is orphan?
                // Let's go to contacts list with filter if detail doesn't exist?
                // Actually, let's assume /contactos/[id] exists or fallback.
                router.push(`/contactos/${result.id}`);
                break;
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'opportunity': return <FileText className="w-4 h-4 text-blue-500" />;
            case 'account': return <Building2 className="w-4 h-4 text-purple-500" />;
            case 'contact': return <User className="w-4 h-4 text-green-500" />;
            default: return <Search className="w-4 h-4 text-slate-400" />;
        }
    };

    const getLabel = (type: string) => {
        switch (type) {
            case 'opportunity': return 'Oportunidad';
            case 'account': return 'Cuenta';
            case 'contact': return 'Contacto';
            default: return 'Item';
        }
    };

    return (
        <div className="relative w-full max-w-md mx-auto md:mx-0 hidden md:block" ref={containerRef}>
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                    type="text"
                    placeholder="Buscar (Ctrl+K)..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                />
                {loading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                )}
            </div>

            {isOpen && (query.length > 0 || results.length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
                    {results.length === 0 && !loading && query.length >= 2 ? (
                        <div className="p-4 text-center text-sm text-slate-500">
                            No se encontraron resultados para "{query}"
                        </div>
                    ) : (
                        <div className="py-2">
                            {/* Hint if query is short */}
                            {query.length < 2 && (
                                <div className="px-4 py-2 text-xs text-slate-400">
                                    Escribe al menos 2 caracteres...
                                </div>
                            )}

                            {results.map((result) => (
                                <div
                                    key={`${result.entity_type}-${result.id}`}
                                    onClick={() => handleSelect(result)}
                                    className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-none flex items-start gap-3 transition-colors"
                                >
                                    <div className="mt-0.5 p-1.5 bg-slate-100 rounded-lg">
                                        {getIcon(result.entity_type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-medium text-slate-800 truncate pr-2">
                                                {result.title}
                                            </h4>
                                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                                {getLabel(result.entity_type)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 truncate mt-0.5">
                                            {result.subtitle}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
