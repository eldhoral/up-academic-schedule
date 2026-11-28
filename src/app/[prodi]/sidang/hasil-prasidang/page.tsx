import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { EmptySheet } from '@/components/EmptySheet'
import { PreviewTable, cell } from '@/components/preview'
import { prodiParam } from '@/lib/prodi-server'
import { createClient } from '@/lib/supabase/server'
import { canManage, getCurrentRole } from '@/lib/roles'
import { bolehKirimUlang, EMAIL_LABEL } from '@/lib/penilaian/rekap'
import { KirimUlang } from '../nilai-akhir/KirimUlang'
import { beritaAcaraPath, HASIL_LABEL, lolosGerbang, STATUS_LABEL, type Hasil, type PeranPrasidang, type StatusPrasidang } from '@/lib/penilaian/prasidang'
import { buildRekapPrasidang } from '@/lib/penilaian/rekap-prasidang'
import { pilihTahun, terapkanCari } from '@/lib/penilaian/rekap-data'
import { bacaFilter, cariSql, kolomUrut, urutkan } from '@/lib/penilaian/rekap-filter'
import { RekapBar } from '../nilai-bimbingan/RekapBar'
import { RekapFilter, TidakCocok } from '../nilai-bimbingan/RekapFilter'
import { istilah } from '@/lib/prodi'

const C = 'center' as const
const URUT = ['tanggal', 'npm', 'nama', 'hasil'] as const
const STATUS = [
  { value: 'layak', label: STATUS_LABEL.layak },
  { value: 'layak_revisi', label: STATUS_LABEL.layak_revisi },
  { value: 'tidak_layak', label: STATUS_LABEL.tidak_layak },
  { value: 'belum_lengkap', label: STATUS_LABEL.belum_lengkap },
  { value: 'email_gagal', label: 'Email gagal' },
] as const
const KOSONG = <span className="text-[var(--tinta-3)]">—</span>
// Sort order of the hasil column: passed first, then revisi, rejected, still open.
const PERINGKAT: Record<StatusPrasidang, number> = { layak: 0, layak_revisi: 1, tidak_layak: 2, belum_lengkap: 3, tidak_ada: 4 }

/**
 * The summary only: each berita acara, its verdict and the Super Admin decision's reason are on the berita acara
 * page (click the name). Filter and sort come from the URL, on the server.
 */
