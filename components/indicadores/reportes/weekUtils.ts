// ISO-8601 week helpers shared by the weekly charts on indicadores report
// pages 3-5 (Monto por Asesor, Eventos, Leads).

export function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getISOWeekYear(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    return d.getUTCFullYear();
}

// Sortable key ("2026-W05") that still lets us label the axis with only the
// week number, without merging the same week number across different years.
export function getWeekKey(date: Date): { key: string; week: number } {
    const week = getISOWeek(date);
    const year = getISOWeekYear(date);
    return { key: `${year}-W${String(week).padStart(2, "0")}`, week };
}
