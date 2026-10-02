import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { buildExamRows, EXAM_COLUMNS, type PrintExam, type TableRow } from '../src/app/ujian/exam-rows'
import { buildUjianXlsx } from '../src/app/ujian/cetak/build-ujian-xlsx'

const exam = (o: Partial<PrintExam>): PrintExam => ({
  kode_mk: 'M1', nama_mk: 'Psikologi Umum', sks: 3, kelas: 'A', tanggal: '2025-10-27', jam_mulai: '08:00', jam_selesai: '10:00',
  dosen: ['Dr. Budi'], pengawas: ['Ani'], ruangan: '301', keterangan: 'offline', mkwu: false, ...o,
})
const text = (rows: TableRow[], r: number, c: number) => rows[r].cells[c]?.text

/** Every merge must leave exactly its covered positions null, and nothing else null. */
function assertGrid(rows: TableRow[]) {
  const covered = rows.map(() => EXAM_COLUMNS.map(() => false))
  rows.forEach((row, r) => {
    assert.equal(row.cells.length, EXAM_COLUMNS.length)
    row.cells.forEach((cell, c) => {
      if (!cell) return
      for (let dr = 0; dr < cell.rowSpan; dr++)
        for (let dc = 0; dc < cell.colSpan; dc++) {
          if (dr === 0 && dc === 0) continue
          assert.ok(r + dr < rows.length && c + dc < EXAM_COLUMNS.length, 'merge stays inside the table')
          assert.equal(covered[r + dr][c + dc], false, 'merges do not overlap')
          covered[r + dr][c + dc] = true
        }
    })
  })
  rows.forEach((row, r) => row.cells.forEach((cell, c) => assert.equal(cell === null, covered[r][c], `cell ${r},${c} is null exactly when merged over`)))
}

// --- one mata kuliah, two kelas ------------------------------------------------------
{
  const rows = buildExamRows([exam({ kelas: 'B' }), exam({ kelas: 'A' })])
  assertGrid(rows)
  assert.equal(rows.length, 2)
  assert.deepEqual([text(rows, 0, 7), text(rows, 1, 7)], ['A', 'B'], 'kelas sorted')
  assert.equal(rows[0].cells[0]?.rowSpan, 2, 'KODE MK spans the kelas rows')
  assert.equal(rows[1].cells[0], null)
  assert.equal(rows[0].cells[6]?.rowSpan, 2, 'same dosen merges')
  assert.equal(rows[0].cells[10]?.rowSpan, 2, 'same keterangan merges')
  assert.deepEqual([rows[0].blockStart, rows[1].blockStart], [true, false])
  // labels as the faculty sheet prints them
  assert.equal(text(rows, 0, 1), 'PSIKOLOGI UMUM')
  assert.equal(text(rows, 0, 3), 'SENIN')
  assert.equal(text(rows, 0, 4), '27/10/2025')
  assert.equal(text(rows, 0, 5), '08.00-10.00')
  assert.equal(text(rows, 0, 6), 'DR. BUDI')
  assert.equal(text(rows, 0, 10), 'OFFLINE')
}

// --- different dosen per kelas do not merge; pengawas stack on separate lines ---------
{
  const rows = buildExamRows([exam({ kelas: 'A' }), exam({ kelas: 'B', dosen: ['Dr. Vinaya', 'Anindya'], pengawas: ['Ani', 'Budi'], keterangan: 'take_home' })])
  assertGrid(rows)
  assert.equal(rows[0].cells[6]?.rowSpan, 1)
  assert.equal(text(rows, 1, 6), 'DR. VINAYA\nANINDYA')
  assert.equal(text(rows, 1, 8), 'ANI\nBUDI')
  assert.equal(rows[0].cells[10]?.rowSpan, 1, 'different keterangan do not merge')
  assert.equal(text(rows, 1, 10), 'TAKE HOME')
}

