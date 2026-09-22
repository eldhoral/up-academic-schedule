import { NextRequest, NextResponse } from 'next/server'
import { fetchSchedulesForContext } from '@/app/schedule-query'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const schedules = await fetchSchedulesForContext({
    academic_year_id: params.get('ay') ?? '',
    jenis_kelas: params.get('jenis') === 'regsus' ? 'regsus' : 'reguler',
    semester_ke: parseInt(params.get('smt') ?? '1', 10) || 1,
  })
  return NextResponse.json(schedules)
}
