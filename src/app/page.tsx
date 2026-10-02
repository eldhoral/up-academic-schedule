import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { getCurrentRole } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { getKuliahStatus, getUjianStatus, type ScheduleStatus } from './hub-status'
import type { AcademicYear } from './kuliah/penjadwalan-types'

export default async function MenuPage() {
  const supabase = await createClient()
  const [{ data: academicYears }, role] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    getCurrentRole(),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const year = years.find((y) => y.is_active) ?? years[0]
  const [kuliah, ujian] = year ? await Promise.all([getKuliahStatus(year.id), getUjianStatus(year.id)]) : [null, null]

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/" />
      <main className="flex-1 w-full max-w-[72rem] mx-auto px-[1.3rem] py-[1.6rem]">
        <h1 className="m-0 text-[1.6rem] font-semibold tracking-[-0.02em] text-balance">{year?.label ?? 'Belum ada tahun akademik'}</h1>
        <p className="m-0 mt-[0.13rem] mb-[1.2rem] text-[0.87rem] text-[var(--tinta-3)]">Tahun akademik aktif · S1 Psikologi</p>

        <section aria-label="Jadwal" className="bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)]">
          <Entry
            folio="01"
            name="Jadwal Mata Kuliah & Dosen"
            scope="Kelas, dosen, ruangan, jam, bentrok"
            href="/kuliah"
            printHref="/kuliah/cetak"
            hasYear={Boolean(year)}
            status={kuliah}
          />
          <Entry
            folio="02"
            name="Jadwal UTS & UAS"
            scope="Tanggal, pengawas, ruangan, bentrok"
            href="/ujian"
            hasYear={Boolean(year)}
            status={ujian}
          />
        </section>

        <nav
          aria-label="Lainnya"
          className="mt-[1rem] min-h-[2.6rem] flex items-center flex-wrap bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] text-[0.93rem]"
        >
          <AdminLink href="/mata-kuliah">Data Master</AdminLink>
          {role === 'SUPERADMIN' && <AdminLink href="/pengguna">Manajemen Pengguna</AdminLink>}
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
  printHref?: string // not every schedule has a print page yet
  hasYear: boolean
  status: ScheduleStatus | null
}) {
  return (
    <div className="relative flex items-center gap-x-[1.2rem] gap-y-[0.4rem] flex-wrap px-[1rem] py-[0.8rem] min-h-[5.2rem] border-b border-[var(--garis)] last:border-b-0 hover:bg-[var(--cekung)] focus-within:bg-[var(--cekung)] transition-colors">
      <span className="mono w-[1.6rem] text-[0.8rem] text-[var(--tinta-3)]">{folio}</span>

      <div className="flex-1 min-w-[14rem]">
        {/* The stretched link: its pseudo-element makes the whole row the click target. */}
        <Link href={href} className="text-[1.2rem] font-semibold tracking-[-0.01em] text-[var(--tinta)] no-underline after:absolute after:inset-0">
          {name}
        </Link>
        <p className="m-0 text-[0.87rem] text-[var(--tinta-3)]">{scope}</p>
      </div>

      <p className="mono m-0 flex-1 min-w-[10rem] text-[0.93rem] text-[var(--tinta-2)]">
        {!hasYear ? <Link href="/tahun-akademik" className="relative z-10">Belum ada tahun akademik</Link> : (status?.summary ?? '—')}
      </p>

      <Tally status={status} />

      {printHref ? (
        <Link href={printHref} className="relative z-10 w-[3.2rem] text-[0.87rem]">
          Cetak
        </Link>
      ) : (
        <span className="w-[3.2rem]" aria-hidden="true" />
      )}
    </div>
  )
}

/** The one colour on the page: blocking clashes lead, then warnings, then a quiet "bersih". */
function Tally({ status }: { status: ScheduleStatus | null }) {
  const box = 'w-[7rem] text-right'
  if (!status) return <span className={`${box} text-[var(--tinta-3)]`}>—</span>
  if (status.bentrok > 0)
    return (
      <span className={box}>
        <span className="mono block text-[1.87rem] leading-none font-semibold tracking-[-0.025em] text-[var(--merah)]">{status.bentrok}</span>
        <span className="text-[0.73rem] font-semibold uppercase tracking-[0.04em] text-[var(--merah)]">bentrok</span>
      </span>
    )
  if (status.peringatan > 0)
    return <span className={`${box} text-[0.93rem] font-medium text-[var(--kuning)]`}>{status.peringatan} peringatan</span>
  return <span className={`${box} text-[0.93rem] font-medium text-[var(--hijau)]`}>✓ bersih</span>
}

function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="px-[1rem] py-[0.53rem] border-r border-[var(--garis)] last:border-r-0 text-[var(--tinta-2)] no-underline hover:text-[var(--tinta)] hover:underline">
      {children}
    </Link>
  )
}
