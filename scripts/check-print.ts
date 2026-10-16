import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { buildXlsx } from '../src/app/[prodi]/kuliah/cetak/build-xlsx'
import { computeAngkatan, romanSemester, substituteTemplate } from '../src/lib/print'
import { hariFromTanggal } from '../src/lib/hari'

// Verified against PLAN.md §6b for AY 2026/2027 Gasal (id "20261").
assert.equal(computeAngkatan('20261', 1), 2026)
assert.equal(computeAngkatan('20261', 3), 2025)
assert.equal(computeAngkatan('20261', 5), 2024)
assert.equal(computeAngkatan('20261', 7), 2023)
assert.equal(computeAngkatan('20261', 2), 2026, 'even semesters share the odd semester below them')

assert.equal(romanSemester(1), 'I')
assert.equal(romanSemester(3), 'III')
assert.equal(romanSemester(8), 'VIII')

assert.equal(
  substituteTemplate('SEMESTER {semester} ANGKATAN {angkatan}', { semester: 'I', angkatan: '2026' }),
  'SEMESTER I ANGKATAN 2026'
)
assert.equal(substituteTemplate('no placeholders here', {}), 'no placeholders here')
assert.equal(substituteTemplate('{missing} stays literal', {}), '{missing} stays literal')

// Dates the faculty sheets use: 27 Oct 2025 was a Monday, 3 Feb 2026 a Tuesday, 24 Nov 2025 a Monday.
assert.equal(hariFromTanggal('2025-10-27'), 'SENIN')
assert.equal(hariFromTanggal('2026-02-03'), 'SELASA')
assert.equal(hariFromTanggal('2025-11-24'), 'SENIN')
assert.equal(hariFromTanggal('2025-11-30'), 'MINGGU')

// Jadwal kuliah: Wakil Dekan I signs on the left, Kaprodi on the right.
async function kuliahSheet() {
  const buf = await buildXlsx({
    sheets: [{ name: 'Semester 1', headerLines: ['JADWAL'], schedules: [] }],
    zoomId: '', zoomPasscode: '', keteranganLines: [], ukuranKertas: 'A4', orientasi: 'portrait',
    namaPenandatangan: 'FARIDA AINI', jabatanPenandatangan: 'KETUA PROGRAM STUDI', namaWakilDekan: 'DR. VINAYA, M.SI', jabatanWakilDekan: 'WAKIL DEKAN I',
  })
  const zip = await JSZip.loadAsync(buf)
  const strings = await zip.file('xl/sharedStrings.xml')!.async('string')
  assert.ok(strings.includes('WAKIL DEKAN I') && strings.includes('DR. VINAYA, M.SI') && strings.includes('FARIDA AINI'), 'both sign')
  const merges = [...(await zip.file('xl/worksheets/sheet1.xml')!.async('string')).matchAll(/<mergeCell ref="([^"]+)"/g)].map((m) => m[1])
  assert.ok(merges.some((m) => /^A\d+:C\d+$/.test(m)), 'Wakil Dekan block over A:C')
  assert.equal(zip.file(/^xl\/media\//).length, 0, 'no signature image uploaded, no image in the sheet')

  // With a Kaprodi signature uploaded it sits in the blank rows under the right-hand jabatan.
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  const signed = await JSZip.loadAsync(
    await buildXlsx({
      sheets: [{ name: 'Semester 1', headerLines: ['JADWAL'], schedules: [] }],
      zoomId: '', zoomPasscode: '', keteranganLines: [], ukuranKertas: 'A4', orientasi: 'portrait',
      namaPenandatangan: 'FARIDA AINI', jabatanPenandatangan: 'KETUA PROGRAM STUDI', namaWakilDekan: 'DR. VINAYA, M.SI', jabatanWakilDekan: 'WAKIL DEKAN I',
      gambarTandaTangan: png,
    }),
  )
  assert.equal(signed.file(/^xl\/media\/.*\.png$/).length, 1, 'the signature image is embedded')
  const drawing = await signed.file(/^xl\/drawings\/drawing\d+\.xml$/)[0].async('string')
  const shared = [...(await signed.file('xl/sharedStrings.xml')!.async('string')).matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1])
  const sheetXml = await signed.file('xl/worksheets/sheet1.xml')!.async('string')
  const jabatanRow = Number(new RegExp(`<c r="E(\\d+)"[^>]*t="s"><v>${shared.indexOf('KETUA PROGRAM STUDI')}</v>`).exec(sheetXml)![1])
  const from = /<xdr:from><xdr:col>(\d+)<\/xdr:col><xdr:colOff>(\d+)<\/xdr:colOff><xdr:row>(\d+)<\/xdr:row>/.exec(drawing)!
  assert.ok(Number(from[1]) >= 4 && Number(from[1]) <= 7, 'over the Kaprodi block (E:H), not the Wakil Dekan one')
  assert.ok(Number(from[2]) > 0, 'centred, not flush left')
  assert.equal(Number(from[3]), jabatanRow, 'starts on the row right under the jabatan (0-based anchor row)')
  console.log('print: all checks passed')
}
kuliahSheet()
