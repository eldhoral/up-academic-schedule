import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { EmptySheet } from '@/components/EmptySheet'
import { PreviewTable, cell } from '@/components/preview'
import { prodiParam } from '@/lib/prodi-server'
import { createClient } from '@/lib/supabase/server'
import { penilaianPath } from '@/lib/penilaian/akses'
import { tanggalPanjang } from '@/lib/hari'
import { baris, formatNilai } from '@/lib/penilaian/nilai'
import { loadRekapBimbingan, pilihTahun } from '@/lib/penilaian/rekap-data'
import { bacaFilter, cariSql, kolomUrut, urutkan } from '@/lib/penilaian/rekap-filter'
import { RekapBar } from './RekapBar'
import { RekapFilter, TidakCocok } from './RekapFilter'

const C = 'center' as const
const URUT = ['tanggal', 'npm', 'nama', 'nilai', 'batas'] as const
const STATUS = [{ value: 'lengkap', label: 'Sudah dinilai' }, { value: 'belum', label: 'Belum dinilai' }] as const
const BELUM = <span className="text-[var(--tinta-3)]">belum dinilai</span>

/**
 * The summary only: each pembimbing's grade (and, for Super Admin, entering or editing it) is on the Nilai Bimbingan
 * page (click the name); every column is in the Excel download. Filter and sort come from the URL, on the server.
 */
export default async function RekapBimbinganPage(props: PageProps<'/[prodi]/sidang/nilai-bimbingan'>) {
  const prodi = await prodiParam(props.params)
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const { years, ay } = await pilihTahun(supabase, searchParams.ay as string | undefined)
  const path = `/${prodi}/sidang/nilai-bimbingan`
  const f = bacaFilter(searchParams, { urut: URUT, status: STATUS.map((s) => s.value) })
  // Search and tanggal/NPM/nama order in SQL; the computed grade and batas after.
  const { rows: semua, aturan } = await loadRekapBimbingan(supabase, prodi, ay, cariSql(f))
  const cocok = semua.filter((r) => (f.status === 'lengkap' ? r.bimbingan !== null : f.status === 'belum' ? r.bimbingan === null : true))
  const rows = f.urut === 'nilai' ? urutkan(cocok, (r) => r.bimbingan, f.arah)
    : f.urut === 'batas' ? urutkan(cocok, (r) => r.batas, f.arah)
      : cocok
  const aktif = !!(f.q || f.status)
  const huruf = (n: number | null) => (n === null ? '' : baris(n, aturan.tabelNilai).huruf)
  const k = (key: (typeof URUT)[number]) => kolomUrut(path, ay, f, key)
  const columns = [
    { label: 'No', align: C }, { label: 'NPM', ...k('npm') }, { label: 'Nama', ...k('nama') },
    { label: 'Nilai Bimbingan', align: C, ...k('nilai') }, { label: 'Huruf', align: C },
    { label: 'Batas Pengisian', align: C, ...k('batas') },
  ]

  return (
    <AppShell active="/sidang/nilai-bimbingan" prodi={prodi}>
      <div className="flex flex-col flex-1">
        <RekapBar years={years} ay={ay} bisaUnduh={rows.length > 0 || aktif} />
        {rows.length === 0 && !aktif ? (
          <EmptySheet
            title="Belum ada sidang"
            detail={`${years.find((y) => y.id === ay)?.label ?? 'Tahun ini'} belum memiliki jadwal sidang. Nilai bimbingan diisi Dosen Pembimbing setelah Ketua mengunci sidang.`}
            actionHref={`/${prodi}/sidang?${new URLSearchParams({ ay, jenis: 'sidang' })}`}
            actionLabel="Buka Jadwal Sidang"
          />
        ) : (
          <>
            <RekapFilter path={path} ay={ay} f={f} status={[...STATUS]} />
            <div className="px-[1.3rem] py-[1rem]">
              {rows.length === 0 ? <TidakCocok /> : (
                <PreviewTable label="Rekap Nilai Bimbingan" columns={columns}>
                  {rows.map((r, i) => (
                    <tr key={r.defenseId} className="border-t border-[var(--garis)] align-top">
                      <td className={`${cell(C)} mono`}>{i + 1}</td>
                      <td className={`${cell()} mono whitespace-nowrap`}>{r.npm}</td>
                      <td className={cell()}><Link href={penilaianPath(r.defenseId)}>{r.nama}</Link></td>
                      <td className={`${cell(C)} mono font-semibold`}>{r.bimbingan === null ? BELUM : formatNilai(r.bimbingan)}</td>
                      <td className={`${cell(C)} font-semibold`}>{huruf(r.bimbingan)}</td>
                      <td className={`${cell(C)} whitespace-nowrap`}>{r.batas ? tanggalPanjang(r.batas, false) : <span className="text-[var(--tinta-3)]">belum dikunci</span>}</td>
                    </tr>
                  ))}
                </PreviewTable>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
