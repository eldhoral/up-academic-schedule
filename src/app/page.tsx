import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { getSettings, settingInt, settingText } from '@/lib/settings'
import { PenjadwalanClient } from './PenjadwalanClient'
import { fetchSchedulesForContext } from './schedule-query'
import { checkAllClashes } from './clash-actions'
import type { AcademicYear, Course, Lecturer, Room, SessionRow } from './penjadwalan-types'

function classLetters(maxLetter: string): string[] {
  const max = /^[A-Z]$/.test(maxLetter) ? maxLetter : 'Z'
  const letters: string[] = []
  for (let code = 'A'.charCodeAt(0); code <= max.charCodeAt(0); code++) {
    letters.push(String.fromCharCode(code))
  }
  return letters
}

export default async function DashboardPage(props: PageProps<'/'>) {
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const [{ data: academicYears }, settings] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    getSettings(),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''

  const context = {
    academic_year_id: (searchParams.ay as string) || defaultYear,
    jenis_kelas: ((searchParams.jenis as string) === 'regsus' ? 'regsus' : 'reguler') as 'reguler' | 'regsus',
    semester_ke: parseInt((searchParams.smt as string) || '1', 10) || 1,
  }

  const [{ data: courses }, { data: lecturers }, { data: rooms }, { data: sessions }, schedules, clashes] =
    await Promise.all([
      supabase.from('courses').select('*').order('kode_mk'),
      supabase.from('lecturers').select('*').order('nama'),
      supabase.from('rooms').select('*').eq('active', true).order('nama'),
      supabase.from('sessions').select('*').order('hari').order('sesi_ke'),
      fetchSchedulesForContext(context),
      checkAllClashes(context.academic_year_id),
    ])

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/" />
      <PenjadwalanClient
        academicYears={years}
        courses={(courses as Course[]) ?? []}
        lecturers={(lecturers as Lecturer[]) ?? []}
        rooms={(rooms as Room[]) ?? []}
        sessions={(sessions as SessionRow[]) ?? []}
        schedules={schedules}
        clashes={clashes}
        kelasOptions={classLetters(settingText(settings, 'kelas_maksimal', 'Z'))}
        defaultZoomId={settingText(settings, 'zoom_id', '')}
        maksMahasiswaPerKelas={settingInt(settings, 'maks_mahasiswa_per_kelas', 50)}
        minMahasiswaPilihan={settingInt(settings, 'min_mahasiswa_pilihan', 10)}
        context={context}
      />
    </div>
  )
}
