import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { kelasPerHari, nilaiPerSemester, hitungHasilPrasidang, sidangMendatang, loadBeranda } from '../src/app/beranda-data'

// A minimal awaitable query builder: it honors eq/in/not filters so the loader's scoping is exercised.
type Filter = [string, string, unknown]
class FakeQuery {
  private filters: Filter[] = []
  constructor(private table: string, private db: Record<string, unknown[]>) {}
  select() { return this }
  eq(k: string, v: unknown) { this.filters.push(['eq', k, v]); return this }
  in(k: string, v: unknown[]) { this.filters.push(['in', k, v]); return this }
  not(k: string, _op: string, v: unknown) { this.filters.push(['not', k, v]); return this }
  gte(k: string, v: unknown) { this.filters.push(['gte', k, v]); return this }
  lte(k: string, v: unknown) { this.filters.push(['lte', k, v]); return this }
  order() { return this }
  limit() { return this }
  private static ambil(row: unknown, path: string): unknown {
    let v: unknown = row
    for (const k of path.split('.')) v = (v as Record<string, unknown> | null)?.[k]
    return v
  }
  private cocok(row: unknown) {
    return this.filters.every(([op, k, v]) => {
      const n = FakeQuery.ambil(row, k)
      if (op === 'eq') return n === v
      if (op === 'in') return Array.isArray(v) && v.includes(n)
      if (op === 'gte') return String(n) >= String(v)
      if (op === 'lte') return String(n) <= String(v)
      return n !== v
    })
  }
  then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
    const rows = this.db[this.table]
    const hasil = rows === undefined ? { data: null, error: { message: `${this.table} gagal` } } : { data: rows.filter((r) => this.cocok(r)), error: null }
    return Promise.resolve(hasil).then(resolve, reject)
  }
}

