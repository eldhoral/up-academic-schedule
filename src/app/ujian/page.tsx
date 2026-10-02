import { AppHeader } from '@/components/AppHeader'
import { canWrite, getCurrentRole } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { getSettings, settingList, settingText } from '@/lib/settings'
import { lecturerDisplayName } from '@/lib/import/tables'
import { checkAllExamClashes } from './actions'
import { fetchExamPage } from './exam-query'
import { normalizeName } from './exam-clash'
import { parseSesiList, type ExamContext } from './exam-types'
import { UjianClient } from './UjianClient'
import type { AcademicYear, Lecturer, Room } from '../kuliah/penjadwalan-types'

export default async function UjianPage(props: PageProps<'/ujian'>) {
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const [{ data: academicYears }, { data: lecturers }, { data: rooms }, settings, role] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    supabase.from('lecturers').select('*').order('nama'),
    supabase.from('rooms').select('*').eq('active', true).order('nama'),
    getSettings(),
    getCurrentRole(),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''
  const context: ExamContext = {
    academic_year_id: (searchParams.ay as string) || defaultYear,
    jenis_ujian: (searchParams.ujian as string) === 'uas' ? 'uas' : 'uts',
    jenis_kelas: (searchParams.jenis as string) === 'regsus' ? 'regsus' : 'reguler',
    semester_ke: Math.min(8, Math.max(1, parseInt((searchParams.smt as string) || '1', 10) || 1)),
  }

  const [{ exams, addable, kelasByMk }, findings] = await Promise.all([fetchExamPage(context), checkAllExamClashes(context.academic_year_id)])
  const lecturerList = (lecturers as Lecturer[]) ?? []

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/ujian" />
      <UjianClient
        academicYears={years}
        context={context}
        exams={exams}
        addable={addable}
        kelasByMk={kelasByMk}
        findings={findings}
        lecturers={lecturerList.map((l) => ({ value: l.kode_dosen, label: lecturerDisplayName(l) }))}
        rooms={((rooms as Room[]) ?? []).map((r) => ({ value: r.id, label: r.nama }))}
        sesi={parseSesiList(settingText(settings, context.jenis_kelas === 'reguler' ? 'sesi_ujian_reguler' : 'sesi_ujian_regsus'))}
        fixedNames={settingList(settings, 'pengawas_cadangan').map(normalizeName)}
        canEdit={canWrite(role)}
      />
    </div>
  )
}
