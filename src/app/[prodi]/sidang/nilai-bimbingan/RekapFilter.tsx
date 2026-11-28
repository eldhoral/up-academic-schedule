import Link from 'next/link'
import { hrefRekap, type FilterRekap } from '@/lib/penilaian/rekap-filter'

const CONTROL = 'bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]'

/**
 * Search and status filter for a recap. A plain GET form: the page reads the URL and filters on the server.
 * The sort travels along in hidden fields so filtering keeps it.
 */
export function RekapFilter({ path, ay, f, status }: { path: string; ay: string; f: FilterRekap; status: { value: string; label: string }[] }) {
  return (
    <form method="get" action={path} role="search" className="flex flex-wrap items-center gap-[0.53rem] px-[1.3rem] pt-[1rem]">
      <input type="hidden" name="ay" value={ay} />
      <input type="hidden" name="urut" value={f.urut} />
      <input type="hidden" name="arah" value={f.arah} />
      <input type="search" name="q" defaultValue={f.q} placeholder="Cari NPM atau nama" aria-label="Cari NPM atau nama" className={`${CONTROL} w-[15rem]`} />
      {/* Fixed width: a select sizes to its longest option, which differs per recap (2026-11-28). */}
      <select name="status" defaultValue={f.status} aria-label="Status" className={`${CONTROL} w-[15rem] max-w-full`}>
        <option value="">Semua status</option>
        {status.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <button type="submit" className="px-[0.8rem] min-h-[2.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] bg-[var(--lembar)] text-[0.87rem] cursor-pointer hover:bg-[var(--cekung)]">
        Terapkan
      </button>
      {(f.q || f.status) && <Link href={hrefRekap(path, { ay, urut: f.urut, arah: f.arah })} className="text-[0.87rem]">Hapus filter</Link>}
    </form>
  )
}

/** Shown instead of the table when the filter matches nothing. */
export function TidakCocok() {
  return <p className="m-0 p-[1rem] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] text-[0.93rem] text-[var(--tinta-2)]">Tidak ada yang cocok dengan filter ini.</p>
}
