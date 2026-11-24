import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { todayJakarta } from '@/lib/penilaian/akses'
import { publicOrigin } from '../events'
import { loadJadwalDosen } from '../jadwal-data'
import { TampilanJadwal } from '../TampilanJadwal'

export const metadata: Metadata = { title: 'Jadwal Dosen', robots: { index: false, follow: false } }

export default async function JadwalDosenPage(props: PageProps<'/jadwal-dosen/[token]'>) {
  const { token } = await props.params
  const jadwal = await loadJadwalDosen(token)
  if (!jadwal) notFound()
  const host = publicOrigin(await headers()).replace(/^[a-z]+:\/\//, '')
  return <TampilanJadwal jadwal={jadwal} today={todayJakarta()} host={host} feedPath={`/jadwal-dosen/${token}/kalender.ics`} />
}
