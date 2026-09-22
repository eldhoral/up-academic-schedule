import { NextRequest, NextResponse } from 'next/server'
import { checkAllClashes } from '@/app/clash-actions'

export async function GET(request: NextRequest) {
  const academicYearId = request.nextUrl.searchParams.get('ay') ?? ''
  const clashes = await checkAllClashes(academicYearId)
  return NextResponse.json(clashes)
}
