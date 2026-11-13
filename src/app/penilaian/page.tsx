import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { getCurrentUser, isDosen, isPenguji } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { tanggalPanjang } from '@/lib/hari'
import {
  aksesDosen, aksesSidang, penilaianPath, penilaianSidangPath, PERAN_LABEL, PERAN_SIDANG_LABEL, peranDosen, peranPenguji, STATUS_SIDANG,
  todayJakarta, type Peran, type PeranSidang,
} from '@/lib/penilaian/akses'
import { identitasPenguji, SIDANG_COLS, type DefensePenilaian, type DefenseSidang } from '@/lib/penilaian/data'

const STATUS_CLS: Record<string, string> = {
  'Belum dibuka': 'bg-[var(--cekung)] text-[var(--tinta-3)] border-[var(--garis-kuat)]',
  'Belum dinilai': 'bg-[var(--kuning-lembut)] text-[var(--kuning)] border-[var(--kuning-garis)]',
  'Menunggu anggota': 'bg-[var(--cekung)] text-[var(--tinta-2)] border-[var(--garis-kuat)]',
  Terkirim: 'bg-[var(--hijau-lembut)] text-[var(--hijau)] border-[var(--hijau)]',
  Terkunci: 'bg-[var(--hijau-lembut)] text-[var(--hijau)] border-[var(--hijau)]',
}
const STATUS_PRASIDANG = { 'belum-dibuka': 'Belum dibuka', isi: 'Belum dinilai', terkirim: 'Terkirim' } as const

type Baris = { id: string; href: string; tanggal: string; npm: string; nama: string; judul: string; jenis: string; peran: string; status: string }

/**
 * Penilaian Saya: an examiner's landing page. A DOSEN sees its S1 prasidang and sidang in every year;
 * an EKSTERNAL only its account day's sidang. Newest first.
 */
