import type { PeranSidang } from '@/lib/penilaian/akses'
import { PERAN_SIDANG, PERAN_SIDANG_LABEL } from '@/lib/penilaian/akses'
import { formatNilai } from '@/lib/penilaian/nilai'
import { barAspek, barPenguji, rataRata } from '@/lib/penilaian/grafik'
import type { SkorAspek } from '@/lib/penilaian/nilai'

/**
 * One colour per examiner, the same in the charts and the cards above them. Validated with the dataviz palette
 * checker (colour-blind safe, all pairs); the teal is under 3:1 on white, so every value is also in the table view.
 */
export const WARNA_PERAN: Record<PeranSidang, string> = { ketua: '#2a78d6', anggota_1: '#eb6834', anggota_2: '#1baf7a' }
/** IPK before and after: one hue, light to dark (ordinal). */
export const WARNA_IPK = { sebelum: '#86b6ef', setelah: '#1c5cab' }

const SINGKAT: Record<PeranSidang, string> = { ketua: 'Ketua', anggota_1: 'Anggota I', anggota_2: 'Anggota II' }
const JUDUL = 'm-0 pb-[0.9rem] text-[0.87rem] font-semibold'
const SUMBU = 'text-[0.73rem] text-[var(--tinta-3)] text-center'
/** "80", "87,5": the short form, so a value fits over its narrow bar. */
const singkat = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 })
const NILAI = 'absolute bottom-full left-1/2 -translate-x-1/2 pb-[0.25rem] mono text-[0.8rem] whitespace-nowrap'

/** A column growing from the baseline: 4px rounded top, square bottom, value printed above it. */
export function Kolom({ tinggi, warna, teks, tip, tebal, besar }: { tinggi: number; warna: string; teks: string; tip: string; tebal?: boolean; besar?: boolean }) {
  return (
    <div title={tip} className={`h-full ${besar ? 'w-[6rem]' : 'w-[4rem]'} flex justify-center items-end`}>
      <div className={`relative ${besar ? 'w-[3rem]' : 'w-[1.5rem]'} rounded-t-[4px]`} style={{ height: `${tinggi}%`, background: warna }}>
        <span className={`${NILAI} ${besar ? 'text-[1rem]' : ''} ${tebal ? 'font-semibold' : ''}`}>{teks}</span>
      </div>
    </div>
  )
}

/**
 * Three bar charts with as little text as possible: the examiners' totals against their average, IPK before and
 * after the sidang, and every aspek grouped by examiner. Hover gives each value; "Tabel" lists them all.
 */
