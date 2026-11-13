'use client'

import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import { useProdi } from '@/lib/use-prodi'

const CONTROL = 'bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]'

/** Tahun akademik picker and the Excel download for the recap. */
export function RekapBar({ years, ay, bisaUnduh, slug = 'nilai-bimbingan', objek = 'prasidang' }: {
  years: { id: string; label: string }[]; ay: string; bisaUnduh: boolean; slug?: 'nilai-bimbingan' | 'nilai-akhir'; objek?: string
}) {
  const prodi = useProdi()
  const router = useRouter()
  return (
    <div className="min-h-[3.2rem] flex items-center gap-[0.53rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)] flex-wrap">
      <label className="text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-ay">Tahun akademik</label>
      <Select
        id="ctx-ay"
        value={ay}
        onValueChange={(v) => router.push(`/${prodi}/sidang/${slug}?ay=${encodeURIComponent(v)}`)}
        options={years.map((y) => ({ value: y.id, label: y.label }))}
        className={CONTROL}
      />
      {bisaUnduh ? (
        <a
          href={`/api/${slug}?year=${encodeURIComponent(ay)}`}
          className="ml-auto inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors text-[0.93rem]"
        >
          Unduh Excel
        </a>
      ) : (
        <span
          aria-disabled="true"
          title={`Belum ada ${objek} untuk diunduh`}
          className="ml-auto inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru-disabled)] text-white font-medium cursor-not-allowed text-[0.93rem]"
        >
          Unduh Excel
        </span>
      )}
    </div>
  )
}
