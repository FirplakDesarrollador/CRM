"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CreateActivityModal } from "@/components/activities/CreateActivityModal";
import { db } from "@/lib/db";

const ACTIVITY_ID = "activity-checklist-e2e";

export default function ActivityChecklistHarness() {
    const [isReady, setIsReady] = useState(false);
    const activity = useLiveQuery(
        () => isReady ? db.activities.get(ACTIVITY_ID) : undefined,
        [isReady]
    );

    useEffect(() => {
        const seedActivity = async () => {
            await db.activities.put({
                id: ACTIVITY_ID,
                user_id: "e2e-user",
                asunto: "Tarea checklist E2E",
                descripcion: "",
                tipo_actividad: "TAREA",
                fecha_inicio: new Date().toISOString(),
                is_completed: false,
                ms_planner_id: "planner-task-e2e",
                _sync_metadata: {}
            });
            setIsReady(true);
        };

        seedActivity();
    }, []);

    if (!isReady || !activity) {
        return <div>Cargando prueba...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-100 p-8">
            <pre data-testid="activity-metadata">
                {JSON.stringify(activity._sync_metadata || {})}
            </pre>
            <CreateActivityModal
                onClose={() => undefined}
                onSubmit={() => undefined}
                initialData={activity}
            />
        </div>
    );
}
