import type { Prodi } from '@/lib/prodi'
import { DocFacts, PreviewLayout, PreviewTable, cell } from '@/components/preview'
import { tanggalPanjang } from '@/lib/hari'
import { DEFENSE_COLUMNS } from '../defense-blocks'
import type { DefenseJenis } from '../defense-types'
import type { SidangSheet } from './sidang-cetak-data'

export type SidangDoc = {
  zoomId: string
  zoomPasscode: string
  namaWakilDekan: string
  jabatanWakilDekan: string
  namaPenandatangan: string
  jabatanPenandatangan: string
}

const MONO_COLUMNS = new Set([0, 1, 2]) // SESI, WAKTU, NPM

export function SidangCetakPreview({ jenis, sheets, doc, prodi }: { jenis: DefenseJenis; sheets: SidangSheet[]; doc: SidangDoc; prodi: Prodi }) {
  return (
    <PreviewLayout
      main={sheets.map((sheet) => (
        <BlockSection key={sheet.name} jenis={jenis} sheet={sheet} doc={doc} />
      ))}
      panel={
        <DocFacts
          prodi={prodi}
          title="Isi file selain jadwal"
          items={[
            ...(jenis === 'prasidang' ? [{ label: 'Bor Zoom', value: [doc.zoomId && `ID ${doc.zoomId}`, doc.zoomPasscode && `Passcode ${doc.zoomPasscode}`] }] : []),
            { label: 'Mengetahui', value: [doc.jabatanWakilDekan, doc.namaWakilDekan] },
            { label: 'Penandatangan', value: [doc.jabatanPenandatangan, doc.namaPenandatangan] },
            { label: 'Kertas', value: 'A4 · Lanskap' },
          ]}
        />
      }
    />
  )
}

function BlockSection({ jenis, sheet, doc }: { jenis: DefenseJenis; sheet: SidangSheet; doc: SidangDoc }) {
  const columns = DEFENSE_COLUMNS[jenis]
  const place = jenis === 'sidang' ? `Ruang ${sheet.ruang}` : `Kelompok ${sheet.kelompok}${doc.zoomId ? ` · Zoom ${doc.zoomId}` : ''}`

  return (
    <section aria-label={`${tanggalPanjang(sheet.tanggal, false)} ${place}`}>
      <div className="sticky top-0 z-10 bg-[var(--kertas)] pb-[0.4rem] flex items-baseline gap-[0.8rem] flex-wrap">
        <h2 className="m-0 text-[1.2rem] font-semibold tracking-[-0.01em] text-[var(--tinta)]">{tanggalPanjang(sheet.tanggal, false)}</h2>
        <p className="m-0 text-[0.87rem] text-[var(--tinta-3)]">
          {place} · {sheet.rows.length} mahasiswa
        </p>
      </div>

      <PreviewTable label={`Jadwal ${jenis} ${tanggalPanjang(sheet.tanggal, false)} ${place}`} columns={columns.map((c) => ({ label: c.label, align: c.center ? ('center' as const) : ('left' as const) }))}>
        {sheet.rows.map((row, ri) => (
          <tr key={ri} className="h-[2.6rem] border-t border-[var(--garis)]">
            {row.cells.map((text, ci) => (
              <td key={ci} className={`${cell(columns[ci].center ? 'center' : 'left')} ${MONO_COLUMNS.has(ci) ? 'mono' : ''}`}>
                {text || <span className="text-[var(--tinta-3)]">—</span>}
              </td>
            ))}
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
