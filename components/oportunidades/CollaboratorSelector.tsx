import { useState, useEffect } from 'react';
import { useUsers, User } from '@/lib/hooks/useUsers'; // Assuming this hook exists and access CRM_Usuarios
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

export interface CollaboratorEntry {
    usuario_id: string;
    porcentaje: number;
    rol: string;
    tempId?: string; // For UI keying before saving
    full_name?: string; // Display helper
}

interface CollaboratorSelectorProps {
    value?: CollaboratorEntry[];
    onChange: (collaborators: CollaboratorEntry[]) => void;
    ownerId?: string; // To exclude owner from list
}

export function CollaboratorSelector({ value = [], onChange, ownerId }: CollaboratorSelectorProps) {
    const { users, isLoading } = useUsers();
    const [collaborators, setCollaborators] = useState<CollaboratorEntry[]>(value);

    // Sync internal state with props if controlled
    useEffect(() => {
        setCollaborators(value);
    }, [value]);

    const availableUsers = users.filter(u =>
        u.is_active &&
        u.id !== ownerId &&
        !collaborators.some(c => c.usuario_id === u.id)
    );

    const handleAddCollaborator = () => {
        const newCollab: CollaboratorEntry = {
            usuario_id: '',
            porcentaje: 0,
            rol: 'COLABORADOR',
            tempId: uuidv4()
        };
        const updated = [...collaborators, newCollab];
        setCollaborators(updated);
        onChange(updated);
    };

    const handleRemoveCollaborator = (index: number) => {
        const updated = collaborators.filter((_, i) => i !== index);
        setCollaborators(updated);
        onChange(updated);
    };

    const handleUpdateCollaborator = (index: number, field: keyof CollaboratorEntry, val: any) => {
        const updated = [...collaborators];
        updated[index] = { ...updated[index], [field]: val };

        // If updating user_id, fetch name for display
        if (field === 'usuario_id') {
            const user = users.find(u => u.id === val);
            if (user) {
                updated[index].full_name = user.full_name || user.email;
            }
        }

        setCollaborators(updated);
        onChange(updated);
    };

    const totalPercentage = collaborators.reduce((sum, c) => sum + (Number(c.porcentaje) || 0), 0);
    const ownerPercentage = 100 - totalPercentage;
    const isOverLimit = totalPercentage > 100;

    if (isLoading) return <div>Cargando usuarios...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Label>Colaboradores y Comisiones</Label>
                <Badge variant={isOverLimit ? "destructive" : "secondary"}>
                    Propietario: {ownerPercentage.toFixed(2)}%
                </Badge>
            </div>

            {collaborators.map((collab, index) => (
                <Card key={collab.tempId || collab.usuario_id || index} className="p-3">
                    <CardContent className="p-0 flex items-end gap-3">
                        <div className="flex-1 space-y-1">
                            <Label className="text-xs">Usuario</Label>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                value={collab.usuario_id}
                                onChange={(e) => handleUpdateCollaborator(index, 'usuario_id', e.target.value)}
                            >
                                <option value="" disabled>Seleccionar usuario</option>
                                {/* Include current value even if not in availableUsers (to allow viewing current selection) */}
                                {collab.usuario_id && !availableUsers.some(u => u.id === collab.usuario_id) && (
                                    <option value={collab.usuario_id}>
                                        {users.find(u => u.id === collab.usuario_id)?.full_name || 'Desconocido'}
                                    </option>
                                )}
                                {availableUsers.map(user => (
                                    <option key={user.id} value={user.id}>
                                        {user.full_name || user.email}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="w-24 space-y-1">
                            <Label className="text-xs">% Comisión</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    min="0.01"
                                    max="100"
                                    step="0.01"
                                    value={collab.porcentaje}
                                    onChange={(e) => handleUpdateCollaborator(index, 'porcentaje', parseFloat(e.target.value))}
                                    className={cn(isOverLimit ? "border-red-500" : "")}
                                />
                                <span className="absolute right-3 top-2 text-xs text-muted-foreground">%</span>
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive/90 mb-0.5"
                            onClick={() => handleRemoveCollaborator(index)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            ))}

            {isOverLimit && (
                <p className="text-sm text-destructive font-medium">
                    El total asignado a colaboradores supera el 100%. Por favor ajuste los porcentajes.
                </p>
            )}

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCollaborator}
                className="w-full border-dashed"
                disabled={totalPercentage >= 100}
            >
                <UserPlus className="h-4 w-4 mr-2" />
                Agregar Colaborador
            </Button>
        </div>
    );
}
