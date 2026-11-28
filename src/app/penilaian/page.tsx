import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { getCurrentUser, isDosen, isPenguji } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { tanggalPanjang } from '@/lib/hari'
import {
  aksesBeritaAcara, aksesBimbingan, aksesSidang, penilaianPath, penilaianSidangPath, PERAN_LABEL, PERAN_SIDANG_LABEL, peranPenguji,
  peranPrasidang, STATUS_SIDANG, todayJakarta, type Peran, type PeranSidang,
} from '@/lib/penilaian/akses'
import { batasBeritaAcara, beritaAcaraPath, PERAN_PRASIDANG_LABEL, type PeranPrasidang } from '@/lib/penilaian/prasidang'
import { identitasPenguji, SIDANG_COLS, type DefensePenilaian, type DefenseSidang } from '@/lib/penilaian/data'
import { loadAturan } from '@/lib/penilaian/aturan'
import { PRODI_CONFIG } from '@/lib/prodi'

const STATUS_CLS: Record<string, string> = {
  'Belum dibuka': 'bg-[var(--cekung)] text-[var(--tinta-3)] border-[var(--garis-kuat)]',
  'Belum dinilai': 'bg-[var(--kuning-lembut)] text-[var(--kuning)] border-[var(--kuning-garis)]',
  'Belum diisi': 'bg-[var(--kuning-lembut)] text-[var(--kuning)] border-[var(--kuning-garis)]',
  'Menunggu anggota': 'bg-[var(--cekung)] text-[var(--tinta-2)] border-[var(--garis-kuat)]',
  Terkirim: 'bg-[var(--hijau-lembut)] text-[var(--hijau)] border-[var(--hijau)]',
  Terkunci: 'bg-[var(--hijau-lembut)] text-[var(--hijau)] border-[var(--hijau)]',
  'Menunggu kunci sidang': 'bg-[var(--cekung)] text-[var(--tinta-3)] border-[var(--garis-kuat)]',
  'Lewat batas': 'bg-[var(--merah-lembut)] text-[var(--merah-teks)] border-[var(--merah-garis)]',
  'Tidak dibuka': 'bg-[var(--cekung)] text-[var(--tinta-3)] border-[var(--garis-kuat)]',
}
const kelasStatus = (s: string) => STATUS_CLS[s] ?? STATUS_CLS['Belum dinilai']
const STATUS_PRASIDANG = { 'belum-dibuka': 'Belum dibuka', isi: 'Belum diisi', terkirim: 'Terkirim' } as const

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
  const pras = () => db.from('defenses').select('id, prodi, jenis, tanggal, npm, nama_mahasiswa, judul_skripsi, pembimbing_kode, penguji_kode').in('prodi', ['s1', 's2']).eq('jenis', 'prasidang')
  const sid = () => {
    const q = db.from('defenses').select(SIDANG_COLS).in('prodi', ['s1', 's2']).eq('jenis', 'sidang')
    return akunTanggal ? q.eq('tanggal', akunTanggal) : q
  }
  const kosong = { data: [], error: null }
  const [p1, p2, s1, s2, s3, isian] = await Promise.all([
    dosen ? pras().eq('pembimbing_kode', kode) : kosong,
    dosen ? pras().eq('penguji_kode', kode) : kosong,
    sid().eq('penguji_kode', kode),
    sid().eq('penguji_eksternal_kode', kode),
    sid().eq('pembimbing_kode', kode),
    // Own rows only, through RLS (an EKSTERNAL reads none).
    dosen ? supabase.from('berita_acara_prasidang').select('defense_id, peran').eq('kode_dosen', kode) : kosong,
  ])
  const err = p1.error ?? p2.error ?? s1.error ?? s2.error ?? s3.error ?? isian.error
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
    const akses = aksesBeritaAcara(d, kode, new Set((isian.data ?? []).filter((n) => n.defense_id === d.id).map((n) => n.peran as PeranPrasidang)), today)
    const peran = peranPrasidang(d, kode)
    if (akses.kind === 'tidak-ada' || !peran) continue
    rows.push({ id: `ba-${d.id}`, href: beritaAcaraPath(d.id), tanggal: d.tanggal, npm: d.npm, nama: d.nama_mahasiswa, judul: d.judul_skripsi, jenis: `Berita Acara ${PRODI_CONFIG[d.prodi].defense.prasidang}`, peran: PERAN_PRASIDANG_LABEL[peran], status: akses.kind === 'isi' ? `Belum diisi (batas ${tanggalPanjang(batasBeritaAcara(d.tanggal), false)})` : STATUS_PRASIDANG[akses.kind] })
  }
  for (const d of sidang.values()) {
    const submitted = new Set((ns.data ?? []).filter((n) => n.defense_id === d.id).map((n) => n.peran as PeranSidang))
    const akses = aksesSidang(d, kode, { submitted, locked: locked.has(d.id), today, akunTanggal })
    const peran = peranPenguji(d, kode)
    if (akses.kind === 'tidak-ada' || !peran) continue
    rows.push({ id: d.id, href: penilaianSidangPath(d.id), tanggal: d.tanggal, npm: d.npm, nama: d.nama_mahasiswa, judul: d.judul_skripsi, jenis: PRODI_CONFIG[d.prodi].defense.sidang, peran: PERAN_SIDANG_LABEL[peran], status: STATUS_SIDANG[akses.kind] })
  }
  if (dosen) rows.push(...(await barisBimbingan(kode, today)))
  rows.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || a.nama.localeCompare(b.nama))

  return (
    <AppShell active="/penilaian">
      <main className="flex-1 w-full max-w-[62rem] mx-auto px-[1.3rem] py-[1.6rem]">
        <h1 className="m-0 text-[1.6rem] font-semibold tracking-[-0.02em]">Penilaian Saya</h1>
        <p className="m-0 mt-[0.13rem] mb-[1.2rem] text-[0.87rem] text-[var(--tinta-3)]">
          {dosen
            ? 'Berita acara prasidang (S1) dan seminar proposal (S2) tempat Anda menjadi Pembimbing Pendamping, sidang skripsi dan sidang tesis tempat Anda menjadi penguji, dan Nilai Bimbingan mahasiswa yang Anda bimbing (dibuka setelah Ketua mengunci sidang).'
            : `Sidang yang Anda uji pada ${tanggalPanjang(akunTanggal ?? '', false)}.`}
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
                <span className={`self-start sm:self-center whitespace-nowrap px-[0.5rem] py-[0.1rem] rounded-full border text-[0.8rem] ${kelasStatus(d.status)}`}>
                  {d.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  )
}