// --- order: by date then time, unscheduled last -----------------------------------------
{
  const rows = buildExamRows([
    exam({ kode_mk: 'Z', tanggal: null, jam_mulai: null, jam_selesai: null }),
    exam({ kode_mk: 'B', tanggal: '2025-10-28' }),
    exam({ kode_mk: 'C', jam_mulai: '11:00', jam_selesai: '13:00' }),
    exam({ kode_mk: 'A' }),
  ])
  assertGrid(rows)
  assert.deepEqual(rows.map((r) => text([r], 0, 0)), ['A', 'C', 'B', 'Z'])
  assert.equal(text(rows, 3, 3), '', 'unscheduled prints no hari')
  assert.equal(text(rows, 3, 5), '')
}

// --- GABUNGAN is one ordinary row -------------------------------------------------------
{
  const rows = buildExamRows([exam({ kelas: 'GABUNGAN' })])
  assert.equal(rows.length, 1)
  assert.equal(text(rows, 0, 7), 'GABUNGAN')
}

// --- university-run (MKWU) exams on one slot fold into one UNIVERSITAS cell -----------------
{
  const mkwu = (kode_mk: string, o: Partial<PrintExam> = {}) => exam({ kode_mk, dosen: [], pengawas: [], ruangan: '', mkwu: true, ...o })
  const rows = buildExamRows([mkwu('U1'), mkwu('U2', { kelas: 'A' }), mkwu('U2', { kelas: 'B' }), mkwu('U3'), mkwu('U4', { tanggal: '2025-10-29' }), exam({ kode_mk: 'D1' })])
  assertGrid(rows)
  const [u1, u2a, u2b, u3] = [0, 1, 2, 3]
  assert.deepEqual([u1, u2a, u2b, u3].map((i) => text(rows, i, 0) ?? null), ['U1', 'U2', null, 'U3'])
  assert.equal(rows[0].cells[3]?.rowSpan, 4, 'HARI is shared by the run')
  assert.equal(rows[0].cells[4]?.rowSpan, 4, 'TANGGAL is shared by the run')
  assert.deepEqual(rows[0].cells[5], { text: 'UNIVERSITAS', rowSpan: 4, colSpan: 6 })
  assert.equal(rows[3].cells[3], null)
  // MKWU sorts ahead of a dosen-taught exam at the same hour; another date is its own run.
  assert.equal(text(rows, 4, 0), 'D1')
  assert.equal(rows[5].cells[5]?.text, 'UNIVERSITAS')
  assert.equal(rows[5].cells[5]?.rowSpan, 1)
}

// --- the Excel file merges exactly what the rows say ------------------------------------------
async function main() {
  const rows = buildExamRows([exam({ kelas: 'A' }), exam({ kelas: 'B' }), exam({ kode_mk: 'U1', dosen: [], pengawas: [], ruangan: '', mkwu: true, tanggal: '2025-10-28' })])
  const sheet = { name: 'Semester 1', semester: 'I', angkatan: '2025/2026', headerLines: ['JADWAL', 'SEMESTER I', 'TA 2025/2026'], rows, mataKuliah: 2 }
  const buf = await buildUjianXlsx({ sheets: [sheet, { ...sheet, name: 'Semester 3', rows: [] }], namaPenandatangan: 'Nama', jabatanPenandatangan: 'Kaprodi' })
  const zip = await JSZip.loadAsync(buf)
  const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
  const merges = [...xml.matchAll(/<mergeCell ref="([^"]+)"/g)].map((m) => m[1])
  // 3 title lines + 2 signature lines + A MK's 6 spans (kode, mk, sks, hari, tanggal, jam) + dosen + keterangan + UNIVERSITAS cell
  // + the MKWU row's own hari/tanggal are single-row, so no merge
  assert.equal(merges.length, 3 + 2 + 8 + 1, merges.join(' '))
  assert.ok(merges.some((m) => /^F\d+:K\d+$/.test(m)), 'UNIVERSITAS spans JAM..KETERANGAN')
  assert.ok(xml.includes('landscape'), 'A4 landscape')
  // exceljs keeps cell text in sharedStrings, not in the sheet XML
  assert.ok((await zip.file('xl/sharedStrings.xml')!.async('string')).includes('Tidak ada data jadwal'), 'an empty semester says so')
  console.log('exam rows: all checks passed')
}
main()
