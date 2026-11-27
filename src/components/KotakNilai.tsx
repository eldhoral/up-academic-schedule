import type { BarisNilai } from '@/lib/penilaian/aturan'
import { baris, formatNilai } from '@/lib/penilaian/nilai'

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
