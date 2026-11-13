import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { EmptySheet } from '@/components/EmptySheet'
import { PreviewTable, cell } from '@/components/preview'
import { prodiParam } from '@/lib/prodi-server'
import { canManage, getCurrentRole } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { penilaianSidangPath } from '@/lib/penilaian/akses'
import { formatNilai } from '@/lib/penilaian/nilai'
import { loadRekapAkhir, pilihTahun } from '@/lib/penilaian/rekap-data'
import { bolehKirimUlang, EMAIL_LABEL } from '@/lib/penilaian/rekap'
import { RekapBar } from '../nilai-bimbingan/RekapBar'
import { KirimUlang } from './KirimUlang'

const C = 'center' as const
const COLUMNS = [
  { label: 'No', align: C }, { label: 'NPM' }, { label: 'Nama' }, { label: 'Judul Skripsi' },
  { label: 'Nilai Bimbingan', align: C },
  { label: 'Ketua' }, { label: 'Nilai Ketua', align: C },
  { label: 'Anggota I' }, { label: 'Nilai I', align: C },
  { label: 'Anggota II' }, { label: 'Nilai II', align: C },
  { label: 'Nilai Sidang', align: C }, { label: 'Huruf Sidang', align: C },
  { label: 'Yudisium' }, { label: 'Nilai Akhir', align: C }, { label: 'Huruf', align: C }, { label: 'Bobot Mutu', align: C },
  { label: 'IPK Sebelum', align: C }, { label: 'IPK Setelah', align: C }, { label: 'Predikat' }, { label: 'Status Email' },
]
const BELUM = <span className="text-[var(--tinta-3)]">belum dinilai</span>
const KOSONG = <span className="text-[var(--tinta-3)]">—</span>
const angka = (n: number | null, kosong = KOSONG) => (n === null ? kosong : <span className="mono">{formatNilai(n)}</span>)

export default async function RekapNilaiAkhirPage(props: PageProps<'/[prodi]/sidang/nilai-akhir'>) {
  const prodi = await prodiParam(props.params)
  if (prodi !== 's1') notFound() // sidang grading is S1 only
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const [{ years, ay }, role] = await Promise.all([pilihTahun(supabase, searchParams.ay as string | undefined), getCurrentRole()])
  const rows = await loadRekapAkhir(supabase, ay)
  const admin = canManage(role)
  const sekarang = new Date()

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/sidang/nilai-akhir" prodi={prodi} />
      <div className="flex flex-col flex-1">
        <RekapBar years={years} ay={ay} bisaUnduh={rows.length > 0} slug="nilai-akhir" objek="sidang" />
        {rows.length === 0 ? (
          <EmptySheet
            title="Belum ada sidang skripsi"
            detail={`${years.find((y) => y.id === ay)?.label ?? 'Tahun ini'} belum memiliki jadwal sidang skripsi. Nilai akhir muncul di sini setelah sidang dijadwalkan.`}
            actionHref={`/${prodi}/sidang?${new URLSearchParams({ ay })}`}
            actionLabel="Buka Jadwal Sidang"
          />
        ) : (
          <div className="px-[1.3rem] py-[1rem]">
            <PreviewTable label="Rekap Nilai Akhir" columns={COLUMNS}>
              {rows.map((r, i) => {
                const h = r.hasil
                return (
                  <tr key={r.defenseId} className="border-t border-[var(--garis)] align-top">
                    <td className={`${cell(C)} mono`}>{i + 1}</td>
                    <td className={`${cell()} mono whitespace-nowrap`}>{r.npm}</td>
                    <td className={cell()}><Link href={penilaianSidangPath(r.defenseId)}>{r.nama}</Link></td>
                    <td className={`${cell()} min-w-[16rem]`}>{r.judul || '—'}</td>
                    <td className={cell(C)}>{angka(r.bimbingan, BELUM)}</td>
                    <td className={cell()}>{r.penguji.ketua.nama}</td>
                    <td className={cell(C)}>{angka(r.penguji.ketua.nilai)}</td>
                    <td className={cell()}>{r.penguji.anggota_1.nama}</td>
                    <td className={cell(C)}>{angka(r.penguji.anggota_1.nilai)}</td>
                    <td className={cell()}>{r.penguji.anggota_2.nama}</td>
                    <td className={cell(C)}>{angka(r.penguji.anggota_2.nilai)}</td>
                    <td className={`${cell(C)} font-semibold`}>{angka(h.nilaiSidang)}</td>
                    <td className={cell(C)}>{r.hurufSidang ?? ''}</td>
                    <td className={cell()}>{r.yudisium ?? KOSONG}</td>
                    {h.status === 'lengkap' ? (
                      <>
                        <td className={`${cell(C)} mono font-semibold`}>{formatNilai(h.nilaiAkhir)}</td>
                        <td className={`${cell(C)} font-semibold`}>{h.huruf}</td>
                        <td className={`${cell(C)} mono`}>{formatNilai(h.mutu)}</td>
                      </>
                    ) : (
                      <td colSpan={3} className={`${cell()} min-w-[14rem] text-[var(--tinta-3)]`}>{h.alasan}</td>
                    )}
                    <td className={cell(C)}>{angka(r.ipkSebelum)}</td>
                    <td className={cell(C)}>{h.status === 'lengkap' ? angka(h.ipkSetelah) : KOSONG}</td>
                    <td className={cell()}>{h.status === 'lengkap' ? (h.predikat ?? '—') : KOSONG}</td>
                    <td className={cell()}>
                      {r.emailStatus ? (EMAIL_LABEL[r.emailStatus] ?? r.emailStatus) : KOSONG}
                      {admin && bolehKirimUlang(r.emailStatus, r.lockedAt, sekarang) && <KirimUlang defenseId={r.defenseId} />}
                    </td>
                  </tr>
                )
              })}
            </PreviewTable>
          </div>
        )}
      </div>
    </div>
  )
}
