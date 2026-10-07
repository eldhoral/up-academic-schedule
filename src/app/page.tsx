import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { getCurrentRole } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { getCampusPhoto, getKuliahStatus, getSidangStatus, getUjianStatus, type ScheduleStatus } from './hub-status'
import type { AcademicYear } from './[prodi]/kuliah/penjadwalan-types'

export default async function MenuPage() {
  const supabase = await createClient()
  const [{ data: academicYears }, role, photo] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    getCurrentRole(),
    getCampusPhoto(),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const year = years.find((y) => y.is_active) ?? years[0]
  const [kuliah, ujian, sidang] = year ? await Promise.all([getKuliahStatus(year.id), getUjianStatus(year.id), getSidangStatus(year.id)]) : [null, null, null]

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/" />
      <main className="flex-1 w-full max-w-[62rem] mx-auto px-[1.3rem] py-[1.6rem]">
        {/* The campus, as on the login page: a quiet band, not a hero. It sets the place;
            the register below stays the focus. */}
        <figure className="relative m-0 mb-[1.2rem] h-[6.5rem] sm:h-[9rem] overflow-hidden rounded-[var(--r-sedang)] bg-[var(--tinta)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- the photo may come from Supabase Storage */}
          <img src={photo} alt="Gedung Fakultas Psikologi, Universitas Pancasila" className="absolute inset-0 w-full h-full object-cover object-[center_18%]" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[var(--tinta)]/80 via-[var(--tinta)]/35 to-transparent" />
          <figcaption className="absolute inset-y-0 left-0 flex flex-col justify-end p-[1rem] sm:p-[1.3rem]">
            <span className="text-[0.73rem] font-medium tracking-[0.04em] uppercase text-white/75">Universitas Pancasila</span>
            <span className="text-[1.2rem] font-semibold leading-[1.3] tracking-[-0.01em] text-white">Fakultas Psikologi</span>
          </figcaption>
        </figure>

        <h1 className="m-0 text-[1.6rem] font-semibold tracking-[-0.02em] text-balance">{year?.label ?? 'Belum ada tahun akademik'}</h1>
        <p className="m-0 mt-[0.13rem] mb-[1.2rem] text-[0.87rem] text-[var(--tinta-3)]">Tahun akademik aktif · S1 Psikologi</p>

        <section aria-label="Jadwal" className="bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)]">
          <Entry folio="01" name="Jadwal Mata Kuliah & Dosen" scope="Kelas, dosen, ruangan, jam, bentrok" href="/s1/kuliah" printHref="/s1/kuliah/cetak" hasYear={Boolean(year)} status={kuliah} />
          <Entry folio="02" name="Jadwal UTS & UAS" scope="Tanggal, pengawas, ruangan, bentrok" href="/s1/ujian" printHref="/s1/ujian/cetak" hasYear={Boolean(year)} status={ujian} />
          <Entry folio="03" name="Jadwal Prasidang & Sidang" scope="Mahasiswa, penguji, ruang, bentrok" href="/s1/sidang" printHref="/s1/sidang/cetak" hasYear={Boolean(year)} status={sidang} />
        </section>

        {/* Secondary on purpose: a quiet line of links, not a fourth row competing with the schedules. */}
        <nav aria-label="Lainnya" className="mt-[1rem] flex flex-wrap items-center gap-x-[0.27rem] text-[0.93rem] text-[var(--tinta-3)]">
          <span className="mr-[0.27rem]">Lainnya:</span>
          <AdminLink href="/s1/mata-kuliah">Data Master</AdminLink>
          {role === 'SUPERADMIN' && (
            <>
              <span aria-hidden="true">·</span>
              <AdminLink href="/pengguna">Manajemen Pengguna</AdminLink>
            </>
          )}
          <span aria-hidden="true">·</span>
          <AdminLink href="/log-aktivitas">Audit Log</AdminLink>
        </nav>
      </main>
    </div>
  )
}