// kelasPerHari: Senin–Sabtu always, Minggu only with rows; one count per listed prodi.
const k = kelasPerHari([{ prodi: 's1', hari: 'SENIN' }, { prodi: 's1', hari: 'SENIN' }, { prodi: 's2', hari: 'RABU' }, { prodi: 's2', hari: 'SENIN' }], ['s1', 's2'])
assert.deepEqual(k.map((h) => h.hari), ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'])
assert.deepEqual(k[0].jumlah, { s1: 2, s2: 1 })
assert.deepEqual(k[2].jumlah, { s1: 0, s2: 1 })
assert.equal(k[0].label, 'Senin')
assert.equal(kelasPerHari([{ prodi: 's1', hari: 'MINGGU' }], ['s1']).at(-1)!.hari, 'MINGGU')
assert.deepEqual(kelasPerHari([{ prodi: 's2', hari: 'SENIN' }], ['s1'])[0].jumlah, { s1: 0 }, 'only listed prodi')
assert.equal(kelasPerHari([], ['s1']).length, 6, 'empty year still has the days')

// nilaiPerSemester: average of complete sidang only; semesters without one are skipped; last 4, oldest first.
const n = nilaiPerSemester([
  { academicYearId: '20251', label: '2025/2026 Gasal', nilai: [80, 70, 75] },
  { academicYearId: '20251', label: '2025/2026 Gasal', nilai: [90, 90, 90] },
  { academicYearId: '20251', label: '2025/2026 Gasal', nilai: [90, null, 90] },
  { academicYearId: '20252', label: '2025/2026 Genap', nilai: [null, 80, 80] },
  { academicYearId: '20241', label: '2024/2025 Gasal', nilai: [70, 70, 70] },
  { academicYearId: '20231', label: '2023/2024 Gasal', nilai: [60, 60, 60] },
  { academicYearId: '20232', label: '2023/2024 Genap', nilai: [65, 65, 65] },
  { academicYearId: '20242', label: '2024/2025 Genap', nilai: [72, 72, 72] },
])
assert.deepEqual(n.map((t) => t.id), ['20232', '20241', '20242', '20251'])
assert.deepEqual(n.at(-1), { id: '20251', label: '2025/2026 Gasal', rata: 82.5, n: 2 })
assert.deepEqual(nilaiPerSemester([]), [])

// hitungHasilPrasidang: a Super Admin decision wins over the berita acara.
assert.deepEqual(hitungHasilPrasidang([
  { status: 'layak', keputusan: null }, { status: 'belum_lengkap', keputusan: { hasil: 'layak_revisi', alasan: 'x' } },
  { status: 'tidak_layak', keputusan: null }, { status: 'belum_lengkap', keputusan: null },
]), { layak: 1, layak_revisi: 1, tidak_layak: 1, belum_lengkap: 1 })
assert.deepEqual(hitungHasilPrasidang([]), { layak: 0, layak_revisi: 0, tidak_layak: 0, belum_lengkap: 0 })

// sidangMendatang: today..today+7 inclusive, by date then time; place via placeLabel; jam "HH:MM–HH:MM".
const d = (id: string, tanggal: string, jam_mulai = '09:00:00') => ({ id, prodi: 's1' as const, jenis: 'sidang' as const, tanggal, jam_mulai, jam_selesai: '10:30:00', nama_mahasiswa: id, room_nama: '301', kelompok: null })
const m = sidangMendatang([d('kemarin', '2026-11-23'), d('siang', '2026-11-24', '13:00:00'), d('pagi', '2026-11-24'), d('h7', '2026-12-01'), d('h8', '2026-12-02')], '2026-11-24')
assert.deepEqual(m.map((x) => x.id), ['pagi', 'siang', 'h7'])
assert.deepEqual([m[0].jam, m[0].tempat], ['09:00–10:30', 'Ruang 301'])
assert.equal(sidangMendatang([{ ...d('k', '2026-11-24'), room_nama: null, kelompok: 2 }], '2026-11-24')[0].tempat, 'Kelompok 2')

void (async () => {
  // Locked sidang carry their grades nested (one row per sidang, under the 1000-row cap).
  const tiga = (x: number) => [{ peran: 'ketua', nilai: x }, { peran: 'anggota_1', nilai: x }, { peran: 'anggota_2', nilai: x }]
  const terkunci = (id: string, ay: string, x: number) => ({ defense_id: id, locked_at: '2026-01-01T00:00:00Z', defenses: { academic_year_id: ay, prodi: 's1', nilai_sidang: tiga(x) } })
  const db: Record<string, unknown[]> = {
    schedules: [],
    hasil_sidang: [
      terkunci('d0', '20211', 50), // older than the active year minus 3 years: not read
      terkunci('d1', '20241', 70),
      terkunci('d2', '20251', 90),
      terkunci('d3', '20261', 99), // after the active year: not read
    ],
    academic_years: [
      { id: '20211', label: '2021/2022 Gasal' },
      { id: '20241', label: '2024/2025 Gasal' },
      { id: '20251', label: '2025/2026 Gasal' },
      { id: '20261', label: '2026/2027 Gasal' },
    ],
    defenses: [],
    berita_acara_prasidang: [],
    keputusan_prasidang: [],
    audit_log: [],
  }
  const supabase = { from: (t: string) => new FakeQuery(t, db) } as unknown as SupabaseClient
  const hasil = await loadBeranda(supabase, '20251', ['s1'])
  assert.deepEqual(hasil?.nilai?.map((t) => t.id), ['20241', '20251'], 'the trend spans recent semesters up to the active one')
  assert.equal(hasil?.nilai?.at(-1)?.rata, 90)

  // A failed read leaves Beranda without its widgets instead of crashing the page.
  const rusak = { ...db }
  delete rusak.audit_log
  assert.equal(await loadBeranda({ from: (t: string) => new FakeQuery(t, rusak) } as unknown as SupabaseClient, '20251', ['s1']), null)
  console.log('beranda loader: all checks passed')
})()

console.log('beranda: all checks passed')
