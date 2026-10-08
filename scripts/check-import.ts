import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
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

  // --- an empty workbook has no rows ---------------------------------------------------------------
  assert.deepEqual(await parseWorkbookRows(await workbookOf(() => {})), [])

  console.log('import: all checks passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
