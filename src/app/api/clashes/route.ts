import { NextRequest, NextResponse } from 'next/server'
import { checkAllClashes } from '@/app/[prodi]/kuliah/clash-actions'
import { parseProdi } from '@/lib/prodi'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const clashes = await checkAllClashes(params.get('ay') ?? '', parseProdi(params.get('prodi')) ?? 's1')
  return NextResponse.json(clashes)
}
