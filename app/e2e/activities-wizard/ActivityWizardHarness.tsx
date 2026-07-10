"use client";

import { useEffect, useState } from "react";
import { CreateActivityModal } from "@/components/activities/CreateActivityModal";
import { db } from "@/lib/db";

export default function ActivityWizardHarness() {
    const [isReady, setIsReady] = useState(false);
    const [submitCount, setSubmitCount] = useState(0);

    useEffect(() => {
        const seedCatalogs = async () => {
            await db.activityClassifications.put({
                id: 990001,
                nombre: "Seguimiento E2E",
                tipo_actividad: "EVENTO",
                is_deleted: false
            });
            setIsReady(true);
        };

        seedCatalogs();
    }, []);

    if (!isReady) {
        return <div>Cargando prueba...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-100 p-8">
            <div aria-live="polite" data-testid="activity-submit-count">
                Envios: {submitCount}
            </div>
            <CreateActivityModal
                onClose={() => undefined}
                onSubmit={() => setSubmitCount((count) => count + 1)}
                opportunities={[]}
            />
        </div>
    );
}
