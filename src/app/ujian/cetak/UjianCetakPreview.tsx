import { DocFacts, PreviewLayout, PreviewTable, cell } from '@/components/preview'
import { EXAM_ALIGN, EXAM_COLUMNS } from '../exam-rows'
import type { UjianSheet } from './ujian-cetak-data'

const COLUMNS = EXAM_COLUMNS.map((label, i) => ({ label, align: EXAM_ALIGN[i] }))
const MONO_COLUMNS = new Set([0, 2, 4, 5, 7]) // KODE MK, SKS, TANGGAL, JAM, KELAS

export function UjianCetakPreview({ sheets, doc }: { sheets: UjianSheet[]; doc: { namaPenandatangan: string; jabatanPenandatangan: string } }) {
  return (
    <PreviewLayout
      main={sheets.map((sheet) => (
        <SheetSection key={sheet.name} sheet={sheet} />
      ))}
      panel={
        <DocFacts
          title="Isi file selain jadwal"
          items={[
            { label: 'Penandatangan', value: [doc.jabatanPenandatangan, doc.namaPenandatangan] },
            { label: 'Kertas', value: 'A4 · Lanskap' },
          ]}
        />
      }
    />
  )
}

function SheetSection({ sheet }: { sheet: UjianSheet }) {
  return (
    <section aria-label={`Semester ${sheet.semester}`}>
      <div className="sticky top-0 z-10 bg-[var(--kertas)] pb-[0.4rem] flex items-baseline gap-[0.8rem] flex-wrap">
        <h2 className="m-0 text-[1.2rem] font-semibold tracking-[-0.01em] text-[var(--tinta)]">Semester {sheet.semester}</h2>
        <p className="m-0 text-[0.87rem] text-[var(--tinta-3)]">
          Angkatan {sheet.angkatan} · {sheet.mataKuliah} mata kuliah · {sheet.rows.length} baris
        </p>
      </div>

      <PreviewTable label={`Jadwal ujian semester ${sheet.semester}`} columns={COLUMNS}>
        {sheet.rows.map((row, ri) => (
          <tr key={ri} className={`h-[2.6rem] border-t ${row.blockStart ? 'border-[var(--garis-kuat)]' : 'border-[var(--garis)]'}`}>
            {row.cells.map((c, col) =>
              c === null ? null : (
                <td
                  key={col}
                  rowSpan={c.rowSpan}
                  colSpan={c.colSpan}
                  className={`${cell(c.colSpan > 1 ? 'center' : EXAM_ALIGN[col])} whitespace-pre-line ${MONO_COLUMNS.has(col) ? 'mono' : ''} ${
                    c.colSpan > 1 ? 'bg-[var(--cekung)] font-medium text-[var(--tinta-2)]' : ''
                  } ${col === 1 || col === 3 ? 'font-medium' : ''}`}
                >
                  {c.text}
                </td>
              ),
            )}
          </tr>
        ))}
      </PreviewTable>

      <details className="mt-[0.4rem]">
        <summary className="cursor-pointer text-[0.8rem] text-[var(--tinta-3)]">Judul di file ({sheet.headerLines.length} baris)</summary>
        <div className="mt-[0.27rem] text-[0.87rem] text-[var(--tinta-2)]">
          {sheet.headerLines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </details>
    </section>
  )
}
