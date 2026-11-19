import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { EmptySheet } from '@/components/EmptySheet'
import { PreviewTable, cell } from '@/components/preview'
import { prodiParam } from '@/lib/prodi-server'
import { createClient } from '@/lib/supabase/server'
import { tanggalPanjang } from '@/lib/hari'
import { PERAN_SIDANG, penilaianSidangPath, todayJakarta } from '@/lib/penilaian/akses'
import { formatNilai } from '@/lib/penilaian/nilai'
import { loadRekapAkhir, pilihTahun } from '@/lib/penilaian/rekap-data'
import { statusNilaiSidang } from '@/lib/penilaian/rekap'
import { RekapBar } from '../nilai-bimbingan/RekapBar'

const C = 'center' as const
const COLUMNS = [
  { label: 'No', align: C }, { label: 'Tanggal' }, { label: 'NPM' }, { label: 'Nama' },
  { label: 'Ketua' }, { label: 'Nilai Ketua', align: C },
  { label: 'Anggota I' }, { label: 'Nilai I', align: C },
  { label: 'Anggota II' }, { label: 'Nilai II', align: C },
  { label: 'Nilai Sidang', align: C }, { label: 'Huruf', align: C }, { label: 'Status' },
]
const BELUM = <span className="text-[var(--tinta-3)]">belum dinilai</span>

/** S1 sidang of one year with the three examiner grades and how far each has got. Read-only for staff. */
export default async function RekapNilaiSidangPage(props: PageProps<'/[prodi]/sidang/nilai-sidang'>) {
  const prodi = await prodiParam(props.params)
  if (prodi !== 's1') notFound() // sidang grading is S1 only
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const { years, ay } = await pilihTahun(supabase, searchParams.ay as string | undefined)
  // Same rows as Nilai Akhir: the three grades, the lock and Nilai Sidang come with it.
  const rows = await loadRekapAkhir(supabase, ay)
  const today = todayJakarta()

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/sidang/nilai-sidang" prodi={prodi} />
      <div className="flex flex-col flex-1">
        <RekapBar years={years} ay={ay} bisaUnduh={null} slug="nilai-sidang" />
        {rows.length === 0 ? (
          <EmptySheet
            title="Belum ada sidang skripsi"
            detail={`${years.find((y) => y.id === ay)?.label ?? 'Tahun ini'} belum memiliki jadwal sidang skripsi. Nilai penguji muncul di sini setelah sidang dijadwalkan.`}
            actionHref={`/${prodi}/sidang?${new URLSearchParams({ ay, jenis: 'sidang' })}`}
            actionLabel="Buka Jadwal Sidang"
          />
        ) : (
          <div className="px-[1.3rem] py-[1rem]">
            <PreviewTable label="Rekap Nilai Sidang" columns={COLUMNS}>
              {rows.map((r, i) => {
                const status = statusNilaiSidang(r, today)
                const ns = r.hasil.nilaiSidang
                return (
                  <tr key={r.defenseId} className="border-t border-[var(--garis)] align-top">
                    <td className={`${cell(C)} mono`}>{i + 1}</td>
                    <td className={`${cell()} whitespace-nowrap`}>{tanggalPanjang(r.tanggal, false)}</td>
                    <td className={`${cell()} mono whitespace-nowrap`}>{r.npm}</td>
                    <td className={cell()}><Link href={penilaianSidangPath(r.defenseId)}>{r.nama}</Link></td>
                    {PERAN_SIDANG.flatMap((p) => [
                      <td key={`${p}-n`} className={cell()}>{r.penguji[p].nama}</td>,
                      <td key={`${p}-v`} className={cell(C)}>
                        {r.penguji[p].nilai === null ? BELUM : <span className="mono">{formatNilai(r.penguji[p].nilai!)}</span>}
                      </td>,
                    ])}
                    <td className={`${cell(C)} mono font-semibold`}>{ns === null ? '—' : formatNilai(ns)}</td>
                    <td className={`${cell(C)} font-semibold`}>{r.hurufSidang ?? '—'}</td>
                    <td className={`${cell()} whitespace-nowrap ${r.lockedAt ? 'text-[var(--hijau)]' : 'text-[var(--tinta-2)]'}`}>{status}</td>
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
