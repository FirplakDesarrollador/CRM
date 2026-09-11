export interface ActivityItem {
    id: string;
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
    tipo_actividad?: string | null;
    is_completed?: boolean | null;
    is_deleted?: boolean | null;
}

export interface OpportunityActivitySummary {
    total: number;
    pendingTotal: number;
    overdue: number;
    scheduled: number;
    completed: number;
    hasActivity: boolean;
    status: 'none' | 'overdue' | 'scheduled' | 'completed';
    label: string;
}

/**
 * Calcula el resumen y estado de actividades asociadas a una oportunidad.
 * - 'none': No tiene actividades registradas.
 * - 'overdue': Tiene al menos una actividad atrasada (fecha límite en el pasado y no completada).
 * - 'scheduled': No tiene atrasadas y tiene al menos una programada a futuro.
 * - 'completed': Todas sus actividades están completadas.
 */
export function computeOpportunityActivitySummary(
    activities: ActivityItem[] | null | undefined,
    now: Date = new Date()
): OpportunityActivitySummary {
    if (!activities || !Array.isArray(activities) || activities.length === 0) {
        return {
            total: 0,
            pendingTotal: 0,
            overdue: 0,
            scheduled: 0,
            completed: 0,
            hasActivity: false,
            status: 'none',
            label: 'Sin actividad'
        };
    }

    const activeList = activities.filter(a => a && !a.is_deleted);
    if (activeList.length === 0) {
        return {
            total: 0,
            pendingTotal: 0,
            overdue: 0,
            scheduled: 0,
            completed: 0,
            hasActivity: false,
            status: 'none',
            label: 'Sin actividad'
        };
    }

    let overdue = 0;
    let scheduled = 0;
    let completed = 0;

    const nowTime = now.getTime();

    for (const act of activeList) {
        if (act.is_completed) {
            completed++;
        } else {
            // Para tareas, fecha_inicio representa la Fecha de Vencimiento seleccionada por el usuario.
            // Si fecha_fin es anterior a fecha_inicio (por valor predeterminado residual), priorizar fecha_inicio.
            let targetDateStr = act.fecha_fin;
            if (act.tipo_actividad === 'TAREA') {
                targetDateStr = act.fecha_inicio || act.fecha_fin;
            } else if (act.fecha_inicio && act.fecha_fin && new Date(act.fecha_fin).getTime() < new Date(act.fecha_inicio).getTime()) {
                targetDateStr = act.fecha_inicio;
            } else {
                targetDateStr = act.fecha_fin || act.fecha_inicio;
            }

            if (targetDateStr) {
                const actDate = new Date(targetDateStr);
                if (!isNaN(actDate.getTime()) && actDate.getTime() < nowTime) {
                    overdue++;
                } else {
                    scheduled++;
                }
            } else {
                scheduled++;
            }
        }
    }

    const pendingTotal = overdue + scheduled;
    let status: 'none' | 'overdue' | 'scheduled' | 'completed' = 'none';
    let label = '';

    if (overdue > 0) {
        status = 'overdue';
        label = scheduled > 0 
            ? `${overdue} atrasada${overdue > 1 ? 's' : ''} (${scheduled} prog.)`
            : `${overdue} atrasada${overdue > 1 ? 's' : ''}`;
    } else if (scheduled > 0) {
        status = 'scheduled';
        label = `${scheduled} programada${scheduled > 1 ? 's' : ''}`;
    } else if (completed > 0) {
        status = 'completed';
        label = `${completed} al día`;
    } else {
        status = 'none';
        label = 'Sin actividad';
    }

    return {
        total: activeList.length,
        pendingTotal,
        overdue,
        scheduled,
        completed,
        hasActivity: true,
        status,
        label
    };
}
