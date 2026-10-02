import { AppHeader } from '@/components/AppHeader'
import { canWrite, getCurrentRole } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { getSettings, settingText } from '@/lib/settings'
import { lecturerDisplayName } from '@/lib/import/tables'
import { parseSesiList } from '../ujian/exam-types'
import { checkAllDefenseClashes } from './actions'
import { fetchDefenses, fetchExternalNames } from './defense-query'
import type { DefenseContext } from './defense-types'
import { SidangClient } from './SidangClient'
import type { AcademicYear, Lecturer, Room } from '../kuliah/penjadwalan-types'

export default async function SidangPage(props: PageProps<'/sidang'>) {
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const [{ data: academicYears }, { data: lecturers }, { data: rooms }, settings, role, externalNames] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    supabase.from('lecturers').select('*').order('nama'),
    supabase.from('rooms').select('*').eq('active', true).order('nama'),
    getSettings(),
    getCurrentRole(),
    fetchExternalNames(),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''
  const context: DefenseContext = {
    academic_year_id: (searchParams.ay as string) || defaultYear,
    jenis: (searchParams.jenis as string) === 'sidang' ? 'sidang' : 'prasidang',
  }
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test((searchParams.tanggal as string) ?? '') ? (searchParams.tanggal as string) : null

  const [defenses, findings] = await Promise.all([fetchDefenses(context.academic_year_id, context.jenis), checkAllDefenseClashes(context.academic_year_id)])

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/sidang" />
      <SidangClient
        // A new context (year, jenis) starts the board's local state fresh.
        key={`${context.academic_year_id}-${context.jenis}`}
        academicYears={years}
        context={context}
        defenses={defenses}
        findings={findings}
        lecturers={((lecturers as Lecturer[]) ?? []).map((l) => ({ value: l.kode_dosen, label: lecturerDisplayName(l) }))}
        rooms={((rooms as Room[]) ?? []).map((r) => ({ value: r.id, label: r.nama }))}
        sesi={parseSesiList(settingText(settings, context.jenis === 'sidang' ? 'sesi_sidang' : 'sesi_prasidang'))}
        externalNames={externalNames}
        initialTanggal={tanggal}
        canEdit={canWrite(role)}
      />
    </div>
  )
}
