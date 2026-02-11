"use client";

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { CollaboratorSelector, CollaboratorEntry } from './CollaboratorSelector';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';
import { syncEngine } from '@/lib/sync';
import { v4 as uuidv4 } from 'uuid';

export function CollaboratorsTab({ opportunityId }: { opportunityId: string }) {
    const dbCollaborators = useLiveQuery(
        () => db.opportunityCollaborators
            .where('oportunidad_id').equals(opportunityId)
            // Filter out soft-deleted items if any exist locally
            .filter(c => !c.is_deleted)
            .toArray(),
        [opportunityId]
    );

    const [entries, setEntries] = useState<CollaboratorEntry[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    // Initialize state from DB
    useEffect(() => {
        if (dbCollaborators) {
            const mapped = dbCollaborators.map(c => ({
                usuario_id: c.usuario_id,
                porcentaje: c.porcentaje,
                rol: c.rol,
                tempId: c.id // Store the actual DB ID in tempId for tracking
            }));
            setEntries(mapped);
            setIsDirty(false);
        }
    }, [dbCollaborators]);

    const handleSave = async () => {
        if (!dbCollaborators) return;

        // Validate: no empty users or 0% entries
        const invalid = entries.find(e => !e.usuario_id || !e.porcentaje || e.porcentaje <= 0);
        if (invalid) {
            alert('Todos los colaboradores deben tener un usuario seleccionado y un porcentaje mayor a 0%.');
            return;
        }

        setIsSaving(true);
        try {
            const currentIds = new Set(dbCollaborators.map(c => c.id));
            const newEntries = entries;

            // 1. Identify Deletions
            // If an ID exists in DB but not in current entries (via tempId), it is deleted.
            const keptIds = new Set(newEntries.map(e => e.tempId).filter(Boolean));
            const toDelete = dbCollaborators.filter(c => !keptIds.has(c.id));

            for (const item of toDelete) {
                // Soft delete
                await db.opportunityCollaborators.update(item.id, { is_deleted: true });
                await syncEngine.queueMutation('CRM_Oportunidades_Colaboradores', item.id, { is_deleted: true });
            }

            // 2. Identify Adds and Updates
            for (const entry of newEntries) {
                if (entry.tempId && currentIds.has(entry.tempId)) {
                    // Update
                    const original = dbCollaborators.find(c => c.id === entry.tempId);
                    if (original) {
                        const hasChanged =
                            original.usuario_id !== entry.usuario_id ||
                            original.porcentaje !== entry.porcentaje ||
                            original.rol !== entry.rol;

                        if (hasChanged) {
                            const updated = {
                                ...original,
                                usuario_id: entry.usuario_id,
                                porcentaje: entry.porcentaje,
                                rol: entry.rol,
                                updated_at: new Date().toISOString()
                            };
                            await db.opportunityCollaborators.put(updated);
                            // Queue specific field updates
                            await syncEngine.queueMutation('CRM_Oportunidades_Colaboradores', updated.id, {
                                usuario_id: entry.usuario_id,
                                porcentaje: entry.porcentaje,
                                rol: entry.rol,
                                updated_at: updated.updated_at
                            });
                        }
                    }
                } else {
                    // Create New
                    const newId = uuidv4();
                    const newItem = {
                        id: newId,
                        oportunidad_id: opportunityId,
                        usuario_id: entry.usuario_id,
                        porcentaje: entry.porcentaje,
                        rol: entry.rol || 'COLABORADOR',
                        is_deleted: false,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                    await db.opportunityCollaborators.add(newItem);
                    await syncEngine.queueMutation('CRM_Oportunidades_Colaboradores', newId, newItem);
                }
            }

            alert('Cambios guardados correctamente');
            setIsDirty(false);

        } catch (err) {
            console.error('Error saving collaborators:', err);
            alert('Error al guardar cambios. Revise la consola.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!dbCollaborators) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="font-bold text-slate-900 text-lg">Colaboradores y Comisiones</h3>
                    <p className="text-xs text-slate-500">Gestione quien participa en esta oportunidad</p>
                </div>
                {isDirty && (
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Guardar Cambios
                    </Button>
                )}
            </div>

            <CollaboratorSelector
                value={entries}
                onChange={(val) => {
                    setEntries(val);
                    setIsDirty(true);
                }}
            />
        </div>
    );
}
