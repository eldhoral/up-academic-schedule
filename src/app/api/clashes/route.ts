import { NextRequest, NextResponse } from 'next/server'
import { checkKuliahFindings } from '@/app/[prodi]/kuliah/clash-actions'
import { parseProdi } from '@/lib/prodi'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const findings = await checkKuliahFindings(params.get('ay') ?? '', parseProdi(params.get('prodi')) ?? 's1')
  return NextResponse.json(findings)
}
