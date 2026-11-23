import assert from 'node:assert/strict'
import { kelasPerHari, nilaiPerSemester, hitungHasilPrasidang, sidangMendatang } from '../src/app/beranda-data'

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

console.log('beranda: all checks passed')
