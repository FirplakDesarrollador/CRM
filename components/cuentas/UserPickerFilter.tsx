"use client";

import { useState, useRef, useEffect } from "react";
import { User, useUsers } from "@/lib/hooks/useUsers";
import { Search, User as UserIcon, Check, X, ChevronDown } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useOnClickOutside } from "@/lib/hooks/useOnClickOutside";

interface UserPickerFilterProps {
    onUserSelect: (userId: string | null) => void;
    selectedUserId: string | null;
}

export function UserPickerFilter({ onUserSelect, selectedUserId }: UserPickerFilterProps) {
    const { users, isLoading } = useUsers();
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    // @ts-ignore
    useOnClickOutside(containerRef, () => setIsOpen(false));

    const selectedUser = users.find(u => u.id === selectedUserId);

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="relative" ref={containerRef as any} data-testid="accounts-user-picker-filter">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-all",
                    selectedUserId
                        ? "bg-blue-50 border-blue-200 text-blue-700 font-medium"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                )}
            >
                <UserIcon className={cn("w-4 h-4", selectedUserId ? "text-blue-500" : "text-slate-400")} />
                <span className="max-w-[120px] truncate">
                    {selectedUser ? selectedUser.full_name : "Filtrar por usuario"}
                </span>
                {selectedUserId ? (
                    <X
                        className="w-3 h-3 hover:text-red-500"
                        onClick={(e) => {
                            e.stopPropagation();
                            onUserSelect(null);
                        }}
                    />
                ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
            </button>

            {isOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2 border-b border-slate-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                autoFocus
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                placeholder="Buscar usuario..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto p-1">
                        {isLoading ? (
                            <div className="p-4 text-center text-xs text-slate-400">Cargando usuarios...</div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">No se encontraron usuarios</div>
                        ) : (
                            <>
                                <button
                                    onClick={() => {
                                        onUserSelect(null);
                                        setIsOpen(false);
                                    }}
                                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                                >
                                    <span>Todos los usuarios</span>
                                    {!selectedUserId && <Check className="w-4 h-4 text-blue-500" />}
                                </button>
                                {filteredUsers.map((user) => (
                                    <button
                                        key={user.id}
                                        onClick={() => {
                                            onUserSelect(user.id);
                                            setIsOpen(false);
                                        }}
                                        className={cn(
                                            "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors group",
                                            selectedUserId === user.id
                                                ? "bg-blue-50 text-blue-700 font-medium"
                                                : "text-slate-600 hover:bg-slate-50"
                                        )}
                                    >
                                        <div className="flex flex-col items-start">
                                            <span>{user.full_name || user.email}</span>
                                            <span className="text-[10px] text-slate-400 group-hover:text-slate-500">
                                                {user.email}
                                            </span>
                                        </div>
                                        {selectedUserId === user.id && <Check className="w-4 h-4 text-blue-500" />}
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
