"use client";

import { useState, useRef, useEffect } from "react";
import { User, useUsers } from "@/lib/hooks/useUsers";
import { Search, User as UserIcon, Check, X, ChevronDown } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useOnClickOutside } from "@/lib/hooks/useOnClickOutside";

import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useMemo } from "react";

interface UserPickerFilterProps {
    onUserSelect?: (userId: string | null) => void;
    selectedUserId?: string | null;
    multiple?: boolean;
    selectedUserIds?: string[];
    onUsersSelect?: (userIds: string[]) => void;
}

export function UserPickerFilter({ 
    onUserSelect, 
    selectedUserId, 
    multiple = false, 
    selectedUserIds = [], 
    onUsersSelect 
}: UserPickerFilterProps) {
    const { users, isLoading } = useUsers();
    const { user: currentUser, role } = useCurrentUser();
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    // @ts-ignore
    useOnClickOutside(containerRef, () => setIsOpen(false));

    const isAnySelected = multiple ? selectedUserIds.length > 0 : !!selectedUserId;
    const selectedUser = !multiple 
        ? users.find(u => u.id === selectedUserId)
        : selectedUserIds.length === 1 
            ? users.find(u => u.id === selectedUserIds[0])
            : null;

    const buttonText = multiple
        ? selectedUserIds.length === 0
            ? "Filtrar por usuario"
            : selectedUserIds.length === 1 && selectedUser
                ? selectedUser.full_name
                : `${selectedUserIds.length} usuarios`
        : selectedUser
            ? selectedUser.full_name
            : "Filtrar por usuario";

    const availableUsers = useMemo(() => {
        if (role === 'ADMIN') return users;
        if (role === 'COORDINADOR' && currentUser?.id) {
            return users.filter(u => u.id === currentUser.id || u.coordinadores?.includes(currentUser.id));
        }
        return [];
    }, [users, role, currentUser]);

    const filteredUsers = availableUsers.filter(u =>
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="relative" ref={containerRef as any} data-testid="accounts-user-picker-filter">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-all",
                    isAnySelected
                        ? "bg-blue-50 border-blue-200 text-blue-700 font-medium"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                )}
            >
                <UserIcon className={cn("w-4 h-4", isAnySelected ? "text-blue-500" : "text-slate-400")} />
                <span className="max-w-[120px] truncate">
                    {buttonText}
                </span>
                {isAnySelected ? (
                    <X
                        className="w-3 h-3 hover:text-red-500"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (multiple) {
                                if (onUsersSelect) onUsersSelect([]);
                            } else {
                                if (onUserSelect) onUserSelect(null);
                            }
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
                                        if (multiple) {
                                            if (onUsersSelect) onUsersSelect([]);
                                        } else {
                                            if (onUserSelect) onUserSelect(null);
                                            setIsOpen(false);
                                        }
                                    }}
                                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                                >
                                    <span>Todos los usuarios</span>
                                    {((multiple && selectedUserIds.length === 0) || (!multiple && !selectedUserId)) && (
                                        <Check className="w-4 h-4 text-blue-500" />
                                    )}
                                </button>
                                {filteredUsers.map((user) => {
                                    const isSelected = multiple
                                        ? selectedUserIds.includes(user.id)
                                        : selectedUserId === user.id;
                                    return (
                                        <button
                                            key={user.id}
                                            onClick={() => {
                                                if (multiple) {
                                                    if (onUsersSelect) {
                                                        const next = selectedUserIds.includes(user.id)
                                                            ? selectedUserIds.filter(id => id !== user.id)
                                                            : [...selectedUserIds, user.id];
                                                        onUsersSelect(next);
                                                    }
                                                } else {
                                                    if (onUserSelect) onUserSelect(user.id);
                                                    setIsOpen(false);
                                                }
                                            }}
                                            className={cn(
                                                "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors group",
                                                isSelected
                                                    ? "bg-blue-50 text-blue-700 font-medium"
                                                    : "text-slate-600 hover:bg-slate-50"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                {multiple && (
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
                                                        checked={isSelected}
                                                        readOnly
                                                    />
                                                )}
                                                <div className="flex flex-col items-start">
                                                    <span>{user.full_name || user.email}</span>
                                                    <span className="text-[10px] text-slate-400 group-hover:text-slate-500">
                                                        {user.email}
                                                    </span>
                                                </div>
                                            </div>
                                            {!multiple && isSelected && <Check className="w-4 h-4 text-blue-500" />}
                                        </button>
                                    );
                                })}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
