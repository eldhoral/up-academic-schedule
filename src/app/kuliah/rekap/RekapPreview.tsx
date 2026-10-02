import Link from 'next/link'
import { BandRow, DocFacts, PreviewLayout, PreviewTable, cell } from '@/components/preview'
import { TABLE_HEADER, type LetterSection } from './letter-rows'

export type IndexRow = { kode_dosen: string; nama: string; jadwal: number; sks: number }

export type LetterView = {
  nama: string
  sections: LetterSection[]
  totalSks: number
  jadwal: number
  position: number // 1-based, among the dosen with a load
  total: number
  prev: string | null // kode_dosen
  next: string | null
}

export type SuratFacts = {
  kota: string
  namaFakultas: string
  kopLines: string[]
  nomorSurat: string
  lampiranSurat: string
  perihalSurat: string
  catatanPerkuliahan: string
  namaDekan: string
  jabatanDekan: string
  hasTandaTangan: boolean
  tembusanLines: string[]
}

const COLUMNS = TABLE_HEADER.map((label, i) => ({ label, align: i === 1 ? ('left' as const) : ('center' as const) }))
const MONO_COLUMNS = new Set([0, 2, 4, 7]) // NO., SKS, JAM, BOR ZOOM

const facts = (f: SuratFacts) => [
  { label: 'Kop surat', value: f.kopLines },
  { label: 'Nomor', value: f.nomorSurat },
  { label: 'Tanggal', value: `${f.kota}, tanggal saat diunduh` },
  { label: 'Lampiran', value: f.lampiranSurat },
  { label: 'Perihal', value: f.perihalSurat },
  { label: 'Catatan', value: f.catatanPerkuliahan },
  { label: 'Penandatangan', value: [f.jabatanDekan, f.namaDekan, f.hasTandaTangan ? 'Tanda tangan terpasang' : 'Tanda tangan belum diunggah'] },
  { label: 'Tembusan', value: f.tembusanLines.map((l, i) => `${i + 1}. ${l}`) },
]

const href = (ay: string, dosen: string) => `/kuliah/rekap?${new URLSearchParams({ ay, dosen })}`

/** "Semua dosen": a roll-up of every dosen with a load; pick one to see their letter. */
export function RekapIndex({ rows, ay, facts: f }: { rows: IndexRow[]; ay: string; facts: SuratFacts }) {
  const jadwal = rows.reduce((sum, r) => sum + r.jadwal, 0)
  return (
    <PreviewLayout
      main={
        <section aria-label="Daftar dosen">
          <div className="pb-[0.4rem] flex items-baseline gap-[0.8rem] flex-wrap">
            <h2 className="m-0 text-[1.2rem] font-semibold tracking-[-0.01em] text-[var(--tinta)]">{rows.length} surat penugasan</h2>
            <p className="m-0 text-[0.87rem] text-[var(--tinta-3)]">{jadwal} jadwal · pilih dosen untuk melihat suratnya</p>
          </div>
          <PreviewTable
            label="Dosen dengan jadwal mengajar"
            columns={[{ label: 'Dosen' }, { label: 'Jadwal', align: 'center' }, { label: 'SKS', align: 'center' }]}
          >
            {rows.map((r) => (
              <tr key={r.kode_dosen} className="h-[2.6rem] border-t border-[var(--garis)] hover:bg-[var(--cekung)]">
                <td className={cell()}>
                  <Link href={href(ay, r.kode_dosen)} className="font-medium">
                    {r.nama}
                  </Link>
                </td>
                <td className={`${cell('center')} mono`}>{r.jadwal}</td>
                <td className={`${cell('center')} mono font-medium`}>{r.sks}</td>
              </tr>
            ))}
          </PreviewTable>
        </section>
      }
      panel={<DocFacts title="Isi surat (sama untuk semua)" items={facts(f)} />}
    />
  )
}

/** One dosen's letter: who it's for, the tables, and the total SKS. */
export function RekapLetter({ letter, ay, facts: f }: { letter: LetterView; ay: string; facts: SuratFacts }) {
  return (
    <PreviewLayout
      main={
        <>
          <nav aria-label="Navigasi surat" className="flex items-center justify-between gap-[0.8rem] flex-wrap text-[0.87rem]">
            <Link href={href(ay, 'all')}>← Semua dosen</Link>
            <span className="flex items-center gap-[0.8rem]">
              <Step to={letter.prev && href(ay, letter.prev)} label="Dosen sebelumnya" arrow="‹" />
              <span className="mono text-[var(--tinta-3)]">
                {letter.position} dari {letter.total}
              </span>
              <Step to={letter.next && href(ay, letter.next)} label="Dosen berikutnya" arrow="›" />
            </span>
          </nav>

          <header className="flex items-end justify-between gap-[1rem] flex-wrap">
            <div className="min-w-0">
              <p className="m-0 text-[0.73rem] font-semibold uppercase tracking-[0.04em] text-[var(--tinta-3)]">Kepada Yth.</p>
              <h2 className="m-0 text-[1.2rem] font-semibold tracking-[-0.01em] text-[var(--tinta)] text-balance">{letter.nama}</h2>
              <p className="m-0 text-[0.87rem] text-[var(--tinta-3)]">
                Dosen {f.namaFakultas} · {letter.jadwal} jadwal
              </p>
            </div>
            <div className="text-right">
              <p className="m-0 text-[0.73rem] font-semibold uppercase tracking-[0.04em] text-[var(--tinta-3)]">Total SKS</p>
              <p className="m-0 mono text-[1.87rem] leading-[1.1] font-semibold text-[var(--tinta)]">{letter.totalSks}</p>
            </div>
          </header>

          <PreviewTable label={`Jadwal mengajar ${letter.nama}`} columns={COLUMNS}>
            {letter.sections.map((sec) => (
              <SectionRows key={sec.title} section={sec} />
            ))}
          </PreviewTable>
        </>
      }
      panel={<DocFacts title="Isi surat" items={facts(f)} />}
    />
  )
}

function Step({ to, label, arrow }: { to: string | null; label: string; arrow: string }) {
  const box = 'inline-flex items-center justify-center min-w-[2.4rem] min-h-[2.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[1.07rem] no-underline'
  return to ? (
    <Link href={to} aria-label={label} className={`${box} bg-[var(--lembar)] text-[var(--tinta)] hover:bg-[var(--cekung)] active:scale-[0.97] transition-colors`}>
      {arrow}
    </Link>
  ) : (
    <span aria-hidden="true" className={`${box} bg-[var(--cekung)] text-[var(--tinta-3)] opacity-60`}>
      {arrow}
    </span>
  )
}

function SectionRows({ section }: { section: LetterSection }) {
  return (
    <>
      <BandRow span={COLUMNS.length}>
        <span className="flex justify-between gap-[1rem]">
          <span>{section.title}</span>
          <span className="mono font-medium">{section.sks} SKS</span>
        </span>
      </BandRow>
      {section.rows.length === 0 && (
        <tr className="h-[2.6rem] border-t border-[var(--garis)]">
          <td colSpan={COLUMNS.length} className={`${cell('center')} text-[var(--tinta-3)]`}>
            —
          </td>
        </tr>
      )}
      {section.rows.map((texts, i) => (
        <tr key={i} className="h-[2.6rem] border-t border-[var(--garis)]">
          {texts.map((text, col) => (
            <td key={col} className={`${cell(COLUMNS[col].align)} ${MONO_COLUMNS.has(col) ? 'mono' : ''}`}>
              {text}
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
