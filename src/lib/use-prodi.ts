'use client'

import { useParams } from 'next/navigation'
import { parseProdi, type Prodi } from '@/lib/prodi'

/** The prodi of the page being viewed, from the /[prodi]/ segment. Only used under src/app/[prodi]/. */
export function useProdi(): Prodi {
  const { prodi } = useParams<{ prodi: string }>()
  return parseProdi(prodi) ?? 's1'
}
