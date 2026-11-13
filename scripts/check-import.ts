import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import { lecturersTable, studentsTable } from '../src/lib/import/tables'
import { buildExportBuffer, buildTemplateBuffer, parseWorkbookRows } from '../src/lib/import/engine'

const toArrayBuffer = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer

async function workbookOf(fill: (sheet: ExcelJS.Worksheet) => void): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  fill(workbook.addWorksheet('Data'))
  return toArrayBuffer(new Uint8Array(await workbook.xlsx.writeBuffer()))
}

async function main() {
  // --- uploads are parsed by exceljs, not the unpatched SheetJS (prototype pollution, ReDoS) -----
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.ok(!('xlsx' in pkg.dependencies), 'the xlsx (SheetJS) dependency is gone')

  // --- the template re-parses to its example row; numbers stay numbers -------------------------
  {
    const buf = await buildTemplateBuffer(['kode_mk', 'nama_mk', 'sks'], { kode_mk: '10012001', nama_mk: 'Pancasila', sks: 2 })
    assert.deepEqual(await parseWorkbookRows(toArrayBuffer(buf)), [{ kode_mk: '10012001', nama_mk: 'Pancasila', sks: 2 }])
  }

  // --- export round-trips; an empty value comes back as '' -------------------------------------
  {
    const rows = [
      { kode_dosen: 'D1', nama: 'Budi', nidn: '0012345' },
      { kode_dosen: 'D2', nama: 'Ani', nidn: '' },
    ]
    assert.deepEqual(await parseWorkbookRows(toArrayBuffer(await buildExportBuffer(rows))), rows, 'leading zeros kept, empty is ""')
  }

  // --- cells as people type them: formulas, rich text, hyperlinks, blank rows --------------------
  {
    const buf = await workbookOf((sheet) => {
      sheet.addRow(['npm', 'nama', 'sks'])
      sheet.addRow(['6019210059', { richText: [{ text: 'Ichlasun ' }, { text: 'Naas', font: { italic: true } }] }, { formula: '1+2', result: 3 }])
      sheet.addRow([])
      sheet.addRow([{ text: '6020', hyperlink: 'https://example.com' }, 'Tiara'])
    })
    assert.deepEqual(await parseWorkbookRows(buf), [
      { npm: '6019210059', nama: 'Ichlasun Naas', sks: 3 },
      { npm: '6020', nama: 'Tiara', sks: '' },
    ])
  }

  // --- a header named __proto__ cannot pollute Object.prototype ----------------------------------
  {
    const buf = await workbookOf((sheet) => {
      sheet.addRow(['__proto__', 'nama'])
      sheet.addRow(['x', 'Budi'])
    })
    const rows = await parseWorkbookRows(buf)
    assert.equal(rows[0].nama, 'Budi')
    assert.equal(({} as Record<string, unknown>).x, undefined, 'Object.prototype untouched')
  }

  // --- Mahasiswa: IPK inputs, tepat waktu, email (the DB checks, with a reason instead of a DB error) --
  {
    const ok = studentsTable.parseRow({ npm: '1', nama: 'A', sks_sebelum: '139', bobot_sebelum: '404,57', tepat_waktu: 'ya', email: 'a@b.id' }, 2)
    assert.ok('data' in ok, 'valid row parses')
    if ('data' in ok) assert.deepEqual(ok.data, { npm: '1', nama: 'A', judul_skripsi: '', email: 'a@b.id', sks_sebelum: 139, bobot_sebelum: 404.57, tepat_waktu: true })

    // A present but blank cell means empty / not tepat waktu.
    const blank = studentsTable.parseRow({ npm: '1', nama: 'A', email: '', sks_sebelum: '', bobot_sebelum: '', tepat_waktu: '' }, 2)
    assert.ok('data' in blank)
    if ('data' in blank) assert.deepEqual(blank.data, { npm: '1', nama: 'A', judul_skripsi: '', email: '', sks_sebelum: null, bobot_sebelum: null, tepat_waktu: false })

    // An absent column (an older template or export) leaves the stored value alone: no key, equal ignores it.
    const old = studentsTable.parseRow({ npm: '1', nama: 'A', judul_skripsi: 'J' }, 2)
    assert.ok('data' in old)
    if ('data' in old) {
      assert.deepEqual(Object.keys(old.data).sort(), ['judul_skripsi', 'nama', 'npm'], 'no new keys in the upsert payload')
      const stored = { npm: '1', nama: 'A', judul_skripsi: 'J', email: 'a@b.id', sks_sebelum: 139, bobot_sebelum: 404.57, tepat_waktu: true }
      assert.ok(studentsTable.equal(stored, old.data), 'equal ignores absent columns')
      assert.ok(!studentsTable.equal(stored, { ...old.data, nama: 'B' }), 'but still sees real changes')
    }
    const onlyEmail = studentsTable.parseRow({ npm: '1', nama: 'A', email: 'a@b.id' }, 2)
    assert.ok('data' in onlyEmail && Object.keys(onlyEmail.data).includes('email') && !('tepat_waktu' in onlyEmail.data))

    for (const [v, want] of [['tidak', false], ['false', false], ['0', false], ['TRUE', true], [1, true], ['', false]] as const) {
      const r = studentsTable.parseRow({ npm: '1', nama: 'A', tepat_waktu: v }, 2)
      assert.ok('data' in r && r.data.tepat_waktu === want, `tepat_waktu ${String(v)}`)
    }
    const numeric = studentsTable.parseRow({ npm: '1', nama: 'A', sks_sebelum: 139, bobot_sebelum: 404.57 }, 2)
    assert.ok('data' in numeric && numeric.data.sks_sebelum === 139 && numeric.data.bobot_sebelum === 404.57, 'xlsx numbers')

    const reason = (raw: Record<string, unknown>) => {
      const r = studentsTable.parseRow({ npm: '1', nama: 'A', ...raw }, 2)
      assert.ok('reason' in r, `rejected: ${JSON.stringify(raw)}`)
      return 'reason' in r ? r.reason : ''
    }
    assert.match(reason({ sks_sebelum: '139', bobot_sebelum: '700' }), /^Baris 1: .*bobot/i)
    assert.match(reason({ email: 'x' }), /^Baris 1: .*email/i)
    assert.match(reason({ sks_sebelum: '0' }), /^Baris 1: .*sks/i)
    assert.match(reason({ sks_sebelum: 'abc' }), /^Baris 1: .*sks/i)
    assert.match(reason({ tepat_waktu: 'mungkin' }), /^Baris 1: .*tepat_waktu/i)

    const a = { npm: '1', nama: 'A', judul_skripsi: '', email: '', sks_sebelum: 139, bobot_sebelum: 404.57, tepat_waktu: true }
    assert.ok(studentsTable.equal(a, { ...a }))
    for (const k of ['email', 'sks_sebelum', 'bobot_sebelum', 'tepat_waktu'] as const) {
      const b = { ...a, [k]: k === 'email' ? 'x@y.id' : k === 'tepat_waktu' ? false : null }
      assert.ok(!studentsTable.equal(a, b as typeof a), `equal compares ${k}`)
    }
  }

  // --- Dosen: Email and Eksternal ----------------------------------------------------------------------
  {
    const l = lecturersTable.parseRow({ 'Kode Dosen': 'D1', 'Nama Dosen': 'Budi', Email: 'b@u.id', Eksternal: 'ya' }, 2)
    assert.ok('data' in l)
    if ('data' in l) assert.ok(l.data.eksternal === true && l.data.email === 'b@u.id')
    const none = lecturersTable.parseRow({ 'Kode Dosen': 'D1', 'Nama Dosen': 'Budi' }, 2)
    assert.ok('data' in none && !('eksternal' in none.data) && !('email' in none.data), 'no Eksternal / Email column leaves them untouched')
    const blankCells = lecturersTable.parseRow({ 'Kode Dosen': 'D1', 'Nama Dosen': 'Budi', Email: '', Eksternal: '' }, 2)
    assert.ok('data' in blankCells && blankCells.data.eksternal === false && blankCells.data.email === '', 'blank cells are false / empty')
    if ('data' in none) {
      const stored = { kode_dosen: 'D1', nidn: '', nama: 'Budi', gelar_depan: '', gelar_belakang: '', email: 'b@u.id', eksternal: true }
      assert.ok(lecturersTable.equal(stored, none.data), 'equal ignores absent columns')
    }
    const exported = lecturersTable.parseRow({ kode_dosen: 'D1', nama: 'Budi', eksternal: true }, 2)
    assert.ok('data' in exported && exported.data.eksternal === true, 'an exported boolean re-imports')
    const bad = lecturersTable.parseRow({ 'Kode Dosen': 'D1', 'Nama Dosen': 'Budi', Email: 'x' }, 2)
    assert.ok('reason' in bad && /^Baris D1: .*email/i.test(bad.reason))
    const bad2 = lecturersTable.parseRow({ 'Kode Dosen': 'D1', 'Nama Dosen': 'Budi', Eksternal: 'mungkin' }, 2)
    assert.ok('reason' in bad2 && /^Baris D1: .*Eksternal/.test(bad2.reason))
  }

  // --- an empty workbook has no rows ---------------------------------------------------------------
  assert.deepEqual(await parseWorkbookRows(await workbookOf(() => {})), [])

  console.log('import: all checks passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
