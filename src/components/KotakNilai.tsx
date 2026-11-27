import type { BarisNilai } from '@/lib/penilaian/aturan'
import { baris, formatNilai } from '@/lib/penilaian/nilai'

/**
 * A score input in the faculty's green (kiprat 2026-11-26: #41f108), a rounded square with the number centred
 * (2026-11-27). Shared by the sidang and bimbingan forms; the caller adds the border colour.
 */
export const KOTAK_SKOR =
  'mono w-[4.4rem] h-[4.4rem] p-[0.3rem] rounded-[0.9rem] border bg-[#41f108] text-[var(--tinta)] text-[1.25rem] font-semibold text-center placeholder:text-[0.8rem] placeholder:font-normal placeholder:text-[var(--tinta-2)]'
/** The column the score sits in: on the right from sm, its error under it. */
export const KOLOM_SKOR = 'shrink-0 flex flex-col items-start sm:items-end sm:w-[7rem]'

const KEPALA = 'px-[0.6rem] py-[0.3rem] bg-[var(--biru)] text-white text-[0.73rem] font-semibold uppercase tracking-[0.04em] text-center'
const ISI = 'px-[0.6rem] py-[0.5rem] mono text-[1.2rem] font-semibold text-center'

/** A grade as the old Excel form showed it: a box with Nilai Angka and Nilai Huruf (kiprat 2026-11-25), optionally titled. */
export function KotakNilai({ judul, nilai, tabel, className = '' }: { judul?: string; nilai: number | null; tabel: BarisNilai[]; className?: string }) {
  return (
    <div className={className}>
      {judul && <p className="m-0 mb-[0.3rem] text-[0.8rem] font-semibold uppercase tracking-[0.04em]">{judul}</p>}
      <div className="grid grid-cols-2 border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] overflow-hidden bg-[var(--lembar)]">
        <span className={KEPALA}>Nilai Angka</span>
        <span className={`${KEPALA} border-l border-white/40`}>Nilai Huruf</span>
        <span className={ISI}>{nilai === null ? '—' : formatNilai(nilai)}</span>
        <span className={`${ISI} border-l border-[var(--garis)]`}>{nilai === null ? '—' : baris(nilai, tabel).huruf}</span>
      </div>
    </div>
  )
}
