import { BandRow, DocFacts, PreviewLayout, PreviewTable, cell } from '@/components/preview'
import { COLUMN_ALIGN, COLUMN_LABELS } from './columns'
import type { PrintRow } from './schedule-rows'

export type PreviewSheet = {
  name: string
  semester: string // roman numeral
  angkatan: string
  headerLines: string[]
  groups: [string, PrintRow[]][]
}

export type CetakDoc = {
  zoomId: string
  zoomPasscode: string
  keteranganLines: string[]
  namaPenandatangan: string
  jabatanPenandatangan: string
  hasTandaTangan: boolean
  ukuranKertas: string
  orientasi: string
}

const COLUMNS = COLUMN_LABELS.map((label, i) => ({ label, align: COLUMN_ALIGN[i] }))
const MONO_COLUMNS = new Set([0, 2, 4, 7]) // KODE MK, SKS, JAM, BOR ZOOM

export function CetakPreview({ sheets, doc }: { sheets: PreviewSheet[]; doc: CetakDoc }) {
  return (
    <PreviewLayout
      main={sheets.map((sheet) => (
        <SheetSection key={sheet.name} sheet={sheet} />
      ))}
      panel={
        <DocFacts
          title="Isi file selain jadwal"
          items={[
            { label: 'Bor Zoom', value: [doc.zoomId && `ID ${doc.zoomId}`, doc.zoomPasscode && `Passcode ${doc.zoomPasscode}`] },
            { label: 'Keterangan', value: doc.keteranganLines },
            {
              label: 'Penandatangan',
              value: [doc.jabatanPenandatangan, doc.namaPenandatangan, doc.hasTandaTangan ? 'Tanda tangan terpasang' : 'Tanda tangan belum diunggah'],
            },
            { label: 'Kertas', value: `${doc.ukuranKertas} · ${doc.orientasi === 'landscape' ? 'Lanskap' : 'Potret'}` },
          ]}
        />
      }
    />
  )
}

function SheetSection({ sheet }: { sheet: PreviewSheet }) {
  const jadwal = sheet.groups.reduce((sum, [, rows]) => sum + rows.length, 0)

  return (
    <section aria-label={`Semester ${sheet.semester}`}>
      <div className="sticky top-0 z-10 bg-[var(--kertas)] pb-[0.4rem] flex items-baseline gap-[0.8rem] flex-wrap">
        <h2 className="m-0 text-[1.2rem] font-semibold tracking-[-0.01em] text-[var(--tinta)]">Semester {sheet.semester}</h2>
        <p className="m-0 text-[0.87rem] text-[var(--tinta-3)]">
          Angkatan {sheet.angkatan} · {sheet.groups.length} kelas · {jadwal} jadwal
        </p>
      </div>

      <PreviewTable label={`Jadwal semester ${sheet.semester}`} columns={COLUMNS}>
        {sheet.groups.map(([kelas, rows]) => (
          <KelasRows key={kelas} kelas={kelas} rows={rows} />
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

function KelasRows({ kelas, rows }: { kelas: string; rows: PrintRow[] }) {
  return (
    <>
      <BandRow span={COLUMNS.length}>KELAS {kelas}</BandRow>
      {rows.map((r, i) => {
        // The day shows once per run of rows, so the week reads down the table.
        const sameDay = i > 0 && rows[i - 1].hari === r.hari
        const values = [r.kode_mk, r.mata_kuliah, r.sks, sameDay ? null : r.hari, r.jam, r.dosen, r.ruangan, r.zoom]
        return (
          <tr
            key={r.id}
            className={`h-[2.6rem] border-t ${sameDay ? 'border-[var(--garis)]' : 'border-[var(--garis-kuat)]'} ${r.override ? 'bg-[var(--merah-lembut)]' : ''}`}
          >
            {values.map((value, col) => (
              <td key={col} className={`${cell(COLUMN_ALIGN[col])} ${MONO_COLUMNS.has(col) ? 'mono' : ''} ${col === 3 ? 'font-medium' : ''}`}>
                {col === 3 && sameDay ? <span className="sr-only">{r.hari}</span> : value}
              </td>
            ))}
          </tr>
        )
      })}
    </>
  )
}