const STATUS_BIMBINGAN = {
  'menunggu-kunci': () => 'Menunggu kunci sidang',
  'tidak-lulus': () => 'Tidak dibuka',
  lewat: () => 'Lewat batas',
  terkirim: () => 'Terkirim',
  isi: (batas: string) => `Belum dinilai (batas ${tanggalPanjang(batas, false)})`,
} as const

/** Nilai Bimbingan rows: S1 sidang of students this dosen supervises (Data Mahasiswa), with the lock and window. */
async function barisBimbingan(kode: string, today: string): Promise<Baris[]> {
  const db = createAdminClient()
  const supabase = await createClient()
  const [m1, m2, aturan] = await Promise.all([
    db.from('students').select('npm, prodi, pembimbing_1_kode, pembimbing_2_kode').eq('pembimbing_1_kode', kode),
    db.from('students').select('npm, prodi, pembimbing_1_kode, pembimbing_2_kode').eq('pembimbing_2_kode', kode),
    // Each prodi has its own batas hari (S2 since kiprat 2026-11-27).
    Promise.all([loadAturan(db, 's1'), loadAturan(db, 's2')]).then(([s1, s2]) => ({ s1, s2 })),
  ])
  const err = m1.error ?? m2.error
  if (err) throw new Error(`Gagal memuat daftar penilaian: ${err.message}`)
  const mhs = new Map([...(m1.data ?? []), ...(m2.data ?? [])].map((m) => [m.npm as string, m]))
  if (mhs.size === 0) return []

  const { data: sid, error: sErr } = await db.from('defenses').select('id, prodi, jenis, tanggal, npm, nama_mahasiswa, judul_skripsi')
    .in('prodi', ['s1', 's2']).eq('jenis', 'sidang').in('npm', [...mhs.keys()])
  if (sErr) throw new Error(`Gagal memuat daftar penilaian: ${sErr.message}`)
  const ids = (sid ?? []).map((d) => d.id as string)
  if (ids.length === 0) return []
  const [hs, nb] = await Promise.all([
    db.from('hasil_sidang').select('defense_id, locked_at, yudisium_lulus').in('defense_id', ids),
    // Own rows only, through RLS.
    supabase.from('nilai_bimbingan').select('defense_id, peran').eq('kode_dosen', kode).in('defense_id', ids),
  ])
  const err2 = hs.error ?? nb.error
  if (err2) throw new Error(`Gagal memuat daftar penilaian: ${err2.message}`)
  const kunci = new Map((hs.data ?? []).map((h) => [h.defense_id as string, { lockedAt: h.locked_at as string, lulus: !!h.yudisium_lulus }]))

  return (sid ?? []).flatMap((d): Baris[] => {
    const m = mhs.get(d.npm as string)!
    const ref = { ...d, pembimbing_1_kode: m.pembimbing_1_kode, pembimbing_2_kode: m.pembimbing_2_kode }
    const submitted = new Set((nb.data ?? []).filter((n) => n.defense_id === d.id).map((n) => n.peran as Peran))
    const akses = aksesBimbingan(ref, kode, { submitted, kunci: kunci.get(d.id) ?? null, today, batasHari: aturan[d.prodi as 's1' | 's2'].batasHariBimbingan })
    if (akses.kind === 'tidak-ada') return []
    const status = akses.kind === 'isi' ? STATUS_BIMBINGAN.isi(akses.batas) : STATUS_BIMBINGAN[akses.kind]()
    const peran: Peran = m.pembimbing_1_kode === kode ? 'pembimbing_1' : 'pembimbing_2'
    return [{ id: `nb-${d.id}`, href: penilaianPath(d.id), tanggal: d.tanggal, npm: d.npm, nama: d.nama_mahasiswa, judul: d.judul_skripsi, jenis: 'Nilai Bimbingan', peran: PERAN_LABEL[peran], status }]
  })
}