export default async function PenilaianSayaPage() {
  const user = await getCurrentUser()
  if (!user || !isPenguji(user.role)) redirect('/')
  // The DB requires a kode for every examiner (and a day row for an EKSTERNAL); /masuk would bounce back here and loop.
  const saya = await identitasPenguji(user)
  if (!saya) notFound()
  const { kode, akunTanggal } = saya
  const dosen = isDosen(user.role)

  // Admin client after the role check: RLS hides defenses from an examiner. One query per column, not an or() filter, so the kode is never parsed as filter syntax.
  const db = createAdminClient()
  const supabase = await createClient()
  const pras = () => db.from('defenses').select('id, prodi, jenis, tanggal, npm, nama_mahasiswa, judul_skripsi, pembimbing_kode, penguji_kode').eq('prodi', 's1').eq('jenis', 'prasidang')
  const sid = () => {
    const q = db.from('defenses').select(SIDANG_COLS).eq('prodi', 's1').eq('jenis', 'sidang')
    return akunTanggal ? q.eq('tanggal', akunTanggal) : q
  }
  const kosong = { data: [], error: null }
  const [p1, p2, s1, s2, s3, nilai] = await Promise.all([
    dosen ? pras().eq('pembimbing_kode', kode) : kosong,
    dosen ? pras().eq('penguji_kode', kode) : kosong,
    sid().eq('penguji_kode', kode),
    sid().eq('penguji_eksternal_kode', kode),
    sid().eq('pembimbing_kode', kode),
    // Own rows only, through RLS (an EKSTERNAL reads none).
    dosen ? supabase.from('nilai_bimbingan').select('defense_id, peran').eq('kode_dosen', kode) : kosong,
  ])
  const err = p1.error ?? p2.error ?? s1.error ?? s2.error ?? s3.error ?? nilai.error
  if (err) throw new Error(`Gagal memuat daftar penilaian: ${err.message}`)
  const sidang = new Map<string, DefenseSidang>()
  for (const d of [...(s1.data ?? []), ...(s2.data ?? []), ...(s3.data ?? [])] as DefenseSidang[]) sidang.set(d.id, d)
  // Through RLS: the Ketua reads all three grades (it waits for the anggota), an anggota its own; any examiner reads the lock.
  const ids = [...sidang.keys()]
  const [ns, hs] = await Promise.all([
    supabase.from('nilai_sidang').select('defense_id, peran').in('defense_id', ids),
    supabase.from('hasil_sidang').select('defense_id').in('defense_id', ids),
  ])
  const err2 = ns.error ?? hs.error
  if (err2) throw new Error(`Gagal memuat daftar penilaian: ${err2.message}`)
  const locked = new Set((hs.data ?? []).map((h) => h.defense_id as string))
  const today = todayJakarta()

  const rows: Baris[] = []
  const pr = new Map<string, DefensePenilaian>()
  for (const d of [...(p1.data ?? []), ...(p2.data ?? [])] as DefensePenilaian[]) pr.set(d.id, d)
  for (const d of pr.values()) {
    const akses = aksesDosen(d, kode, new Set((nilai.data ?? []).filter((n) => n.defense_id === d.id).map((n) => n.peran as Peran)), today)
    const peran = peranDosen(d, kode)
    if (akses.kind === 'tidak-ada' || !peran) continue
    rows.push({ id: d.id, href: penilaianPath(d.id), tanggal: d.tanggal, npm: d.npm, nama: d.nama_mahasiswa, judul: d.judul_skripsi, jenis: 'Prasidang', peran: PERAN_LABEL[peran], status: STATUS_PRASIDANG[akses.kind] })
  }
  for (const d of sidang.values()) {
    const submitted = new Set((ns.data ?? []).filter((n) => n.defense_id === d.id).map((n) => n.peran as PeranSidang))
    const akses = aksesSidang(d, kode, { submitted, locked: locked.has(d.id), today, akunTanggal })
    const peran = peranPenguji(d, kode)
    if (akses.kind === 'tidak-ada' || !peran) continue
    rows.push({ id: d.id, href: penilaianSidangPath(d.id), tanggal: d.tanggal, npm: d.npm, nama: d.nama_mahasiswa, judul: d.judul_skripsi, jenis: 'Sidang', peran: PERAN_SIDANG_LABEL[peran], status: STATUS_SIDANG[akses.kind] })
  }
  rows.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || a.nama.localeCompare(b.nama))

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/penilaian" />
      <main className="flex-1 w-full max-w-[62rem] mx-auto px-[1.3rem] py-[1.6rem]">
        <h1 className="m-0 text-[1.6rem] font-semibold tracking-[-0.02em]">Penilaian Saya</h1>
        <p className="m-0 mt-[0.13rem] mb-[1.2rem] text-[0.87rem] text-[var(--tinta-3)]">
          {dosen
            ? 'Prasidang S1 tempat Anda menjadi Dosen Pembimbing dan Sidang S1 tempat Anda menjadi penguji. Penilaian dibuka sejak tanggal pelaksanaan.'
            : `Sidang S1 yang Anda uji pada ${tanggalPanjang(akunTanggal ?? '', false)}.`}
        </p>

        {rows.length === 0 ? (
          <p className="m-0 p-[1rem] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] text-[0.93rem] text-[var(--tinta-2)]">
            {dosen ? 'Belum ada prasidang atau sidang S1 yang perlu Anda nilai.' : 'Belum ada sidang yang perlu Anda nilai.'}
          </p>
        ) : (
          <ul className="m-0 p-0 list-none border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] divide-y divide-[var(--garis)]">
            {rows.map((d) => (
              <li key={d.id} className="relative flex flex-col sm:flex-row sm:items-center gap-[0.3rem] sm:gap-[1rem] px-[1rem] py-[0.8rem] hover:bg-[var(--cekung)] transition-colors">
                <div className="sm:w-[11rem] shrink-0 text-[0.87rem] text-[var(--tinta-2)]">{tanggalPanjang(d.tanggal, false)}</div>
                <div className="flex-1 min-w-0">
                  <Link href={d.href} className="text-[0.93rem] font-medium text-[var(--tinta)] after:absolute after:inset-0">
                    <span className="mono text-[var(--tinta-3)] font-normal">{d.npm}</span> {d.nama}
                  </Link>
                  <p className="m-0 text-[0.8rem] text-[var(--tinta-3)] line-clamp-1">
                    {d.jenis} · {d.peran}
                    {d.judul && ` · ${d.judul}`}
                  </p>
                </div>
                <span className={`self-start sm:self-center whitespace-nowrap px-[0.5rem] py-[0.1rem] rounded-full border text-[0.8rem] ${STATUS_CLS[d.status]}`}>
                  {d.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
