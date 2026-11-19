import { PERAN_SIDANG, type PeranSidang } from './akses'
import { round2, type SkorAspek } from './nilai'

/** Always the three examiners, Ketua first; null where no grade has been sent. */
export const barPenguji = (nilai: Partial<Record<PeranSidang, number>>): { peran: PeranSidang; nilai: number | null }[] =>
  PERAN_SIDANG.map((peran) => ({ peran, nilai: nilai[peran] ?? null }))

/** Average of the sent grades, once at least two exist (one grade is not an average worth drawing). */
export function rataRata(nilai: Partial<Record<PeranSidang, number>>): number | null {
  const v = Object.values(nilai).filter((x): x is number => typeof x === 'number')
  return v.length < 2 ? null : round2(v.reduce((s, x) => s + x, 0) / v.length)
}

/** One row per aspek of the current list; each sent grade's snapshot is matched by label (a missing label: no bar). */
export function barAspek(
  aspek: { label: string }[],
  snapshot: Partial<Record<PeranSidang, SkorAspek[]>>,
): { label: string; skor: Partial<Record<PeranSidang, number>> }[] {
  return aspek.map(({ label }) => {
    const skor: Partial<Record<PeranSidang, number>> = {}
    for (const p of PERAN_SIDANG) {
      const row = snapshot[p]?.find((r) => r.label === label)
      if (row) skor[p] = row.skor
    }
    return { label, skor }
  })
}
