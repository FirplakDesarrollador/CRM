import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { db, LocalLossReason } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { supabase } from "@/lib/supabase";

interface LossReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reasonId: number) => Promise<void>;
    isLoading?: boolean;
}

export function LossReasonModal({ isOpen, onClose, onConfirm, isLoading = false }: LossReasonModalProps) {
    const [selectedReasonId, setSelectedReasonId] = useState<number | null>(null);
    const [isFetching, setIsFetching] = useState(false);

    // Fetch from local Dexie first
    const reasons = useLiveQuery(() => db.lossReasons.filter(r => r.is_active === true).toArray());

    // JIT Sync: If local is empty, try fetch from server and seed local
    useEffect(() => {
        const syncReasons = async () => {
            if (isOpen && (!reasons || reasons.length === 0) && !isFetching) {
                setIsFetching(true);
                try {
                    const { data, error } = await supabase.from('CRM_RazonesPerdida').select('*').eq('is_active', true);
                    if (data && !error) {
                        await db.lossReasons.bulkPut(data);
                    }
                } catch (e) {
                    console.error("Error fetching loss reasons:", e);
                } finally {
                    setIsFetching(false);
                }
            }
        };
        syncReasons();
    }, [isOpen, reasons, isFetching]);

    const handleConfirm = async () => {
        if (selectedReasonId) {
            await onConfirm(selectedReasonId);
            setSelectedReasonId(null); // Reset
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isLoading && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Razón de Pérdida</DialogTitle>
                </DialogHeader>

                <div className="py-4">
                    <p className="text-sm text-slate-500 mb-4">
                        Por favor indique el motivo principal por el cual se perdió esta oportunidad. Esta información es obligatoria.
                    </p>

                    {isFetching ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        </div>
                    ) : (reasons && reasons.length > 0) ? (
                        <RadioGroup
                            value={selectedReasonId ? String(selectedReasonId) : ""}
                            onValueChange={(val) => setSelectedReasonId(Number(val))}
                            className="gap-3"
                        >
                            {reasons.map((reason) => (
                                <div key={reason.id} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedReasonId(reason.id)}>
                                    <RadioGroupItem value={String(reason.id)} id={`r-${reason.id}`} />
                                    <Label htmlFor={`r-${reason.id}`} className="flex-1 cursor-pointer font-medium text-slate-700">
                                        {reason.descripcion}
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                    ) : (
                        <div className="text-center py-6 text-slate-400 text-sm">
                            No se encontraron razones configuradas.
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedReasonId || isLoading}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            "Confirmar Pérdida"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
