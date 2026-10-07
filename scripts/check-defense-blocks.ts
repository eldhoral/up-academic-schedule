import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { tanggalPanjang } from '../src/lib/hari'
import { buildDefenseBlocks, sheetName, type DefenseBlock } from '../src/app/[prodi]/sidang/defense-blocks'
import { buildSidangXlsx } from '../src/app/[prodi]/sidang/cetak/build-sidang-xlsx'
import type { DefenseRow } from '../src/app/[prodi]/sidang/defense-types'

const row = (o: Partial<DefenseRow>): DefenseRow => ({
  id: 'x', academic_year_id: '20252', jenis: 'sidang', tanggal: '2026-02-03', jam_mulai: '08:00', jam_selesai: '10:00', room_id: 'r301', room_nama: '301', kelompok: null,
  npm: '2210001', nama_mahasiswa: 'Alfia', judul_skripsi: 'Judul', pembimbing_kode: 'D1', penguji_kode: 'D2', penguji_eksternal: 'Prof. Farida', is_override: false, ...o,
})
const names = new Map([['D1', 'Dr. Budi'], ['D2', 'Dr. Ani']])

// --- dates ----------------------------------------------------------------------------------
assert.equal(tanggalPanjang('2026-02-03'), 'SELASA, 3 FEBRUARI 2026')
assert.equal(tanggalPanjang('2025-11-24', false), 'Senin, 24 November 2025')

// --- sidang blocks: date x room, time-ordered rows, SESI numbered per block ---------------------
{
  const blocks = buildDefenseBlocks(
    [
      row({ npm: '3', jam_mulai: '13:00', jam_selesai: '15:00' }),
      row({ npm: '1' }),
      row({ npm: '2', jam_mulai: '10:00', jam_selesai: '12:00' }),
      row({ npm: '4', room_nama: '302', room_id: 'r302' }),
      row({ npm: '5', tanggal: '2026-02-02' }),
    ],
    names,
  )
  assert.deepEqual(blocks.map((b) => `${b.tanggal} ${b.ruang}`), ['2026-02-02 301', '2026-02-03 301', '2026-02-03 302'], 'date, then room')
  const day = blocks[1]
  assert.deepEqual(day.rows.map((r) => r.cells[2]), ['1', '2', '3'], 'time order')
  assert.deepEqual(day.rows.map((r) => r.cells[0]), ['1', '2', '3'], 'SESI is numbered within the block')
  assert.equal(day.rows[0].cells[1], '08.00-10.00')
  assert.deepEqual(day.rows[0].cells.slice(5), ['Dr. Ani', 'Prof. Farida', 'Dr. Budi'], 'Ketua, Penguji I (eksternal), Penguji II (pembimbing)')
  assert.equal(blocks[2].rows[0].cells[0], '1', 'a new block restarts SESI')
}

// --- prasidang blocks: date x kelompok, kelompok in numeric order ---------------------------------
{
  const p = (o: Partial<DefenseRow>) => row({ jenis: 'prasidang', room_id: null, room_nama: null, penguji_eksternal: '', kelompok: 1, ...o })
  const blocks = buildDefenseBlocks([p({ kelompok: 10, npm: 'a' }), p({ kelompok: 2, npm: 'b' }), p({ kelompok: 1, npm: 'c' })], names)
  assert.deepEqual(blocks.map((b) => b.kelompok), [1, 2, 10])
  assert.deepEqual(blocks[0].rows[0].cells.slice(5), ['Dr. Budi', 'Dr. Ani'], 'Pembimbing Pendamping, Pembahas')
  assert.equal(blocks[0].rows[0].cells.length, 7)
}

