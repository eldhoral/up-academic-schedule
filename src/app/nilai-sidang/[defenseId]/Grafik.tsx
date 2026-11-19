import type { PeranSidang } from '@/lib/penilaian/akses'
import { PERAN_SIDANG_LABEL } from '@/lib/penilaian/akses'
import { formatNilai } from '@/lib/penilaian/nilai'
import { barAspek, barPenguji, rataRata } from '@/lib/penilaian/grafik'
import type { SkorAspek } from '@/lib/penilaian/nilai'

/** One colour per examiner, the same in both charts and the cards' legend. */
export const WARNA_PERAN: Record<PeranSidang, string> = { ketua: 'var(--biru)', anggota_1: 'var(--hijau)', anggota_2: 'var(--kuning)' }

const LEBAR = 100 // the bars are drawn on a 0–100 scale in percent of the track

/**
 * Two charts like the BERITA ACARA tab: the three examiners' totals with the average, and each aspek side by side.
 * Plain HTML bars (no chart library); every value is also printed, so the chart is never the only source.
 */
export function Grafik({ nilai, snapshot, aspek }: {
  nilai: Partial<Record<PeranSidang, number>>
  snapshot: Partial<Record<PeranSidang, SkorAspek[]>>
  aspek: { label: string }[]
}) {
  const rata = rataRata(nilai)
  return (
    <section className="mb-[1.6rem] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] p-[1rem]">
      <h2 className="m-0 mb-[0.2rem] text-[1.05rem] font-semibold">Grafik nilai</h2>
      <p className="m-0 mb-[0.9rem] flex flex-wrap gap-x-[1rem] gap-y-[0.2rem] text-[0.8rem] text-[var(--tinta-2)]">
        {(Object.keys(WARNA_PERAN) as PeranSidang[]).map((p) => (
          <span key={p} className="inline-flex items-center gap-[0.35rem]">
            <span aria-hidden="true" className="inline-block w-[0.7rem] h-[0.7rem] rounded-[2px]" style={{ background: WARNA_PERAN[p] }} />
            {PERAN_SIDANG_LABEL[p]}
          </span>
        ))}
      </p>

      <h3 className="m-0 mb-[0.5rem] text-[0.87rem] font-semibold">Nilai per penguji</h3>
      <div className="relative space-y-[0.4rem]">
        {barPenguji(nilai).map(({ peran, nilai: n }) => (
          <div key={peran} className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-[0.6rem] text-[0.8rem]">
            <span className="text-[var(--tinta-2)] truncate">{PERAN_SIDANG_LABEL[peran]}</span>
            <span className="relative h-[0.9rem] bg-[var(--cekung)] rounded-[2px]">
              {n !== null && <span className="absolute inset-y-0 left-0 rounded-[2px]" style={{ width: `${(n / LEBAR) * 100}%`, background: WARNA_PERAN[peran] }} />}
            </span>
            <span className="mono text-right">{n === null ? '—' : formatNilai(n)}</span>
          </div>
        ))}
        {rata !== null && (
          <p className="m-0 text-[0.8rem] text-[var(--tinta-2)]">
            Rata-rata nilai terkirim: <span className="mono font-semibold text-[var(--tinta)]">{formatNilai(rata)}</span>
          </p>
        )}
      </div>

      <h3 className="m-0 mt-[1.1rem] mb-[0.5rem] text-[0.87rem] font-semibold">Nilai per aspek</h3>
      <div className="space-y-[0.6rem]">
        {barAspek(aspek, snapshot).map(({ label, skor }) => (
          <div key={label} className="grid grid-cols-1 sm:grid-cols-[11rem_1fr] gap-x-[0.6rem] gap-y-[0.2rem] text-[0.8rem]">
            <span className="text-[var(--tinta-2)]">{label}</span>
            <span className="space-y-[2px]">
              {(Object.keys(WARNA_PERAN) as PeranSidang[]).map((p) => (
                <span key={p} className="grid grid-cols-[1fr_3rem] items-center gap-[0.5rem]">
                  <span className="relative h-[0.5rem] bg-[var(--cekung)] rounded-[2px]">
                    {skor[p] !== undefined && (
                      <span className="absolute inset-y-0 left-0 rounded-[2px]" style={{ width: `${(skor[p]! / LEBAR) * 100}%`, background: WARNA_PERAN[p] }} />
                    )}
                  </span>
                  <span className="mono text-right text-[0.73rem] text-[var(--tinta-2)]">
                    <span className="sr-only">{PERAN_SIDANG_LABEL[p]}: </span>
                    {skor[p] === undefined ? '—' : formatNilai(skor[p]!)}
                  </span>
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
