import { AppHeader } from '@/components/AppHeader'
import { prodiParam } from '@/lib/prodi-server'
import { canWrite, getCurrentRole } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { getSettings, settingText } from '@/lib/settings'
import { lecturerDisplayName } from '@/lib/import/tables'
import { parseSesiList } from '../ujian/exam-types'
import { checkAllDefenseClashes } from './actions'
import { fetchDefenses, fetchExternalNames } from './defense-query'
import type { DefenseContext, Student } from './defense-types'
import { SidangClient } from './SidangClient'
import type { AcademicYear, Lecturer, Room } from '../kuliah/penjadwalan-types'

export default async function SidangPage(props: PageProps<'/[prodi]/sidang'>) {
  const prodi = await prodiParam(props.params)
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const [{ data: academicYears }, { data: lecturers }, { data: rooms }, { data: students }, settings, role, externalNames] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    supabase.from('lecturers').select('*').order('nama'),
    supabase.from('rooms').select('*').eq('active', true).order('nama'),
    supabase.from('students').select('npm, nama, judul_skripsi').eq('prodi', prodi).order('npm'),
    getSettings(prodi),
    getCurrentRole(),
    fetchExternalNames(),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''
  const context: DefenseContext = {
    prodi,
    academic_year_id: (searchParams.ay as string) || defaultYear,
    jenis: (searchParams.jenis as string) === 'sidang' ? 'sidang' : 'prasidang',
  }
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test((searchParams.tanggal as string) ?? '') ? (searchParams.tanggal as string) : null

  const [defenses, findings] = await Promise.all([fetchDefenses(context.academic_year_id, context.jenis, prodi), checkAllDefenseClashes(context.academic_year_id, prodi)])

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/sidang" prodi={prodi} />
      <SidangClient
        // A new context (year, jenis) starts the board's local state fresh.
        key={`${prodi}-${context.academic_year_id}-${context.jenis}`}
        academicYears={years}
        context={context}
        defenses={defenses}
        findings={findings}
        lecturers={((lecturers as Lecturer[]) ?? []).map((l) => ({ value: l.kode_dosen, label: lecturerDisplayName(l) }))}
        rooms={((rooms as Room[]) ?? []).map((r) => ({ value: r.id, label: r.nama }))}
        sesi={parseSesiList(settingText(settings, context.jenis === 'sidang' ? 'sesi_sidang' : 'sesi_prasidang'))}
        externalNames={externalNames}
        students={(students as Student[]) ?? []}
        initialTanggal={tanggal}
        canEdit={canWrite(role)}
      />
    </div>
  )
}
