'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import type ExcelJS from 'exceljs'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import type { AcademicYear } from '../penjadwalan-types'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

export function CetakClient({
  academicYears,
  context,
}: {
  academicYears: AcademicYear[]
  context: { academic_year_id: string; jenis_kelas: 'reguler' | 'regsus'; semester_ke: number }
}) {
  const router = useRouter()

  function navigate(next: Partial<typeof context>) {
    const merged = { ...context, ...next }
    const params = new URLSearchParams({
      ay: merged.academic_year_id,
      jenis: merged.jenis_kelas,
      smt: String(merged.semester_ke),
    })
    router.push(`/cetak?${params.toString()}`)
  }

  const query = new URLSearchParams({
    ay: context.academic_year_id,
    jenis: context.jenis_kelas,
    smt: String(context.semester_ke),
  }).toString()
  const xlsxUrl = `/cetak/xlsx?${query}`
  const pdfUrl = `/cetak/pdf?${query}`

  return (
    <div className="flex flex-col flex-1">
      <div className="min-h-[3.2rem] flex items-center gap-[0.53rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)] flex-wrap">
        <label className="text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-ay">
          Tahun akademik
        </label>
        <Select
          id="ctx-ay"
          value={context.academic_year_id}
          onValueChange={(v) => navigate({ academic_year_id: v })}
          options={academicYears.map((ay) => ({ value: ay.id, label: ay.label }))}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-jenis">
          Jenis Kelas
        </label>
        <Select
          id="ctx-jenis"
          value={context.jenis_kelas}
          onValueChange={(v) => navigate({ jenis_kelas: v as 'reguler' | 'regsus' })}
          options={[
            { value: 'reguler', label: 'Reguler' },
            { value: 'regsus', label: 'Reguler Khusus' },
          ]}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-smt">
          Semester
        </label>
        <Select
          id="ctx-smt"
          value={String(context.semester_ke)}
          onValueChange={(v) => navigate({ semester_ke: parseInt(v, 10) })}
          options={SEMESTERS.map((s) => ({ value: String(s), label: String(s) }))}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] bg-[var(--cekung)] font-medium cursor-pointer hover:bg-[var(--lembar)] active:scale-[0.97] transition-colors text-[0.93rem]"
        >
          Buka PDF
        </a>

        <a
          href={xlsxUrl}
          className="inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors text-[0.93rem]"
        >
          Unduh Excel
        </a>
      </div>

      <XlsxPreview key={xlsxUrl} url={xlsxUrl} />
    </div>
  )
}

type PreviewCell = { text: string; colSpan: number; rowSpan: number; style: CSSProperties }
type PreviewSheet = { widths: number[]; rows: { height: number; cells: PreviewCell[] }[] }

const H_ALIGN: Record<string, CSSProperties['textAlign']> = { left: 'left', center: 'center', right: 'right' }
const V_ALIGN: Record<string, CSSProperties['verticalAlign']> = { top: 'top', middle: 'middle', bottom: 'bottom' }
const edge = (side?: Partial<ExcelJS.Border>) => (side?.style ? '1px solid #000' : undefined)

/** Reads the same workbook "Unduh Excel" serves and lays its first sheet out as an
 *  HTML table -- free, unlike the Aspose-converted PDF, which costs API quota per view. */
async function readSheet(buffer: ArrayBuffer): Promise<PreviewSheet> {
  const { default: Excel } = await import('exceljs')
  const workbook = new Excel.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  const colCount = sheet.columnCount
  // ~7px per Excel width unit (one "0" in the default 11pt font).
  const widths = Array.from({ length: colCount }, (_, i) => Math.round((sheet.getColumn(i + 1).width ?? 9) * 7))

  const rows: PreviewSheet['rows'] = []
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const cells: PreviewCell[] = []
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c)
      if (cell.master !== cell) continue // covered by a merge started elsewhere
      let colSpan = 1
      let rowSpan = 1
      if (cell.isMerged) {
        while (c + colSpan <= colCount && sheet.getCell(r, c + colSpan).master === cell) colSpan++
        while (r + rowSpan <= sheet.rowCount && sheet.getCell(r + rowSpan, c).master === cell) rowSpan++
      }
      const { font, alignment, border } = cell
      cells.push({
        text: cell.text,
        colSpan,
        rowSpan,
        style: {
          fontWeight: font?.bold ? 700 : undefined,
          fontSize: `${font?.size ?? 11}pt`,
          textDecoration: font?.underline ? 'underline' : undefined,
          textAlign: H_ALIGN[alignment?.horizontal ?? ''],
          verticalAlign: V_ALIGN[alignment?.vertical ?? ''] ?? 'bottom',
          whiteSpace: alignment?.wrapText ? 'pre-wrap' : 'pre',
          borderTop: edge(border?.top),
          borderRight: edge(border?.right),
          borderBottom: edge(border?.bottom),
          borderLeft: edge(border?.left),
        },
      })
    }
    rows.push({ height: row.height ?? 15, cells })
  }
  return { widths, rows }
}

function XlsxPreview({ url }: { url: string }) {
  const [sheet, setSheet] = useState<PreviewSheet | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        return res.arrayBuffer()
      })
      .then(readSheet)
      .then((result) => {
        if (!cancelled) setSheet(result)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className="flex-1 overflow-auto bg-[var(--kertas)] p-[1.3rem]">
      {failed && <p className="text-center text-[0.93rem] text-[var(--merah)] py-[2rem]">Gagal memuat pratinjau.</p>}
      {!failed && !sheet && <p className="text-center text-[0.93rem] text-[var(--tinta-3)] py-[2rem]">Memuat pratinjau…</p>}
      {sheet && (
        <table
          className="mx-auto bg-white text-black border-collapse table-fixed shadow-[0_1px_4px_rgba(0,0,0,0.15)]"
          style={{ width: sheet.widths.reduce((a, b) => a + b, 0), fontFamily: 'Calibri, Carlito, Arial, sans-serif' }}
        >
          <colgroup>
            {sheet.widths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <tbody>
            {sheet.rows.map((row, r) => (
              <tr key={r} style={{ height: `${row.height}pt` }}>
                {row.cells.map((cell, c) => (
                  <td key={c} colSpan={cell.colSpan} rowSpan={cell.rowSpan} className="px-[4px] leading-[1.2]" style={cell.style}>
                    {cell.text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
