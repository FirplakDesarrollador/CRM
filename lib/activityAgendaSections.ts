export type ActivitySortOrder = 'soonest' | 'latest' | 'title' | 'title_desc';

export interface AgendaSection<T> {
    id: 'hoy' | 'dia' | 'programadas' | 'atrasadas';
    title: string;
    items: T[];
}

type DatedActivity = { id: string; fecha_inicio: string; asunto?: string | null };

const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isSameLocalDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();

export function sortActivities<T extends DatedActivity>(items: T[], sortOrder: ActivitySortOrder): T[] {
    return [...items].sort((a, b) => {
        if (sortOrder === 'title' || sortOrder === 'title_desc') {
            const comparison = (a.asunto || '').localeCompare(b.asunto || '', 'es', { sensitivity: 'base' });
            return sortOrder === 'title_desc' ? -comparison : comparison;
        }
        const difference = new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime();
        return sortOrder === 'latest' ? -difference : difference;
    });
}

/**
 * En "Hasta la fecha" el orden cronológico ascendente entierra lo de hoy
 * detrás de todas las atrasadas. Parte el listado ya ordenado en:
 * Hoy, el día elegido (si no es hoy), programadas y atrasadas.
 * Dentro de cada bloque se conserva el orden que ya traía `sorted`.
 */
export function splitUpToDateSections<T extends DatedActivity>(
    sorted: T[],
    selectedDate: Date,
    now: Date = new Date()
): AgendaSection<T>[] {
    const selectedIsToday = isSameLocalDay(selectedDate, now);
    const startToday = startOfLocalDay(now).getTime();
    const hoy: T[] = [];
    const dia: T[] = [];
    const programadas: T[] = [];
    const atrasadas: T[] = [];

    for (const activity of sorted) {
        const date = new Date(activity.fecha_inicio);
        if (Number.isNaN(date.getTime())) {
            atrasadas.push(activity);
            continue;
        }
        if (isSameLocalDay(date, now)) hoy.push(activity);
        else if (!selectedIsToday && isSameLocalDay(date, selectedDate)) dia.push(activity);
        else if (date.getTime() < startToday) atrasadas.push(activity);
        else programadas.push(activity);
    }

    const sections: AgendaSection<T>[] = [];
    if (hoy.length) sections.push({ id: 'hoy', title: 'Hoy', items: hoy });
    if (dia.length) {
        sections.push({
            id: 'dia',
            title: selectedDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
            items: dia,
        });
    }
    if (programadas.length) sections.push({ id: 'programadas', title: 'Programadas', items: programadas });
    if (atrasadas.length) sections.push({ id: 'atrasadas', title: 'Atrasadas', items: atrasadas });
    return sections;
}
