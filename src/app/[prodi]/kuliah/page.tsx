import { AppHeader } from '@/components/AppHeader'
import { clampSemester, parseJenisKelas } from '@/lib/prodi'
import { prodiParam } from '@/lib/prodi-server'
import { createClient } from '@/lib/supabase/server'
import { getSettings, settingInt, settingText } from '@/lib/settings'
import { PenjadwalanClient } from './PenjadwalanClient'
import { fetchSchedulesForContext } from './schedule-query'
import { checkKuliahFindings } from './clash-actions'
import { canWrite, getCurrentRole } from '@/lib/roles'
import { LECTURER_COLUMNS, YEAR_COLUMNS, type AcademicYear, type Course, type KuliahContext, type Lecturer, type Room, type SessionRow } from './penjadwalan-types'

function classLetters(maxLetter: string): string[] {
  const max = /^[A-Z]$/.test(maxLetter) ? maxLetter : 'Z'
  const letters: string[] = []
  for (let code = 'A'.charCodeAt(0); code <= max.charCodeAt(0); code++) {
    letters.push(String.fromCharCode(code))
  }
  return letters
}

export default async function DashboardPage(props: PageProps<'/[prodi]/kuliah'>) {
  const prodi = await prodiParam(props.params)
  const searchParams = await props.searchParams
  const supabase = await createClient()

  // Everything that doesn't depend on the academic year starts at once.
  const [{ data: academicYears }, settings, { data: courses }, { data: lecturers }, { data: rooms }, { data: sessions }, role] = await Promise.all([
    supabase.from('academic_years').select(YEAR_COLUMNS).order('id', { ascending: false }),
    getSettings(prodi),
    supabase.from('courses').select('kode_mk, nama_mk, sks, jenis_mk, smt, kurikulum').eq('prodi', prodi).order('kode_mk'),
    supabase.from('lecturers').select(LECTURER_COLUMNS).order('nama'),
    supabase.from('rooms').select('id, nama, kapasitas, keterangan, active').eq('active', true).order('nama'),
    supabase.from('sessions').select('id, hari, sesi_ke, jam_mulai, jam_selesai, sks, active').eq('prodi', prodi).order('hari').order('sesi_ke'),
    getCurrentRole(),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''

  const context: KuliahContext = {
    prodi,
    academic_year_id: (searchParams.ay as string) || defaultYear,
    jenis_kelas: parseJenisKelas(prodi, searchParams.jenis),
    semester_ke: clampSemester(prodi, searchParams.smt),
  }

  // The findings bar (a whole-year scan of both prodi) streams in after the table: not awaited here.
  const findings = checkKuliahFindings(context.academic_year_id, prodi)
  const schedules = await fetchSchedulesForContext(context)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/kuliah" prodi={prodi} />
      <PenjadwalanClient
        academicYears={years}
        courses={(courses as Course[]) ?? []}
        lecturers={(lecturers as Lecturer[]) ?? []}
        rooms={(rooms as Room[]) ?? []}
        sessions={(sessions as SessionRow[]) ?? []}
        schedules={schedules}
        findings={findings}
        kelasOptions={classLetters(settingText(settings, 'kelas_maksimal', 'Z'))}
        maksMahasiswaPerKelas={settingInt(settings, 'maks_mahasiswa_per_kelas', 50)}
        minMahasiswaPilihan={settingInt(settings, 'min_mahasiswa_pilihan', 10)}
        context={context}
        canEdit={canWrite(role)}
      />
    </div>
  )
}
