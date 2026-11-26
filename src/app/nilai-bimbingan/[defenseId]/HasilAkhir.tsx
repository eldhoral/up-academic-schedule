import { Kolom, WARNA_IPK } from '@/app/nilai-sidang/[defenseId]/Grafik'
import type { BarisNilai } from '@/lib/penilaian/aturan'
import { baris, formatNilai, type HasilAkhir } from '@/lib/penilaian/nilai'

const KEPALA = 'px-[0.6rem] py-[0.3rem] bg-[var(--biru)] text-white text-[0.73rem] font-semibold uppercase tracking-[0.04em] text-center'
const ISI = 'px-[0.6rem] py-[0.5rem] mono text-[1.2rem] font-semibold text-center'

/** One result as the old Excel form showed it: a titled box with Nilai Angka and Nilai Huruf. */
function Kotak({ judul, nilai, tabel }: { judul: string; nilai: number | null; tabel: BarisNilai[] }) {
  return (
    <div>
      <p className="m-0 mb-[0.3rem] text-[0.8rem] font-semibold uppercase tracking-[0.04em]">{judul}</p>
      <div className="grid grid-cols-2 border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] overflow-hidden bg-[var(--lembar)]">
        <span className={KEPALA}>Nilai Angka</span>
        <span className={`${KEPALA} border-l border-white/40`}>Nilai Huruf</span>
        <span className={ISI}>{nilai === null ? '—' : formatNilai(nilai)}</span>
        <span className={`${ISI} border-l border-[var(--garis)]`}>{nilai === null ? '—' : baris(nilai, tabel).huruf}</span>
      </div>
    </div>
  )
}

/**
 * Nilai Bimbingan, Nilai Sidang and Nilai Akhir with the IPK before and after (kiprat 2026-11-25: "ada bentuk grafiknya,
 * kaya yg ini" — the old bimbingan Excel form). Shown once the sidang is locked; letters from the frozen table.
 */
export function HasilAkhirPanel({ bimbingan, h, ipkAwal, tabel }: { bimbingan: number | null; h: HasilAkhir; ipkAwal: number | null; tabel: BarisNilai[] }) {
  const lengkap = h.status === 'lengkap' ? h : null
  return (
    <section className="mt-[1.6rem] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] p-[1rem] sm:p-[1.3rem]">
      <h2 className="m-0 mb-[1rem] text-[1.2rem] font-semibold tracking-[-0.01em]">Hasil akhir</h2>
      <div className="grid gap-[1.6rem] sm:grid-cols-[1fr_15rem] sm:items-end">
        <div className="grid gap-[0.8rem]">
          <Kotak judul="Nilai Bimbingan" nilai={bimbingan} tabel={tabel} />
          <Kotak judul="Nilai Sidang" nilai={h.nilaiSidang} tabel={tabel} />
          <Kotak judul="Nilai Akhir" nilai={lengkap?.nilaiAkhir ?? null} tabel={tabel} />
          {!lengkap && 'alasan' in h && <p className="m-0 text-[0.87rem] text-[var(--tinta-3)]">{h.alasan}.</p>}
        </div>
        {ipkAwal !== null && (
          <figure className="m-0">
            <figcaption className="m-0 pb-[0.9rem] text-[0.87rem] font-semibold">IPK</figcaption>
            <div className="h-[11rem] border-b border-[var(--garis-kuat)] mt-[1.4rem] flex justify-around items-end">
              <Kolom besar tinggi={(ipkAwal / 4) * 100} warna={WARNA_IPK.sebelum} teks={formatNilai(ipkAwal)} tip={`IPK awal: ${formatNilai(ipkAwal)}`} />
              <Kolom besar tebal tinggi={lengkap ? (lengkap.ipkSetelah / 4) * 100 : 0} warna={WARNA_IPK.setelah}
                teks={lengkap ? formatNilai(lengkap.ipkSetelah) : '—'} tip={lengkap ? `IPK akhir: ${formatNilai(lengkap.ipkSetelah)}` : 'IPK akhir: belum ada'} />
            </div>
            <div className="flex justify-around pt-[0.4rem]">
              <span className="w-[6rem] text-center text-[0.87rem] text-[var(--tinta-3)]">IPK Awal</span>
              <span className="w-[6rem] text-center text-[0.87rem] text-[var(--tinta-3)]">IPK Akhir</span>
            </div>
          </figure>
        )}
      </div>
    </section>
  )
}
