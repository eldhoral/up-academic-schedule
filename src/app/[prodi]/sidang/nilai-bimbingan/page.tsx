import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { EmptySheet } from '@/components/EmptySheet'
import { PreviewTable, cell } from '@/components/preview'
import { prodiParam } from '@/lib/prodi-server'
import { canManage, getCurrentRole } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { penilaianPath } from '@/lib/penilaian/akses'
import { tanggalPanjang } from '@/lib/hari'
import { baris, formatNilai } from '@/lib/penilaian/nilai'
import { loadRekapBimbingan, pilihTahun } from '@/lib/penilaian/rekap-data'
import type { DosenNilai } from '@/lib/penilaian/rekap'
import { RekapBar } from './RekapBar'

const COLUMNS = [
  { label: 'No', align: 'center' as const }, { label: 'NPM' }, { label: 'Nama' }, { label: 'Judul Skripsi' },
  { label: 'IPK', align: 'center' as const },
  { label: 'Dosen Pembimbing I' }, { label: 'Nilai I', align: 'center' as const }, { label: 'Huruf I', align: 'center' as const },
  { label: 'Dosen Pembimbing II' }, { label: 'Nilai II', align: 'center' as const }, { label: 'Huruf II', align: 'center' as const },
  { label: 'Nilai Bimbingan', align: 'center' as const }, { label: 'Huruf', align: 'center' as const },
  { label: 'Batas Pengisian', align: 'center' as const },
]
const BELUM = <span className="text-[var(--tinta-3)]">belum dinilai</span>

export default async function RekapBimbinganPage(props: PageProps<'/[prodi]/sidang/nilai-bimbingan'>) {
  const prodi = await prodiParam(props.params)
  if (prodi !== 's1') notFound() // online grading is S1 only
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const [{ years, ay }, role] = await Promise.all([pilihTahun(supabase, searchParams.ay as string | undefined), getCurrentRole()])
  const { rows, aturan } = await loadRekapBimbingan(supabase, ay)
  const admin = canManage(role)
  const tabel = aturan.tabelNilai
  const huruf = (n: number | null) => (n === null ? '' : baris(n, tabel).huruf)

  // Super Admin: a submitted grade opens its form to edit, a missing one to enter (any time). Everyone else reads.
  const nilaiCell = (id: string, d: DosenNilai) => {
    if (d.nilai === null) {
      return admin && d.nama !== '—'
        ? <Link href={penilaianPath(id)} className="text-[0.87rem]">Masukkan nilai</Link>
        : BELUM
    }
    const teks = <span className="mono">{formatNilai(d.nilai)}</span>
    return (
      <>
        {admin ? <Link href={penilaianPath(id)}>{teks}</Link> : teks}
        {d.manual && <span className="block text-[0.73rem] text-[var(--tinta-3)]">(input admin)</span>}
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/sidang/nilai-bimbingan" prodi={prodi} />
      <div className="flex flex-col flex-1">
        <RekapBar years={years} ay={ay} bisaUnduh={rows.length > 0} />
        {rows.length === 0 ? (
          <EmptySheet
            title="Belum ada sidang"
            detail={`${years.find((y) => y.id === ay)?.label ?? 'Tahun ini'} belum memiliki jadwal sidang. Nilai bimbingan diisi Dosen Pembimbing I dan II setelah Ketua mengunci sidang.`}
            actionHref={`/${prodi}/sidang?${new URLSearchParams({ ay, jenis: 'sidang' })}`}
            actionLabel="Buka Jadwal Sidang"
          />
        ) : (
          <div className="px-[1.3rem] py-[1rem]">
            <PreviewTable label="Rekap Nilai Bimbingan" columns={COLUMNS}>
              {rows.map((r, i) => {
                return (
                  <tr key={r.defenseId} className="border-t border-[var(--garis)] align-top">
                    <td className={`${cell('center')} mono`}>{i + 1}</td>
                    <td className={`${cell()} mono whitespace-nowrap`}>{r.npm}</td>
                    <td className={cell()}><Link href={penilaianPath(r.defenseId)}>{r.nama}</Link></td>
                    <td className={`${cell()} min-w-[16rem]`}>{r.judul || '—'}</td>
                    <td className={`${cell('center')} mono`}>{r.ipk === null ? '—' : formatNilai(r.ipk)}</td>
                    <td className={cell()}>{r.dospem1.nama}</td>
                    <td className={cell('center')}>{nilaiCell(r.defenseId, r.dospem1)}</td>
                    <td className={cell('center')}>{huruf(r.dospem1.nilai)}</td>
                    <td className={cell()}>{r.dospem2.nama}</td>
                    <td className={cell('center')}>{nilaiCell(r.defenseId, r.dospem2)}</td>
                    <td className={cell('center')}>{huruf(r.dospem2.nilai)}</td>
                    <td className={`${cell('center')} mono font-semibold`}>{r.bimbingan === null ? BELUM : formatNilai(r.bimbingan)}</td>
                    <td className={`${cell('center')} font-semibold`}>{huruf(r.bimbingan)}</td>
                    <td className={`${cell('center')} whitespace-nowrap`}>{r.batas ? tanggalPanjang(r.batas, false) : <span className="text-[var(--tinta-3)]">belum dikunci</span>}</td>
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
