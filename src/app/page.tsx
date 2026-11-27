import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { ResetJadwalButton } from '@/components/ResetJadwalButton'
import { tanggalPanjang } from '@/lib/hari'
import { todayJakarta } from '@/lib/penilaian/akses'
import { accessibleProdi, PRODI_CONFIG } from '@/lib/prodi'
import { getCurrentUser } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { BatangHari, DonatPrasidang, GarisNilai, LegendaProdi } from './beranda/Grafik'
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
      <main className="beranda-masuk flex flex-1 flex-col gap-[1.467rem] leading-[normal] px-[1.067rem] pt-[1.867rem] pb-[2.4rem] sm:px-[2.133rem]">
        <header className="flex flex-wrap items-end gap-[0.933rem]">
          <div className="grow">
            <h1 className="m-0 text-[1.867rem] font-semibold tracking-[-0.02em]">Beranda</h1>
            <p className="m-0 mt-[0.267rem] text-[0.933rem] text-[var(--tinta-3)]">
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
            <section key={prodi} aria-labelledby={`h-${prodi}`} className="flex flex-col gap-[0.667rem]">
              <div className="flex items-baseline justify-between gap-[1rem]">
                <h2 id={`h-${prodi}`} className="m-0 text-[1.133rem] font-semibold">{c.label}</h2>
                <Link href={`/${prodi}/mata-kuliah`} className="text-[0.867rem] text-[var(--tinta-2)] no-underline hover:text-[var(--aksen)] hover:underline">
                  Data Master {c.short}
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-[0.933rem] sm:grid-cols-3">
                <KartuModul judul="Jadwal Mata Kuliah & Dosen" href={`/${prodi}/kuliah`} cetakHref={`/${prodi}/kuliah/cetak`} status={kuliah} adaTahun={!!year} />
                <KartuModul judul="Jadwal ETS & EAS" href={`/${prodi}/ujian`} cetakHref={`/${prodi}/ujian/cetak`} status={ujian} adaTahun={!!year} />
                <KartuModul judul={`Jadwal ${c.defense.section}`} href={`/${prodi}/sidang`} cetakHref={`/${prodi}/sidang/cetak`} status={sidang} adaTahun={!!year} />
              </div>
            </section>
          )
        })}

        {!beranda ? (
          <p role="status" className="m-0 rounded-[var(--r-kartu)] border border-[var(--garis)] bg-[var(--lembar)] p-[1.067rem] text-[0.933rem] text-[var(--tinta-2)]">
            Grafik dan daftar belum bisa dimuat. Muat ulang halaman sebentar lagi.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-[0.933rem] lg:grid-cols-2">
              <Panel judul="Kelas per Hari" kanan={<LegendaProdi prodiList={prodiList} />}>
                <BatangHari data={beranda.kelas} prodiList={prodiList} />
              </Panel>
              {adaS1 && (
                <Panel judul="Rata-rata Nilai Sidang" kanan={beranda.nilai?.length ? <Catatan>S1 · {beranda.nilai.length} semester terakhir</Catatan> : null}>
                  <GarisNilai data={beranda.nilai ?? []} />
                </Panel>
              )}
            </div>

            <div className="grid grid-cols-1 gap-[0.933rem] lg:grid-cols-3">
              <Panel judul="Sidang Mendatang" kanan={<Catatan>7 hari ke depan</Catatan>} kolom>
                <DaftarSidang data={beranda.mendatang} prodiList={prodiList} />
              </Panel>
              {adaS1 && (
                <Panel judul="Hasil Prasidang" kanan={<Tautan href="/s1/sidang/hasil-prasidang">S1 · lihat rekap</Tautan>} kolom tengah>
                  <DonatPrasidang data={beranda.prasidang ?? { layak: 0, layak_revisi: 0, tidak_layak: 0, belum_lengkap: 0 }} />
                </Panel>
              )}
              <Panel judul="Aktivitas Terbaru" kanan={<Tautan href="/log-aktivitas">Log Aktivitas</Tautan>} kolom>
                <DaftarAktivitas rows={beranda.aktivitas} />
              </Panel>
            </div>
          </>
        )}
      </main>
    </AppShell>
  )
}

/** A white card (Final-Beranda): 16px title with an optional note or link on its right. `kolom` stacks rows 12px apart. */
function Panel({ judul, kanan, kolom, tengah, children }: { judul: string; kanan?: React.ReactNode; kolom?: boolean; tengah?: boolean; children: React.ReactNode }) {
  return (
    <section
      className={`min-w-0 rounded-[var(--r-kartu)] border border-[var(--garis)] bg-[var(--lembar)] p-[1.067rem] ${kolom ? 'flex flex-col gap-[0.8rem]' : ''} ${tengah ? 'items-center' : ''}`}
    >
      <div className={`flex items-center justify-between gap-[0.8rem] ${tengah ? 'self-stretch' : ''}`}>
        <h2 className="m-0 text-[1.067rem] font-semibold">{judul}</h2>
        {kanan}
      </div>
      {children}
    </section>
  )
}

const Catatan = ({ children }: { children: React.ReactNode }) => <span className="text-[0.8rem] text-[var(--tinta-3)]">{children}</span>

const Tautan = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="text-[0.8rem] text-[var(--aksen)] no-underline hover:underline">
    {children}
  </Link>
)

/** "1 Sep 2026"; a date not set yet reads "—". */
function tanggalPendek(iso: string | null): string {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