export default async function HasilPrasidangPage(props: PageProps<'/[prodi]/sidang/hasil-prasidang'>) {
  const prodi = await prodiParam(props.params)
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const { years, ay } = await pilihTahun(supabase, searchParams.ay as string | undefined)
  const path = `/${prodi}/sidang/hasil-prasidang`
  const f = bacaFilter(searchParams, { urut: URUT, status: STATUS.map((s) => s.value) })

  const [d, isian, kep, sid, role] = await Promise.all([
    // Search and tanggal/NPM/nama order in SQL; the hasil filter and sort after (it is computed).
    terapkanCari(supabase.from('defenses')
      .select('id, npm, tanggal, created_at, nama_mahasiswa, judul_skripsi')
      .eq('prodi', prodi).eq('jenis', 'prasidang').eq('academic_year_id', ay), cariSql(f)),
    supabase.from('berita_acara_prasidang').select('defense_id, peran, hasil, email_status, email_detail, submitted_at, defenses!inner(academic_year_id)').eq('defenses.academic_year_id', ay),
    supabase.from('keputusan_prasidang').select('npm, prasidang_id, hasil, alasan'),
    supabase.from('defenses').select('npm').eq('prodi', prodi).eq('jenis', 'sidang'),
    getCurrentRole(),
  ])
  const err = d.error ?? isian.error ?? kep.error ?? sid.error
  if (err) throw new Error(`Gagal memuat hasil prasidang: ${err.message}`)

  const semua = buildRekapPrasidang(
    d.data ?? [],
    (isian.data ?? []).map((x) => ({
      defense_id: x.defense_id as string, peran: x.peran as PeranPrasidang, hasil: x.hasil as Hasil,
      email_status: x.email_status as string, email_detail: x.email_detail, submitted_at: x.submitted_at as string,
    })),
    (kep.data ?? []).map((x) => ({ npm: x.npm as string, prasidang_id: x.prasidang_id as string | null, hasil: x.hasil as Hasil, alasan: x.alasan as string })),
    new Set((sid.data ?? []).map((x) => x.npm as string)),
  )
  // A Super Admin decision for this prasidang overrides the berita acara.
  const hasil = (r: (typeof semua)[number]): StatusPrasidang => r.keputusan?.hasil ?? r.status
  const emailGagal = (r: (typeof semua)[number]) => r.email?.status === 'gagal' || r.email?.status === 'sebagian'
  const cocok = f.status === 'email_gagal' ? semua.filter(emailGagal) : f.status ? semua.filter((r) => hasil(r) === f.status) : semua
  const admin = canManage(role)
  const sekarang = new Date()
  const rows = f.urut === 'hasil' ? urutkan(cocok, (r) => PERINGKAT[hasil(r)], f.arah) : cocok
  const aktif = !!(f.q || f.status)
  const k = (key: (typeof URUT)[number]) => kolomUrut(path, ay, f, key)
  const columns = [
    { label: 'No', align: C }, { label: 'NPM', ...k('npm') }, { label: 'Nama', ...k('nama') }, { label: 'Hasil', ...k('hasil') },
    { label: 'Sidang', align: C }, { label: 'Status Email' },
  ]

  return (
    <AppShell active="/sidang/hasil-prasidang" prodi={prodi}>
      <div className="flex flex-col flex-1">
        <RekapBar years={years} ay={ay} bisaUnduh={null} slug="hasil-prasidang" />
        {rows.length === 0 && !aktif ? (
          <EmptySheet
            title={istilah(prodi, 'Belum ada prasidang')}
            detail={istilah(prodi, `${years.find((y) => y.id === ay)?.label ?? 'Tahun ini'} belum memiliki jadwal prasidang. Hasil berita acara muncul di sini setelah prasidang dijadwalkan.`)}
            actionHref={`/${prodi}/sidang?${new URLSearchParams({ ay })}`}
            actionLabel={istilah(prodi, 'Buka Jadwal Prasidang')}
          />
        ) : (
          <>
            <RekapFilter path={path} ay={ay} f={f} status={[...STATUS]} />
            <div className="px-[1.3rem] py-[1rem]">
              {rows.length === 0 ? <TidakCocok /> : (
                <PreviewTable label={istilah(prodi, 'Rekap Hasil Prasidang')} columns={columns}>
                  {rows.map((r, i) => (
                    <tr key={r.defenseId} className="border-t border-[var(--garis)] align-top">
                      <td className={`${cell(C)} mono`}>{i + 1}</td>
                      <td className={`${cell()} mono whitespace-nowrap`}>{r.npm}</td>
                      <td className={cell()}><Link href={beritaAcaraPath(r.defenseId)}>{r.nama}</Link></td>
                      <td className={`${cell()} font-semibold ${lolosGerbang(hasil(r)) ? 'text-[var(--hijau)]' : ''}`}>
                        {istilah(prodi, r.keputusan ? HASIL_LABEL[r.keputusan.hasil] : STATUS_LABEL[r.status])}
                        {r.keputusan && <span className="block text-[0.8rem] font-normal text-[var(--tinta-3)]">Keputusan Super Admin</span>}
                      </td>
                      <td className={cell(C)}>{r.adaSidang ? 'Ada' : '—'}</td>
                      <td className={cell()}>
                        {r.email ? (EMAIL_LABEL[r.email.status] ?? r.email.status) : KOSONG}
                        {r.email && emailGagal(r) && (
                          <ul className="m-0 mt-[0.2rem] p-0 list-none text-[0.8rem] text-[var(--tinta-3)]">
                            {r.email.detail.filter((e) => e.status !== 'terkirim').map((e, n) => (
                              <li key={n} className="break-all">
                                {e.alamat || '(kosong)'} · {e.status === 'dilewati' ? 'dilewati' : 'gagal'}
                                {e.alasan && `: ${e.alasan}`}
                              </li>
                            ))}
                          </ul>
                        )}
                        {admin && r.email && bolehKirimUlang(r.email.status, r.email.submittedAt, sekarang) && <KirimUlang defenseId={r.defenseId} prasidang />}
                      </td>
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
