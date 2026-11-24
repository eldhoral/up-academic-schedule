import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { ResetJadwalButton } from '@/components/ResetJadwalButton'
import { tanggalPanjang } from '@/lib/hari'
import { todayJakarta } from '@/lib/penilaian/akses'
import { accessibleProdi, PRODI_CONFIG } from '@/lib/prodi'
import { getCurrentUser } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { BatangHari, DonatPrasidang, GarisNilai } from './beranda/Grafik'
import { DaftarAktivitas, DaftarSidang, KartuModul } from './beranda/Kartu'
import { loadBeranda } from './beranda-data'
import { getKuliahStatus, getSidangStatus, getUjianStatus } from './hub-status'
import type { AcademicYear } from './[prodi]/kuliah/penjadwalan-types'

export default async function MenuPage() {
  const supabase = await createClient()
  const [{ data: academicYears }, user] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    getCurrentUser(),
  ])

  const years = (academicYears as (AcademicYear & { mulai_kuliah: string | null; selesai_kuliah: string | null })[]) ?? []
  const year = years.find((y) => y.is_active) ?? years[0]
  const prodiList = user ? accessibleProdi(user.prodiAccess) : []
  const [blocks, beranda] = await Promise.all([
    Promise.all(
      prodiList.map(async (prodi) => {
        const [kuliah, ujian, sidang] = year
          ? await Promise.all([getKuliahStatus(year.id, prodi), getUjianStatus(year.id, prodi), getSidangStatus(year.id, prodi)])
          : [null, null, null]
        return { prodi, kuliah, ujian, sidang }
      }),
    ),
    loadBeranda(supabase, year?.id ?? null, prodiList),
  ])
  const adaS1 = prodiList.includes('s1')

  return (
    <AppShell active="/">
      <main className="flex-1 w-full max-w-[74rem] mx-auto px-[1.3rem] py-[1.6rem]">
        <header className="mb-[1.4rem] flex flex-wrap items-end justify-between gap-x-[1rem] gap-y-[0.5rem]">
          <div>
            <h1 className="m-0 text-[1.6rem] font-semibold tracking-[-0.02em]">Beranda</h1>
            <p className="m-0 mt-[0.13rem] text-[0.87rem] text-[var(--tinta-3)]">
              {tanggalPanjang(todayJakarta(), false)} · {year?.label ?? 'Belum ada tahun akademik'}
              {year && (
                <>
                  {' · '}
                  {year.mulai_kuliah || year.selesai_kuliah ? (
                    <span className="whitespace-nowrap">
                      Perkuliahan {tanggalPendek(year.mulai_kuliah)} &ndash; {tanggalPendek(year.selesai_kuliah)}
                    </span>
                  ) : (
                    <Link href="/tahun-akademik" className="text-[var(--tinta-2)] hover:underline">
                      Atur tanggal perkuliahan
                    </Link>
                  )}
                </>
              )}
            </p>
          </div>
          {user?.role === 'SUPERADMIN' && <ResetJadwalButton years={years} />}
        </header>

        {blocks.map(({ prodi, kuliah, ujian, sidang }) => {
          const c = PRODI_CONFIG[prodi]
          return (
            <section key={prodi} aria-label={c.label} className="mb-[1.4rem]">
              <div className="mb-[0.6rem] flex items-baseline justify-between gap-[1rem]">
                <h2 className="m-0 text-[1.07rem] font-semibold tracking-[-0.01em]">{c.label}</h2>
                <Link href={`/${prodi}/mata-kuliah`} className="text-[0.82rem] text-[var(--tinta-2)] hover:text-[var(--aksen)] hover:underline">
                  Data Master {c.short}
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-[0.88rem] sm:grid-cols-3">
                <KartuModul judul="Jadwal Mata Kuliah & Dosen" href={`/${prodi}/kuliah`} cetakHref={`/${prodi}/kuliah/cetak`} status={kuliah} adaTahun={!!year} />
                <KartuModul judul="Jadwal UTS & UAS" href={`/${prodi}/ujian`} cetakHref={`/${prodi}/ujian/cetak`} status={ujian} adaTahun={!!year} />
                <KartuModul judul={`Jadwal ${c.defense.section}`} href={`/${prodi}/sidang`} cetakHref={`/${prodi}/sidang/cetak`} status={sidang} adaTahun={!!year} />
              </div>
            </section>
          )
        })}

        {!beranda ? (
          <p role="status" className="m-0 rounded-[var(--r-kartu)] border border-[var(--garis-kuat)] bg-[var(--lembar)] p-[1rem] text-[0.88rem] text-[var(--tinta-2)]">
            Grafik dan daftar belum bisa dimuat. Muat ulang halaman sebentar lagi.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-[1rem] lg:grid-cols-2">
              <Panel judul="Kelas per Hari">
                <BatangHari data={beranda.kelas} prodiList={prodiList} />
              </Panel>
              {adaS1 && (
                <Panel judul="Rata-rata Nilai Sidang">
                  <GarisNilai data={beranda.nilai ?? []} />
                </Panel>
              )}
            </div>

            <div className="mt-[1rem] grid grid-cols-1 gap-[1rem] lg:grid-cols-3">
              <Panel judul="Sidang Mendatang">
                <DaftarSidang data={beranda.mendatang} prodiList={prodiList} />
              </Panel>
              {adaS1 && (
                <Panel judul="Hasil Prasidang" aksi={<Link href="/s1/sidang/hasil-prasidang" className="text-[0.8rem] text-[var(--aksen)] no-underline hover:underline">Rekap ›</Link>}>
                  <DonatPrasidang data={beranda.prasidang ?? { layak: 0, layak_revisi: 0, tidak_layak: 0, belum_lengkap: 0 }} />
                </Panel>
              )}
              <Panel judul="Aktivitas Terbaru" aksi={<Link href="/log-aktivitas" className="text-[0.8rem] text-[var(--aksen)] no-underline hover:underline">Log ›</Link>}>
                <DaftarAktivitas rows={beranda.aktivitas} />
              </Panel>
            </div>
          </>
        )}
      </main>
    </AppShell>
  )
}

function Panel({ judul, aksi, children }: { judul: string; aksi?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-[var(--r-kartu)] border border-[var(--garis)] bg-[var(--lembar)] p-[1rem]">
      <div className="mb-[0.4rem] flex items-center justify-between gap-[0.5rem]">
        <h2 className="m-0 text-[1rem] font-semibold tracking-[-0.01em]">{judul}</h2>
        {aksi}
      </div>
      {children}
    </section>
  )
}

/** "1 Sep 2026"; a date not set yet reads "—". */
function tanggalPendek(iso: string | null): string {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
