import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { EmptySheet } from '@/components/EmptySheet'
import { PreviewTable, cell } from '@/components/preview'
import { prodiParam } from '@/lib/prodi-server'
import { createClient } from '@/lib/supabase/server'
import { tanggalPanjang } from '@/lib/hari'
import { penilaianSidangPath, todayJakarta } from '@/lib/penilaian/akses'
import { formatNilai } from '@/lib/penilaian/nilai'
import { loadRekapAkhir, pilihTahun } from '@/lib/penilaian/rekap-data'
import { statusNilaiSidang } from '@/lib/penilaian/rekap'
import { bacaFilter, cariSql, kolomUrut, urutkan } from '@/lib/penilaian/rekap-filter'
import { RekapBar } from '../nilai-bimbingan/RekapBar'
import { RekapFilter, TidakCocok } from '../nilai-bimbingan/RekapFilter'
import { istilah } from '@/lib/prodi'

const C = 'center' as const
const URUT = ['tanggal', 'npm', 'nama', 'nilai'] as const
const STATUS = [{ value: 'terkunci', label: 'Terkunci' }, { value: 'belum', label: 'Belum terkunci' }] as const

/**
 * S1 sidang of one year: Nilai Sidang and how far the grading has got. Read-only for staff. The summary only: each
 * examiner's grade and the berita acara downloads are on the sidang page (click the name).
 */
export default async function RekapNilaiSidangPage(props: PageProps<'/[prodi]/sidang/nilai-sidang'>) {
  const prodi = await prodiParam(props.params)
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const { years, ay } = await pilihTahun(supabase, searchParams.ay as string | undefined)
  const path = `/${prodi}/sidang/nilai-sidang`
  const f = bacaFilter(searchParams, { urut: URUT, status: STATUS.map((s) => s.value) })
  // Same rows as Nilai Akhir. Search and tanggal/NPM/nama order in SQL; the lock filter and grade sort after.
  const cocok = (await loadRekapAkhir(supabase, prodi, ay, cariSql(f)))
    .filter((r) => (f.status === 'terkunci' ? !!r.lockedAt : f.status === 'belum' ? !r.lockedAt : true))
  const rows = f.urut === 'nilai' ? urutkan(cocok, (r) => r.hasil.nilaiSidang, f.arah) : cocok
  const aktif = !!(f.q || f.status)
  const today = todayJakarta()
  const k = (key: (typeof URUT)[number]) => kolomUrut(path, ay, f, key)
  const columns = [
    { label: 'No', align: C }, { label: 'Tanggal', ...k('tanggal') }, { label: 'NPM', ...k('npm') }, { label: 'Nama', ...k('nama') },
    { label: 'Nilai Sidang', align: C, ...k('nilai') }, { label: 'Huruf', align: C }, { label: 'Status' },
  ]

  return (
    <AppShell active="/sidang/nilai-sidang" prodi={prodi}>
      <div className="flex flex-col flex-1">
        <RekapBar years={years} ay={ay} bisaUnduh={null} slug="nilai-sidang" />
        {rows.length === 0 && !aktif ? (
          <EmptySheet
            title={istilah(prodi, 'Belum ada sidang skripsi')}
            detail={istilah(prodi, `${years.find((y) => y.id === ay)?.label ?? 'Tahun ini'} belum memiliki jadwal sidang skripsi. Nilai penguji muncul di sini setelah sidang dijadwalkan.`)}
            actionHref={`/${prodi}/sidang?${new URLSearchParams({ ay, jenis: 'sidang' })}`}
            actionLabel="Buka Jadwal Sidang"
          />
        ) : (
          <>
            <RekapFilter path={path} ay={ay} f={f} status={[...STATUS]} />
            <div className="px-[1.3rem] py-[1rem]">
              {rows.length === 0 ? <TidakCocok /> : (
                <PreviewTable label="Rekap Nilai Sidang" columns={columns}>
                  {rows.map((r, i) => {
                    const ns = r.hasil.nilaiSidang
                    return (
                      <tr key={r.defenseId} className="border-t border-[var(--garis)] align-top">
                        <td className={`${cell(C)} mono`}>{i + 1}</td>
                        <td className={`${cell()} whitespace-nowrap`}>{tanggalPanjang(r.tanggal, false)}</td>
                        <td className={`${cell()} mono whitespace-nowrap`}>{r.npm}</td>
                        <td className={cell()}><Link href={penilaianSidangPath(r.defenseId)}>{r.nama}</Link></td>
                        <td className={`${cell(C)} mono font-semibold`}>{ns === null ? '—' : formatNilai(ns)}</td>
                        <td className={`${cell(C)} font-semibold`}>{r.hurufSidang ?? '—'}</td>
                        <td className={cell()}>
                          <span className={`whitespace-nowrap ${r.lockedAt ? 'text-[var(--hijau)]' : 'text-[var(--tinta-2)]'}`}>{statusNilaiSidang(r, today)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </PreviewTable>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