export function Grafik({ nilai, snapshot, aspek, ipk }: {
  nilai: Partial<Record<PeranSidang, number>>
  snapshot: Partial<Record<PeranSidang, SkorAspek[]>>
  aspek: { label: string }[]
  /** IPK before the sidang and after it (as the berita acara computes it); null = not known yet. */
  ipk: { sebelum: number | null; setelah: number | null; alasan?: string }
}) {
  const rata = rataRata(nilai)
  const baris = barAspek(aspek, snapshot)
  const adaIpk = ipk.sebelum !== null
  return (
    <section className="mb-[1.6rem] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] p-[1rem] sm:p-[1.3rem]">
      <div className="flex flex-wrap gap-x-[1.1rem] gap-y-[0.3rem] pb-[1.3rem] text-[0.8rem] text-[var(--tinta-2)]">
        {PERAN_SIDANG.map((p) => (
          <span key={p} className="inline-flex items-center gap-[0.4rem]">
            <span aria-hidden="true" className="inline-block w-[0.75rem] h-[0.75rem] rounded-[2px]" style={{ background: WARNA_PERAN[p] }} />
            {PERAN_SIDANG_LABEL[p]}
          </span>
        ))}
      </div>

      <div className={`grid gap-[2rem] ${adaIpk ? 'sm:grid-cols-[1fr_18rem]' : ''}`}>
        <figure className="m-0">
          <figcaption className={JUDUL}>Nilai penguji</figcaption>
          <div className="relative h-[9rem] border-b border-[var(--garis-kuat)] mt-[1rem]">
            {rata !== null && (
              <>
                <div className="absolute inset-x-0 border-t-2 border-dashed border-[var(--tinta-3)]" style={{ top: `${100 - rata}%` }} />
                <span className="absolute right-0 translate-y-[0.3rem] mono text-[0.73rem] text-[var(--tinta-2)]" style={{ top: `${100 - rata}%` }}>
                  Rata-rata {formatNilai(rata)}
                </span>
              </>
            )}
            <div className="absolute inset-y-0 left-0 right-[7rem] flex justify-around items-end">
              {barPenguji(nilai).map(({ peran, nilai: n }) => (
                <Kolom key={peran} tinggi={n ?? 0} warna={WARNA_PERAN[peran]} teks={n === null ? '—' : formatNilai(n)} tebal
                  tip={`${PERAN_SIDANG_LABEL[peran]}: ${n === null ? 'belum dikirim' : formatNilai(n)}`} />
              ))}
            </div>
          </div>
          <div className="flex justify-around pt-[0.4rem] mr-[7rem]">
            {PERAN_SIDANG.map((p) => <span key={p} className={`${SUMBU} w-[4rem]`}>{SINGKAT[p]}</span>)}
          </div>
        </figure>

        {adaIpk && (
          <figure className="m-0">
            <figcaption className={JUDUL}>IPK</figcaption>
            {/* Bigger than the examiner chart (kiprat 2026-11-25). */}
            <div className="h-[13rem] border-b border-[var(--garis-kuat)] mt-[1.4rem] flex justify-around items-end">
              <Kolom besar tinggi={(ipk.sebelum! / 4) * 100} warna={WARNA_IPK.sebelum} teks={formatNilai(ipk.sebelum!)} tip={`IPK sebelum sidang: ${formatNilai(ipk.sebelum!)}`} />
              <Kolom besar tinggi={ipk.setelah === null ? 0 : (ipk.setelah / 4) * 100} warna={WARNA_IPK.setelah} tebal
                teks={ipk.setelah === null ? '—' : formatNilai(ipk.setelah)}
                tip={ipk.setelah === null ? `IPK setelah sidang: ${ipk.alasan ?? 'belum ada'}` : `IPK setelah sidang: ${formatNilai(ipk.setelah)}`} />
            </div>
            <div className="flex justify-around pt-[0.4rem]">
              <span className="w-[6rem] text-center text-[0.87rem] text-[var(--tinta-3)]">Sebelum</span>
              <span className="w-[6rem] text-center text-[0.87rem] text-[var(--tinta-3)]">Setelah</span>
            </div>
          </figure>
        )}
      </div>

      <figure className="m-0 mt-[2rem]">
        <figcaption className={JUDUL}>Nilai per aspek</figcaption>
        <div className="overflow-x-auto">
          {/* Room above for the 100 bar's label; wider bars so each value fits over its own bar. */}
          <div className="min-w-[48rem] mt-[1rem] grid grid-cols-[1.8rem_1fr] gap-x-[0.5rem]">
            <div className="relative h-[12rem] mono text-[0.7rem] text-[var(--tinta-3)]">
              <span className="absolute right-0 -top-[0.45rem]">100</span>
              <span className="absolute right-0 top-1/2 -translate-y-1/2">50</span>
              <span className="absolute right-0 -bottom-[0.45rem]">0</span>
            </div>
            <div
              className="relative h-[12rem] border-b border-[var(--garis-kuat)] flex justify-around items-end"
              style={{ backgroundImage: 'linear-gradient(to bottom, var(--garis) 1px, transparent 1px)', backgroundSize: '100% 50%' }}
            >
              {baris.map(({ label, skor }) => (
                <div key={label} className="h-full flex items-end gap-[3px]">
                  {PERAN_SIDANG.map((p) => (
                    <div
                      key={p}
                      title={`${label} · ${PERAN_SIDANG_LABEL[p]}: ${skor[p] === undefined ? 'belum dikirim' : formatNilai(skor[p]!)}`}
                      className="relative w-[1.8rem] rounded-t-[4px]"
                      style={{ height: `${skor[p] ?? 0}%`, background: WARNA_PERAN[p] }}
                    >
                      {/* Each value printed over its bar, no hover needed (kiprat 2026-11-25). */}
                      {skor[p] !== undefined && <span className="absolute bottom-full left-1/2 -translate-x-1/2 pb-[0.2rem] mono text-[0.6rem] tracking-[-0.03em] whitespace-nowrap">{singkat(skor[p]!)}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <span />
            <div className="flex justify-around pt-[0.4rem]">
              {baris.map(({ label }) => (
                <span key={label} className={`${SUMBU} flex-1 px-[0.2rem] leading-tight`}>{label}</span>
              ))}
            </div>
          </div>
        </div>
      </figure>

      <details className="mt-[1.2rem]">
        <summary className="cursor-pointer text-[0.8rem] text-[var(--biru)]">Tabel</summary>
        <div className="overflow-x-auto mt-[0.6rem]">
          <table className="w-full border-collapse text-[0.8rem]">
            <thead className="text-[0.73rem] text-[var(--tinta-3)]">
              <tr>
                <th scope="col" className="text-left font-medium py-[0.3rem] pr-[0.6rem]">Aspek</th>
                {PERAN_SIDANG.map((p) => <th key={p} scope="col" className="text-right font-medium py-[0.3rem] px-[0.4rem]">{SINGKAT[p]}</th>)}
              </tr>
            </thead>
            <tbody>
              {baris.map(({ label, skor }) => (
                <tr key={label} className="border-t border-[var(--garis)]">
                  <th scope="row" className="text-left font-normal text-[var(--tinta-2)] py-[0.3rem] pr-[0.6rem]">{label}</th>
                  {PERAN_SIDANG.map((p) => <td key={p} className="text-right mono py-[0.3rem] px-[0.4rem]">{skor[p] === undefined ? '—' : formatNilai(skor[p]!)}</td>)}
                </tr>
              ))}
              <tr className="border-t-2 border-[var(--garis-kuat)] font-semibold">
                <th scope="row" className="text-left py-[0.3rem] pr-[0.6rem]">Nilai penguji</th>
                {barPenguji(nilai).map(({ peran, nilai: n }) => <td key={peran} className="text-right mono py-[0.3rem] px-[0.4rem]">{n === null ? '—' : formatNilai(n)}</td>)}
              </tr>
            </tbody>
          </table>
          {adaIpk && (
            <p className="m-0 mt-[0.5rem] text-[0.8rem] text-[var(--tinta-2)]">
              IPK <span className="mono">{formatNilai(ipk.sebelum!)} → {ipk.setelah === null ? '—' : formatNilai(ipk.setelah)}</span>
              {ipk.setelah === null && ipk.alasan && <span className="text-[var(--tinta-3)]"> ({ipk.alasan})</span>}
            </p>
          )}
        </div>
      </details>
    </section>
  )
}
