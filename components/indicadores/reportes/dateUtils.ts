// Defends the "Año" filter dropdowns against typo'd dates in the source data
// (e.g. "20206-04-30" instead of "2026-04-30") so a single bad record can't
// inject an implausible year into the options list, regardless of whether the
// underlying record has already been fixed or the local offline cache is
// still stale.
export function isPlausibleYear(year: number): boolean {
    const currentYear = new Date().getFullYear();
    return Number.isInteger(year) && year >= 2000 && year <= currentYear + 5;
}
