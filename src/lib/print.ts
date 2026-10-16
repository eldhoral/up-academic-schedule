const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

/** Semester number as the roman numeral the printed sheets use (I..VIII). */
export function romanSemester(semesterKe: number): string {
  return ROMAN[semesterKe] ?? String(semesterKe)
}

/**
 * The entry year (angkatan) isn't a stored column — it's derived from the
 * academic year's start year and how many years back this semester sits.
 * Academic year id is e.g. "20261" (2026/2027 Gasal); odd semesters 1/3/5/7
 * are Gasal-term semesters, each two behind the previous entry cohort.
 * Verified against PLAN.md §6b: AY 2026/2027 — smt 1 → 2026, smt 3 → 2025, smt 5 → 2024.
 */
export function computeAngkatan(academicYearId: string, semesterKe: number): number {
  const startYear = parseInt(academicYearId.slice(0, 4), 10)
  if (!Number.isFinite(startYear)) return startYear
  return startYear - Math.floor((semesterKe - 1) / 2)
}

/** Substitutes {placeholder} tokens in a settings template string. */
export function substituteTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match)
}
