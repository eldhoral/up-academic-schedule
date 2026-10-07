import { NextRequest, NextResponse } from 'next/server'
import { fetchSchedulesForContext } from '@/app/[prodi]/kuliah/schedule-query'
import { clampSemester, parseJenisKelas, parseProdi } from '@/lib/prodi'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const prodi = parseProdi(params.get('prodi')) ?? 's1'
  const schedules = await fetchSchedulesForContext({
    prodi,
    academic_year_id: params.get('ay') ?? '',
    jenis_kelas: parseJenisKelas(prodi, params.get('jenis')),
    semester_ke: clampSemester(prodi, params.get('smt')),
  })
  return NextResponse.json(schedules)
}