// --- sheet names ------------------------------------------------------------------------------
{
  const taken = new Set<string>()
  const sidangBlock = { tanggal: '2026-02-03', ruang: '301', kelompok: null } as DefenseBlock
  assert.equal(sheetName(sidangBlock, 'sidang', taken), '03-02 R301')
  assert.equal(sheetName(sidangBlock, 'sidang', taken), '03-02 R301 2', 'a clash gets a counter')
  assert.equal(sheetName({ tanggal: '2025-11-24', ruang: '', kelompok: 1 } as DefenseBlock, 'prasidang', taken), '24-11 K1')
  const odd = sheetName({ tanggal: '2026-02-03', ruang: 'Lab: [A]/B*? ' + 'x'.repeat(40), kelompok: null } as DefenseBlock, 'sidang', new Set())
  assert.ok(odd.length <= 31 && !/[[\]:*?/\\]/.test(odd), odd)
}

// --- the Excel files -----------------------------------------------------------------------------
async function main() {
  const common = { zoomId: '315 414 7118', zoomPasscode: '2025', namaWakilDekan: 'DR. VINAYA, M.SI', jabatanWakilDekan: 'WAKIL DEKAN I', namaPenandatangan: 'Dr. Kaprodi', jabatanPenandatangan: 'KETUA PROGRAM STUDI' }
  const sheetsOf = (rows: DefenseRow[], jenis: 'sidang' | 'prasidang') => {
    const taken = new Set<string>()
    return buildDefenseBlocks(rows, names).map((b) => ({ ...b, name: sheetName(b, jenis, taken), headerLines: ['JADWAL', 'SELASA, 3 FEBRUARI 2026', 'RUANG 301'] }))
  }
  const merges = async (zip: JSZip, n: number) => [...(await zip.file(`xl/worksheets/sheet${n}.xml`)!.async('string')).matchAll(/<mergeCell ref="([^"]+)"/g)].map((m) => m[1])

  // sidang: two blocks -> two sheets; 3 title lines + jabatan and nama on both sides
  const sidang = await JSZip.loadAsync(await buildSidangXlsx({ ...common, jenis: 'sidang', sheets: sheetsOf([row({ npm: '0012345' }), row({ npm: '9', room_nama: '302', room_id: 'r302' })], 'sidang') }))
  const book = await sidang.file('xl/workbook.xml')!.async('string')
  assert.ok(book.includes('03-02 R301') && book.includes('03-02 R302'), 'one sheet per room')
  const sm = await merges(sidang, 1)
  assert.equal(sm.length, 3 + 4, sm.join(' '))
  assert.ok(sm.some((m) => /^F\d+:H\d+$/.test(m)), 'Kaprodi block over F:H')
  const strings = await sidang.file('xl/sharedStrings.xml')!.async('string')
  assert.ok(strings.includes('0012345'), 'NPM keeps its leading zeros')
  assert.ok(!strings.includes('MENGETAHUI'), 'sidang has no MENGETAHUI line')
  const sheet1 = await sidang.file('xl/worksheets/sheet1.xml')!.async('string')
  assert.ok(sheet1.includes('landscape') && sheet1.includes('ht="31.5"'), 'A4 landscape, 31.5pt header row')

  // prasidang: zoom row (3 merges), MENGETAHUI, signatures
  const prasidang = await JSZip.loadAsync(
    await buildSidangXlsx({ ...common, jenis: 'prasidang', sheets: sheetsOf([row({ jenis: 'prasidang', room_id: null, room_nama: null, kelompok: 1, penguji_eksternal: '' })], 'prasidang') }),
  )
  const pm = await merges(prasidang, 1)
  assert.equal(pm.length, 3 + 3 + 1 + 4, pm.join(' '))
  const pstrings = await prasidang.file('xl/sharedStrings.xml')!.async('string')
  assert.ok(pstrings.includes('MENGETAHUI,') && pstrings.includes('BREAK OUT ROOM KELOMPOK 1') && pstrings.includes('ID ZOOM : 315 414 7118'))

  // nothing to print still gives a valid file
  const empty = await JSZip.loadAsync(await buildSidangXlsx({ ...common, jenis: 'sidang', sheets: [] }))
  assert.ok((await empty.file('xl/sharedStrings.xml')!.async('string')).includes('Tidak ada data jadwal'))
  console.log('defense blocks: all checks passed')
}
main()