function Entry({
  folio,
  name,
  scope,
  href,
  printHref,
  hasYear,
  status,
}: {
  folio: string
  name: string
  scope: string
  href: string
  printHref: string
  hasYear: boolean
  status: ScheduleStatus | null
}) {
  const muted = 'm-0 text-[0.93rem] text-[var(--tinta-3)]'
  return (
    // Phone: folio | name, with status and tally + Cetak on rows below. md+: one ledger line,
    // folio | name | status | tally | Cetak, in fixed columns so every row lines up.
    <div className="group relative grid grid-cols-[1.6rem_minmax(0,1fr)_auto] md:grid-cols-[1.6rem_minmax(0,1fr)_18rem_10.5rem_3rem] items-center gap-x-[1rem] gap-y-[0.33rem] px-[1rem] py-[0.8rem] min-h-[5.2rem] border-b border-[var(--garis)] last:border-b-0 hover:bg-[var(--cekung)] focus-within:bg-[var(--cekung)] transition-colors">
      <span className="mono self-start md:self-center pt-[0.27rem] md:pt-0 text-[0.8rem] text-[var(--tinta-3)]">{folio}</span>

      <div className="col-span-2 md:col-span-1 min-w-0">
        {/* The stretched link: its pseudo-element makes the whole row the click target. */}
        <Link href={href} className="text-[1.2rem] font-semibold tracking-[-0.01em] text-[var(--tinta)] no-underline text-balance after:absolute after:inset-0">
          {name.slice(0, name.lastIndexOf(' ') + 1)}
          {/* The last word and the chevron travel together, so the chevron never wraps alone. */}
          <span className="whitespace-nowrap">
            {name.slice(name.lastIndexOf(' ') + 1)}
            <span aria-hidden="true" className="inline-block ml-[0.4rem] text-[var(--tinta-3)] transition-transform duration-150 group-hover:translate-x-[2px] group-hover:text-[var(--tinta)]">
              ›
            </span>
          </span>
        </Link>
        <p className="m-0 text-[0.87rem] text-[var(--tinta-3)]">{scope}</p>
      </div>

      {!hasYear ? (
        <p className={`${muted} col-start-2 col-span-2 md:col-start-auto md:col-span-2`}>
          <Link href="/tahun-akademik" className="relative z-10">
            Belum ada tahun akademik
          </Link>
        </p>
      ) : !status ? (
        <p className={`${muted} col-start-2 col-span-2 md:col-start-auto md:col-span-2`}>Status belum bisa dibaca</p>
      ) : status.empty ? (
        <p className={`${muted} col-start-2 col-span-2 md:col-start-auto md:col-span-2`}>Belum ada jadwal</p>
      ) : (
        <>
          <p className={`${muted} col-start-2 col-span-2 md:col-start-auto md:col-span-1`}>
            {/* Each fact stays on one line; a wrap happens between facts. */}
            <span className="whitespace-nowrap">
              <span className="font-semibold text-[var(--tinta)]">{status.figure}</span> {status.label}
            </span>
            {status.detail.map((d) => (
              // The space sits outside the span: a line breaks between facts, never inside one.
              <span key={d}>
                {' '}
                <span className="whitespace-nowrap">· {d}</span>
              </span>
            ))}
          </p>
          <Tally status={status} />
        </>
      )}

      <Link
        href={printHref}
        className="relative z-10 col-start-3 md:col-start-auto justify-self-end text-[0.87rem] text-[var(--tinta-2)] no-underline hover:text-[var(--biru)] hover:underline"
      >
        Cetak
      </Link>
    </div>
  )
}

/** The one colour on the page: blocking clashes lead, then warnings and gaps, then a quiet "bersih". */
function Tally({ status }: { status: ScheduleStatus }) {
  const cell = 'col-start-2 md:col-start-auto justify-self-start md:justify-self-end text-left md:text-right'
  if (status.bentrok > 0)
    return (
      <span className={cell}>
        <span className="mono block text-[1.87rem] leading-none font-semibold tracking-[-0.025em] text-[var(--merah)]">{status.bentrok}</span>
        <span className="text-[0.73rem] font-semibold uppercase tracking-[0.04em] text-[var(--merah)]">bentrok</span>
      </span>
    )
  const notes = [status.peringatan > 0 && `${status.peringatan} peringatan`, status.gaps && `${status.gaps.n} ${status.gaps.label}`].filter(Boolean)
  if (notes.length > 0)
    return (
      <span className={`${cell} text-[0.87rem] font-medium text-[var(--kuning)]`}>
        {notes.map((n) => (
          <span key={n as string} className="block">
            {n}
          </span>
        ))}
      </span>
    )
  return <span className={`${cell} text-[0.93rem] font-medium text-[var(--hijau)]`}>✓ bersih</span>
}

function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-block py-[0.4rem] text-[var(--tinta-2)] no-underline hover:text-[var(--tinta)] hover:underline">
      {children}
    </Link>
  )
}
