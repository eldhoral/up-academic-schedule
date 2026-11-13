import type { BarisNilai } from './aturan'

/** Half-up to 2 decimals. The toPrecision step absorbs binary noise (75.995 * 100 = 7599.499999...). */
export function round2(n: number): number {
  return Math.round(Number((n * 100).toPrecision(12))) / 100
}

export type ParseAngka = { ok: true; value: number } | { ok: false; error: string }

/** A typed score: comma or dot decimal, at most 2 decimals, within [min, max]. */
export function parseAngka(raw: string, min: number, max: number): ParseAngka {
  const s = raw.trim()
  if (!s) return { ok: false, error: 'Wajib diisi' }
  if (!/^\d+([.,]\d{1,2})?$/.test(s)) return { ok: false, error: 'Angka tidak valid (maksimal 2 desimal)' }
  const value = Number(s.replace(',', '.'))
  if (value < min || value > max) return { ok: false, error: `Harus antara ${formatNilai(min)} dan ${formatNilai(max)}` }
  return { ok: true, value }
}

export type SkorAspek = { label: string; bobot: number; skor: number }

export function nilaiDariSnapshot(rows: SkorAspek[]): number {
  return round2(rows.reduce((sum, r) => sum + (r.skor * r.bobot) / 100, 0))
}

/** Average of both dosen, only once both have graded. */
export function nilaiBimbingan(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : round2((a + b) / 2)
}

/** The row with the highest batas bawah <= the rounded score (lowest row if below all). */
export function baris(n: number, tabel: BarisNilai[]): BarisNilai {
  const r = round2(n)
  const sorted = [...tabel].sort((x, y) => y.min - x.min)
  return sorted.find((row) => row.min <= r) ?? sorted[sorted.length - 1]
}

/** IPK before sidang = bobot / sks, null when either is missing. */
export function ipkSebelum(bobot: number | null, sks: number | null): number | null {
  return bobot === null || !sks ? null : round2(bobot / sks)
}

/** 78.5 -> '78,50' */
export function formatNilai(n: number): string {
  return round2(n).toFixed(2).replace('.', ',')
}
