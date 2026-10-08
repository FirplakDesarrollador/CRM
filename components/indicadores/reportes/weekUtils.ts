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

/**
 * Ensures the current ISO week is present in a weekly chart's category axis
 * (even if it has no data yet) and returns its index, so the chart can mark
 * "we are here" instead of only showing weeks that already have data.
 * Mutates `weekLabel` in place (adding the current week if missing) and
 * returns the final sorted key list — use it in place of the usual
 * `Array.from(weekLabel.keys()).sort()` line.
 */
export function withCurrentWeekMarker(weekLabel: Map<string, number>): { weekKeys: string[]; currentIndex: number } {
    const current = getWeekKey(new Date());
    if (!weekLabel.has(current.key)) {
        weekLabel.set(current.key, current.week);
    }
    const weekKeys = Array.from(weekLabel.keys()).sort();
    return { weekKeys, currentIndex: weekKeys.indexOf(current.key) };
}

/** ECharts markLine config that draws a vertical "Semana actual" marker at a category index. */
export function currentWeekMarkLine(currentIndex: number) {
    return {
        symbol: "none" as const,
        silent: true,
        lineStyle: { color: "#f97316", width: 2, type: "dashed" as const },
        label: {
            formatter: "Semana actual",
            position: "insideEndTop" as const,
            color: "#f97316",
            fontWeight: 700 as const,
            fontSize: 10,
        },
        data: [{ xAxis: currentIndex }],
    };
}
