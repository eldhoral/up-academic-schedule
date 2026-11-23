import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { EmptySheet } from '@/components/EmptySheet'
import { PreviewTable, cell } from '@/components/preview'
import { prodiParam } from '@/lib/prodi-server'
import { canManage, getCurrentRole } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { penilaianSidangPath } from '@/lib/penilaian/akses'
import { formatNilai } from '@/lib/penilaian/nilai'
import { loadRekapAkhir, pilihTahun } from '@/lib/penilaian/rekap-data'
import { bolehKirimUlang, EMAIL_LABEL } from '@/lib/penilaian/rekap'
import { bacaFilter, cariSql, kolomUrut, urutkan } from '@/lib/penilaian/rekap-filter'
import { RekapBar } from '../nilai-bimbingan/RekapBar'
import { RekapFilter, TidakCocok } from '../nilai-bimbingan/RekapFilter'
import { KirimUlang } from './KirimUlang'

const C = 'center' as const
const URUT = ['tanggal', 'npm', 'nama', 'nilai_sidang', 'nilai_akhir'] as const
const STATUS = [
  { value: 'lengkap', label: 'Nilai akhir lengkap' },
  { value: 'belum', label: 'Nilai akhir belum lengkap' },
  { value: 'email_gagal', label: 'Email gagal' },
] as const
const KOSONG = <span className="text-[var(--tinta-3)]">—</span>
const angka = (n: number | null) => (n === null ? KOSONG : <span className="mono">{formatNilai(n)}</span>)

/**
 * The summary only: the examiners, their grades and the yudisium are on the sidang page (click the name); every
 * column, IPK and bobot mutu included, is in the Excel download. Filter and sort come from the URL, on the server.
 */
export default async function RekapNilaiAkhirPage(props: PageProps<'/[prodi]/sidang/nilai-akhir'>) {
  const prodi = await prodiParam(props.params)
  if (prodi !== 's1') notFound() // sidang grading is S1 only
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const [{ years, ay }, role] = await Promise.all([pilihTahun(supabase, searchParams.ay as string | undefined), getCurrentRole()])
  const path = `/${prodi}/sidang/nilai-akhir`
  const f = bacaFilter(searchParams, { urut: URUT, status: STATUS.map((s) => s.value) })
  // Search and tanggal/NPM/nama order in SQL; the computed grades and statuses after.
  const cocok = (await loadRekapAkhir(supabase, ay, cariSql(f))).filter((r) =>
    f.status === 'lengkap' ? r.hasil.status === 'lengkap'
      : f.status === 'belum' ? r.hasil.status !== 'lengkap'
        : f.status === 'email_gagal' ? r.emailStatus === 'gagal' || r.emailStatus === 'sebagian'
          : true)
  const rows = f.urut === 'nilai_sidang' ? urutkan(cocok, (r) => r.hasil.nilaiSidang, f.arah)
    : f.urut === 'nilai_akhir' ? urutkan(cocok, (r) => (r.hasil.status === 'lengkap' ? r.hasil.nilaiAkhir : null), f.arah)
      : cocok
  const aktif = !!(f.q || f.status)
  const admin = canManage(role)
  const sekarang = new Date()
  const k = (key: (typeof URUT)[number]) => kolomUrut(path, ay, f, key)
  const columns = [
    { label: 'No', align: C }, { label: 'NPM', ...k('npm') }, { label: 'Nama', ...k('nama') },
    { label: 'Nilai Sidang', align: C, ...k('nilai_sidang') }, { label: 'Nilai Akhir', align: C, ...k('nilai_akhir') },
    { label: 'Huruf', align: C }, { label: 'Predikat' }, { label: 'Status Email' },
  ]

  return (
    <AppShell active="/sidang/nilai-akhir" prodi={prodi}>
      <div className="flex flex-col flex-1">
        <RekapBar years={years} ay={ay} bisaUnduh={rows.length > 0 || aktif} slug="nilai-akhir" objek="sidang" />
        {rows.length === 0 && !aktif ? (
          <EmptySheet
            title="Belum ada sidang skripsi"
            detail={`${years.find((y) => y.id === ay)?.label ?? 'Tahun ini'} belum memiliki jadwal sidang skripsi. Nilai akhir muncul di sini setelah sidang dijadwalkan.`}
            actionHref={`/${prodi}/sidang?${new URLSearchParams({ ay })}`}
            actionLabel="Buka Jadwal Sidang"
          />
        ) : (
          <>
            <RekapFilter path={path} ay={ay} f={f} status={[...STATUS]} />
            <div className="px-[1.3rem] py-[1rem]">
              {rows.length === 0 ? <TidakCocok /> : (
                <PreviewTable label="Rekap Nilai Akhir" columns={columns}>
                  {rows.map((r, i) => {
                    const h = r.hasil
                    return (
                      <tr key={r.defenseId} className="border-t border-[var(--garis)] align-top">
                        <td className={`${cell(C)} mono`}>{i + 1}</td>
                        <td className={`${cell()} mono whitespace-nowrap`}>{r.npm}</td>
                        <td className={cell()}><Link href={penilaianSidangPath(r.defenseId)}>{r.nama}</Link></td>
                        <td className={cell(C)}>{angka(h.nilaiSidang)}</td>
                        {h.status === 'lengkap' ? (
                          <>
                            <td className={`${cell(C)} mono font-semibold`}>{formatNilai(h.nilaiAkhir)}</td>
                            <td className={`${cell(C)} font-semibold`}>{h.huruf}</td>
                            <td className={cell()}>{h.predikat ?? '—'}</td>
                          </>
                        ) : (
                          <td colSpan={3} className={`${cell()} min-w-[14rem] text-[var(--tinta-3)]`}>{h.alasan}</td>
                        )}
                        <td className={cell()}>
                          {r.emailStatus ? (EMAIL_LABEL[r.emailStatus] ?? r.emailStatus) : KOSONG}
                          {(r.emailStatus === 'gagal' || r.emailStatus === 'sebagian') && (
                            <ul className="m-0 mt-[0.2rem] p-0 list-none text-[0.8rem] text-[var(--tinta-3)]">
                              {r.emailDetail.filter((e) => e.status !== 'terkirim').map((e, n) => (
                                <li key={n} className="break-all">
                                  {e.alamat || '(kosong)'} · {e.status === 'dilewati' ? 'dilewati' : 'gagal'}
                                  {e.alasan && `: ${e.alasan}`}
                                </li>
                              ))}
                            </ul>
                          )}
                          {admin && bolehKirimUlang(r.emailStatus, r.lockedAt, sekarang) && <KirimUlang defenseId={r.defenseId} />}
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
