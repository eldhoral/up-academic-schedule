import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { EmptySheet } from '@/components/EmptySheet'
import { PreviewTable, cell } from '@/components/preview'
import { prodiParam } from '@/lib/prodi-server'
import { canManage, getCurrentRole } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { lecturerDisplayName } from '@/lib/import/tables'
import { beritaAcaraPath, HASIL_LABEL, lolosGerbang, STATUS_LABEL, type Hasil, type PeranPrasidang } from '@/lib/penilaian/prasidang'
import { buildRekapPrasidang } from '@/lib/penilaian/rekap-prasidang'
import { pilihTahun } from '@/lib/penilaian/rekap-data'
import { RekapBar } from '../nilai-bimbingan/RekapBar'

const COLUMNS = [
  { label: 'No', align: 'center' as const }, { label: 'NPM' }, { label: 'Nama' }, { label: 'Judul Skripsi' },
  { label: 'Pembimbing Pendamping' }, { label: 'Hasil' }, { label: 'Pembahas' }, { label: 'Hasil' },
  { label: 'Hasil Gabungan' }, { label: 'Keputusan Super Admin' }, { label: 'Sidang', align: 'center' as const },
]
const BELUM = <span className="text-[var(--tinta-3)]">belum diisi</span>

export default async function HasilPrasidangPage(props: PageProps<'/[prodi]/sidang/hasil-prasidang'>) {
  const prodi = await prodiParam(props.params)
  if (prodi !== 's1') notFound() // the berita acara is S1 prasidang only
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const [{ years, ay }, role] = await Promise.all([pilihTahun(supabase, searchParams.ay as string | undefined), getCurrentRole()])

  const [d, isian, kep, sid, dosen] = await Promise.all([
    supabase.from('defenses')
      .select('id, npm, tanggal, created_at, nama_mahasiswa, judul_skripsi, pembimbing_kode, penguji_kode')
      .eq('prodi', 's1').eq('jenis', 'prasidang').eq('academic_year_id', ay),
    supabase.from('berita_acara_prasidang').select('defense_id, peran, hasil, defenses!inner(academic_year_id)').eq('defenses.academic_year_id', ay),
    supabase.from('keputusan_prasidang').select('npm, prasidang_id, hasil, alasan'),
    supabase.from('defenses').select('npm').eq('prodi', 's1').eq('jenis', 'sidang'),
    supabase.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang'),
  ])
  const err = d.error ?? isian.error ?? kep.error ?? sid.error ?? dosen.error
  if (err) throw new Error(`Gagal memuat hasil prasidang: ${err.message}`)

  const nama = new Map((dosen.data ?? []).map((x) => [x.kode_dosen as string, lecturerDisplayName(x)]))
  const rows = buildRekapPrasidang(
    d.data ?? [],
    (isian.data ?? []).map((x) => ({ defense_id: x.defense_id as string, peran: x.peran as PeranPrasidang, hasil: x.hasil as Hasil })),
    (kep.data ?? []).map((x) => ({ npm: x.npm as string, prasidang_id: x.prasidang_id as string | null, hasil: x.hasil as Hasil, alasan: x.alasan as string })),
    new Set((sid.data ?? []).map((x) => x.npm as string)),
    (k) => nama.get(k) ?? k,
  )
  const admin = canManage(role)
  const hasil = (h: Hasil | null) => (h ? HASIL_LABEL[h] : BELUM)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/sidang/hasil-prasidang" prodi={prodi} />
      <div className="flex flex-col flex-1">
        <RekapBar years={years} ay={ay} bisaUnduh={null} slug="hasil-prasidang" />
        {rows.length === 0 ? (
          <EmptySheet
            title="Belum ada prasidang"
            detail={`${years.find((y) => y.id === ay)?.label ?? 'Tahun ini'} belum memiliki jadwal prasidang. Hasil berita acara muncul di sini setelah prasidang dijadwalkan.`}
            actionHref={`/${prodi}/sidang?${new URLSearchParams({ ay })}`}
            actionLabel="Buka Jadwal Prasidang"
          />
        ) : (
          <div className="px-[1.3rem] py-[1rem]">
            <PreviewTable label="Rekap Hasil Prasidang" columns={COLUMNS}>
              {rows.map((r, i) => (
                <tr key={r.defenseId} className="border-t border-[var(--garis)] align-top">
                  <td className={`${cell('center')} mono`}>{i + 1}</td>
                  <td className={`${cell()} mono whitespace-nowrap`}>{r.npm}</td>
                  <td className={cell()}><Link href={beritaAcaraPath(r.defenseId)}>{r.nama}</Link></td>
                  <td className={`${cell()} min-w-[16rem]`}>{r.judul || '—'}</td>
                  <td className={cell()}>{r.pendamping.nama}</td>
                  <td className={cell()}>{hasil(r.pendamping.hasil)}</td>
                  <td className={cell()}>{r.pembahas.nama}</td>
                  <td className={cell()}>{hasil(r.pembahas.hasil)}</td>
                  <td className={`${cell()} font-semibold ${lolosGerbang(r.gabungan) ? 'text-[var(--hijau)]' : ''}`}>{STATUS_LABEL[r.gabungan]}</td>
                  <td className={cell()}>
                    {r.keputusan ? <>{HASIL_LABEL[r.keputusan.hasil]}<span className="block text-[0.8rem] text-[var(--tinta-3)]">{r.keputusan.alasan}</span></> : '—'}
                    {admin && <Link href={`/${prodi}/mahasiswa`} className="block text-[0.8rem]">Ubah di Data Mahasiswa</Link>}
                  </td>
                  <td className={cell('center')}>{r.adaSidang ? 'Ada' : '—'}</td>
                </tr>
              ))}
            </PreviewTable>
          </div>
        )}
      </div>
    </div>
  )
}
