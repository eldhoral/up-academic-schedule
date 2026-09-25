import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { buildSuratDocx } from '../src/app/rekap/build-surat-docx'

// Calibrated against Aspose Words renders on A4 with the faculty's 5-line kop and 3 tembusan
// lines: 4 classes (with 2-line zoom cells) overflow by one line, so the estimate splits from 4.
const lecturer = { kode_dosen: 'D1', nama: 'Budi Santoso', gelar_depan: 'Dr.', gelar_belakang: 'M.Kom' }
const schedule = (i: number, jenis: 'reguler' | 'regsus') => ({
  id: String(i), kelas: 'A', jenis_kelas: jenis, hari: 'SENIN', jam_mulai: '08:00:00', jam_selesai: '10:30:00',
  kode_mk: String(i), courses: { nama_mk: 'PENGEMBANGAN DIRI DAN KARIER', sks: 3 }, schedule_lecturers: [],
  rooms: { nama: 'R.301' }, zoom_id: '839 1234 5678', minggu: 'setiap',
})

async function tableCount(rows: ReturnType<typeof schedule>[]) {
  const buf = await buildSuratDocx({
    lecturersToRender: [lecturer], byDosen: new Map([['D1', rows]]), namaFakultas: 'Teknik', kota: 'Jakarta',
    kopLines: ['FAKULTAS PSIKOLOGI', 'Gedung', 'Alamat', 'Telp. | Website', 'E-mail'], term: 'GANJIL', tahun: '2026/2027',
    nomorSurat: '1', lampiranSurat: '-', perihalSurat: '-', catatanPerkuliahan: 'Catatan: perkuliahan dimulai 1 September.',
    namaDekan: 'Nama Dekan', jabatanDekan: 'Dekan', gambarTandaTanganDekan: '', tembusanLines: ['A', 'B', 'C'],
  } as unknown as Parameters<typeof buildSuratDocx>[0])
  const xml = await (await JSZip.loadAsync(buf)).file('word/document.xml')!.async('string')
  return (xml.match(/<w:tbl>/g) ?? []).length
}

const mixed = (n: number) => Array.from({ length: n }, (_, i) => schedule(i, i % 2 ? 'regsus' : 'reguler'))

async function main() {
  assert.equal(await tableCount(mixed(3)), 1, 'a short letter keeps one table')
  assert.equal(await tableCount(mixed(12)), 2, 'an overlong letter splits Reguler / Reguler Khusus')
  assert.equal(
    await tableCount(Array.from({ length: 12 }, (_, i) => schedule(i, 'reguler'))),
    1,
    'no split when only one section has classes',
  )

  console.log('surat fit: all checks passed')
}

main()
