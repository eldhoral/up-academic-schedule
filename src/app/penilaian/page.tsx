import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { getCurrentUser, isDosen } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { tanggalPanjang } from '@/lib/hari'
import { aksesDosen, penilaianPath, PERAN_LABEL, peranDosen, todayJakarta, type AksesDosen, type Peran } from '@/lib/penilaian/akses'
import type { DefensePenilaian } from '@/lib/penilaian/data'

const STATUS: Record<Exclude<AksesDosen['kind'], 'tidak-ada'>, { label: string; cls: string }> = {
  'belum-dibuka': { label: 'Belum dibuka', cls: 'bg-[var(--cekung)] text-[var(--tinta-3)] border-[var(--garis-kuat)]' },
  isi: { label: 'Belum dinilai', cls: 'bg-[var(--kuning-lembut)] text-[var(--kuning)] border-[var(--kuning-garis)]' },
  terkirim: { label: 'Terkirim', cls: 'bg-[var(--hijau-lembut)] text-[var(--hijau)] border-[var(--hijau)]' },
}

/** Penilaian Saya: a DOSEN's landing page. Its S1 prasidang in every year, newest first. */
export default async function PenilaianSayaPage() {
  const user = await getCurrentUser()
  if (!user || !isDosen(user.role)) redirect('/')
  const kode = user.kodeDosen
  // The DB requires a kode for every DOSEN; /masuk would bounce back here and loop.
  if (!kode) notFound()

  // Admin client after the role check: RLS hides defenses from a DOSEN. Two queries, not an or() filter, so the kode is never parsed as filter syntax.
  const db = createAdminClient()
  const cols = 'id, prodi, jenis, tanggal, npm, nama_mahasiswa, judul_skripsi, pembimbing_kode, penguji_kode'
  const base = () => db.from('defenses').select(cols).eq('prodi', 's1').eq('jenis', 'prasidang')
  const [p1, p2, nilai] = await Promise.all([
    base().eq('pembimbing_kode', kode),
    base().eq('penguji_kode', kode),
    // Own rows only, through RLS.
    (await createClient()).from('nilai_bimbingan').select('defense_id, peran').eq('kode_dosen', kode),
  ])
  const err = p1.error ?? p2.error ?? nilai.error
  if (err) throw new Error(`Gagal memuat daftar penilaian: ${err.message}`)

  const byId = new Map<string, DefensePenilaian>()
  for (const d of [...(p1.data ?? []), ...(p2.data ?? [])] as DefensePenilaian[]) byId.set(d.id, d)
  const rows = [...byId.values()].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || a.nama_mahasiswa.localeCompare(b.nama_mahasiswa))
  const today = todayJakarta()

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/penilaian" />
      <main className="flex-1 w-full max-w-[62rem] mx-auto px-[1.3rem] py-[1.6rem]">
        <h1 className="m-0 text-[1.6rem] font-semibold tracking-[-0.02em]">Penilaian Saya</h1>
        <p className="m-0 mt-[0.13rem] mb-[1.2rem] text-[0.87rem] text-[var(--tinta-3)]">
          Prasidang S1 tempat Anda menjadi Dosen Pembimbing. Penilaian dibuka sejak tanggal prasidang.
        </p>

        {rows.length === 0 ? (
          <p className="m-0 p-[1rem] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] text-[0.93rem] text-[var(--tinta-2)]">
            Belum ada prasidang S1 yang Anda bimbing.
          </p>
        ) : (
          <ul className="m-0 p-0 list-none border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] divide-y divide-[var(--garis)]">
            {rows.map((d) => {
              const submitted = new Set((nilai.data ?? []).filter((n) => n.defense_id === d.id).map((n) => n.peran as Peran))
              const akses = aksesDosen(d, kode, submitted, today)
              const peran = peranDosen(d, kode)
              if (akses.kind === 'tidak-ada' || !peran) return null
              const status = STATUS[akses.kind]
              return (
                <li key={d.id} className="relative flex flex-col sm:flex-row sm:items-center gap-[0.3rem] sm:gap-[1rem] px-[1rem] py-[0.8rem] hover:bg-[var(--cekung)] transition-colors">
                  <div className="sm:w-[11rem] shrink-0 text-[0.87rem] text-[var(--tinta-2)]">{tanggalPanjang(d.tanggal, false)}</div>
                  <div className="flex-1 min-w-0">
                    <Link href={penilaianPath(d.id)} className="text-[0.93rem] font-medium text-[var(--tinta)] after:absolute after:inset-0">
                      <span className="mono text-[var(--tinta-3)] font-normal">{d.npm}</span> {d.nama_mahasiswa}
                    </Link>
                    <p className="m-0 text-[0.8rem] text-[var(--tinta-3)] line-clamp-1">
                      {PERAN_LABEL[peran]}
                      {d.judul_skripsi && ` · ${d.judul_skripsi}`}
                    </p>
                  </div>
                  <span className={`self-start sm:self-center whitespace-nowrap px-[0.5rem] py-[0.1rem] rounded-full border text-[0.8rem] ${status.cls}`}>
                    {status.label}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
