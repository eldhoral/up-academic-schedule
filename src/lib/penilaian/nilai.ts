import type { AturanBeku, BarisNilai, BarisPredikat } from './aturan'

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

/** Average of the three examiners, only once all three have graded. */
export function nilaiSidang(n: (number | null)[]): number | null {
  return n.length !== 3 || n.some((x) => x === null) ? null : round2((n as number[]).reduce((s, x) => s + x, 0) / 3)
}

/** IPK after the thesis counts: (bobot + sksSkripsi * mutu) / (sks + sksSkripsi). */
export function ipkSetelah(bobot: number, sks: number, mutu: number, sksSkripsi: number): number {
  return round2((bobot + sksSkripsi * mutu) / (sks + sksSkripsi))
}

/**
 * The row whose [min, max] holds the IPK, compared in whole hundredths. A row that needs tepat waktu
 * steps down to the next lower row that doesn't; nothing below, or IPK under every row, gives null.
 */
export function predikat(ipk: number, tepatWaktu: boolean, rows: BarisPredikat[]): string | null {
  const h = (n: number) => Math.round(n * 100)
  const i = h(round2(ipk))
  const sorted = [...rows].sort((a, b) => b.min - a.min)
  let k = sorted.findIndex((r) => h(r.min) <= i && i <= h(r.max))
  while (k >= 0 && k < sorted.length && sorted[k].butuhTepatWaktu && !tepatWaktu) k++
  return k >= 0 && k < sorted.length ? sorted[k].predikat : null
}

export type HasilAkhir =
  | { status: 'menunggu-ketua' | 'menunggu-bimbingan' | 'tidak-lulus' | 'data-kurang'; nilaiSidang: number | null; alasan: string }
  | {
    status: 'lengkap'; nilaiSidang: number; nilaiAkhir: number; huruf: string; mutu: number
    ipkSebelum: number; ipkSetelah: number; predikat: string | null
  }

/** One student's sidang outcome. Rules come from the frozen copy, so a later rules edit never changes it. */
export function hasilAkhir(input: {
  sidang: (number | null)[]
  locked: { lulus: boolean; aturan: AturanBeku } | null
  bimbingan: number | null
  sks: number | null
  bobot: number | null
  tepatWaktu: boolean
}): HasilAkhir {
  const ns = nilaiSidang(input.sidang)
  const { locked, bimbingan, sks, bobot } = input
  if (!locked) return { status: 'menunggu-ketua', nilaiSidang: ns, alasan: 'Menunggu Ketua Penguji mengunci hasil sidang' }
  if (!locked.lulus) return { status: 'tidak-lulus', nilaiSidang: ns, alasan: 'Yudisium tidak lulus, Nilai Akhir tidak dihitung' }
  if (ns === null) return { status: 'data-kurang', nilaiSidang: null, alasan: 'Nilai penguji belum lengkap' }
  if (bimbingan === null) return { status: 'menunggu-bimbingan', nilaiSidang: ns, alasan: 'Menunggu Nilai Bimbingan lengkap' }
  if (sks === null || sks <= 0 || bobot === null) return { status: 'data-kurang', nilaiSidang: ns, alasan: 'SKS/Bobot belum diisi' }
  const nilaiAkhir = round2((bimbingan + ns) / 2)
  const { huruf, mutu } = baris(nilaiAkhir, locked.aturan.tabelNilai)
  const ipk = ipkSetelah(bobot, sks, mutu, locked.aturan.sksSkripsi)
  return {
    status: 'lengkap', nilaiSidang: ns, nilaiAkhir, huruf, mutu,
    ipkSebelum: round2(bobot / sks), ipkSetelah: ipk,
    predikat: predikat(ipk, input.tepatWaktu, locked.aturan.predikat),
  }
}

/** 78.5 -> '78,50' */
export function formatNilai(n: number): string {
  return round2(n).toFixed(2).replace('.', ',')
}

/** The unique (defense_id, peran) answer to a double submit; the form refreshes into the read-only view on it. */
export const SUDAH_DIKIRIM = 'Nilai sudah dikirim.'
export const ASPEK_BERUBAH = 'Daftar aspek penilaian berubah. Muat ulang halaman lalu isi lagi.'

/** The aspek list a form showed ([label, bobot] in order) still equals the current one. From the client, so shape-checked. */
export function aspekSama(tampil: unknown, kini: { label: string; bobot: number }[]): boolean {
  return Array.isArray(tampil) && tampil.length === kini.length &&
    tampil.every((t, i) => Array.isArray(t) && t.length === 2 && t[0] === kini[i].label && t[1] === kini[i].bobot)
}

/**
 * The snapshot a grade stores: one typed skor per aspek row, in order. `skor` comes from the client,
 * so its shape is checked here too. The first bad row is named in the error.
 */
export function snapshotDariSkor(aspek: { label: string; bobot: number }[], skor: unknown): { aspek: SkorAspek[] } | { error: string } {
  if (!Array.isArray(skor) || skor.length !== aspek.length || !skor.every((s) => typeof s === 'string')) {
    return { error: ASPEK_BERUBAH }
  }
  const rows: SkorAspek[] = []
  for (const [i, a] of aspek.entries()) {
    const p = parseAngka(skor[i], 0, 100)
    if (!p.ok) return { error: `${a.label}: ${p.error}` }
    rows.push({ label: a.label, bobot: a.bobot, skor: p.value })
  }
  return { aspek: rows }
}
