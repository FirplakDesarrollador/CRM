import React from 'react';
import { ShieldAlert, Building2, User, Mail, Phone, Tag, X, AlertCircle, GitBranch, ExternalLink } from 'lucide-react';

export interface DuplicateAccountInfo {
    account: {
        id?: string;
        nombre: string;
        nit_base?: string | null;
        canal_id?: string | null;
        telefono?: string | null;
        email?: string | null;
        created_at?: string | null;
        owner_user_id?: string | null;
        id_cuenta_principal?: string | null;
    };
    rootAccount?: {
        id: string;
        nombre: string;
        nit_base?: string | null;
        canal_id?: string | null;
    } | null;
    owner?: {
        full_name?: string | null;
        email?: string | null;
        zona?: string | null;
    } | null;
    conflicts: string[];
}

interface DuplicateAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    duplicates: DuplicateAccountInfo[];
    title?: string;
    currentUserId?: string | null;
    userZoneName?: string | null;
    onCreateBranch?: (duplicate: DuplicateAccountInfo) => void;
    onOpenExistingAccount?: (accountId: string) => void;
}

export function DuplicateAccountModal({
    isOpen,
    onClose,
    duplicates,
    title = "Cliente ya registrado en el CRM",
    currentUserId,
    userZoneName,
    onCreateBranch,
    onOpenExistingAccount,
}: DuplicateAccountModalProps) {
    if (!isOpen || !duplicates || duplicates.length === 0) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] border border-amber-100">

                {/* Header */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-5 border-b border-amber-100 flex items-start justify-between">
                    <div className="flex gap-3.5 items-start">
                        <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0 shadow-sm">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-amber-950">{title}</h2>
                            <p className="text-xs text-amber-800/90 mt-0.5">
                                No se puede guardar porque los datos coinciden con una cuenta existente en el sistema.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-amber-700/60 hover:bg-amber-100/80 hover:text-amber-900 rounded-lg transition-colors"
                        title="Cerrar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Body */}
                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    {duplicates.map((dup, idx) => {
                        const isOwnedByCurrentUser = Boolean(
                            currentUserId && dup.account.owner_user_id === currentUserId
                        );
                        return (
                            <div key={dup.account.id || idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">

                                {/* Conflict Badges */}
                                <div className="flex flex-wrap gap-1.5">
                                    {dup.conflicts.map((conflict, cIdx) => (
                                        <span key={cIdx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                            {conflict}
                                        </span>
                                    ))}
                                </div>

                                {/* Existing Account Card */}
                                <div className="space-y-2.5 pt-1">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="w-5 h-5 text-blue-600 shrink-0" />
                                        <span className="font-bold text-slate-900 text-base">{dup.account.nombre}</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 pl-7">
                                        {dup.account.nit_base && (
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-semibold text-slate-500">NIT:</span>
                                                <span className="font-mono bg-slate-200/70 px-1.5 py-0.5 rounded text-slate-800 font-medium">
                                                    {dup.account.nit_base}
                                                </span>
                                            </div>
                                        )}

                                        {dup.account.canal_id && (
                                            <div className="flex items-center gap-1.5">
                                                <Tag className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="font-semibold text-slate-500">Canal:</span>
                                                <span className="font-medium text-slate-700">{dup.account.canal_id}</span>
                                            </div>
                                        )}

                                        {dup.account.telefono && (
                                            <div className="flex items-center gap-1.5">
                                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                <span>{dup.account.telefono}</span>
                                            </div>
                                        )}

                                        {dup.account.email && (
                                            <div className="flex items-center gap-1.5">
                                                <Mail className="w-3.5 h-3.5 text-slate-400" />
                                                <span>{dup.account.email}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Owner Information */}
                                    <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-start justify-between gap-3 bg-white p-3 rounded-lg border flex-wrap">
                                        <div className="flex items-start gap-2.5">
                                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md shrink-0 mt-0.5">
                                                <User className="w-4 h-4" />
                                            </div>
                                            <div className="text-xs">
                                                <span className="text-slate-500 font-medium">Asesor propietario actual:</span>
                                                <p className="font-bold text-slate-900 text-sm">
                                                    {dup.owner?.full_name || 'Sin asesor asignado'}
                                                </p>
                                                {dup.owner?.zona && (
                                                    <p className="text-sky-700 font-medium mt-0.5">Zona: {dup.owner.zona}</p>
                                                )}
                                                {dup.owner?.email && (
                                                    <p className="text-slate-500 font-mono mt-0.5">{dup.owner.email}</p>
                                                )}
                                            </div>
                                        </div>

                                        {isOwnedByCurrentUser && dup.account.id && onOpenExistingAccount ? (
                                            <button
                                                type="button"
                                                onClick={() => onOpenExistingAccount(dup.account.id!)}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                Abrir cuenta existente
                                            </button>
                                        ) : onCreateBranch && dup.account.id ? (
                                            <button
                                                type="button"
                                                disabled={!userZoneName}
                                                onClick={() => onCreateBranch(dup)}
                                                title={
                                                    userZoneName
                                                        ? `Crear sucursal para zona ${userZoneName}`
                                                        : "Necesitas una zona comercial asignada por un administrador"
                                                }
                                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <GitBranch className="w-3.5 h-3.5" />
                                                Crear cuenta nueva en mi sucursal
                                            </button>
                                        ) : null}
                                    </div>
                                </div>

                            </div>
                        );
                    })}

                    {/* Helper / Policy Alert */}
                    <div className="bg-blue-50/80 border border-blue-200/80 p-3.5 rounded-xl text-xs text-blue-900 flex gap-2.5 items-start">
                        <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">¿Por qué no ves este cliente en tu listado?</p>
                            <p className="mt-0.5 text-blue-800/90 leading-relaxed">
                                Por políticas de privacidad y cartera del CRM, solo puedes ver las cuentas asignadas a tu usuario. Si necesitas operar este cliente desde tu regional, usa <strong>Crear cuenta nueva en mi sucursal</strong> o contacta al asesor propietario.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium text-sm transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                        Entendido
                    </button>
                </div>

            </div>
        </div>
    );
}
