import { notFound } from 'next/navigation'
import { prodiParam } from '@/lib/prodi-server'
import { BAGIAN_PENGATURAN } from '@/lib/pengaturan-bagian'
import { PengaturanView } from '../PengaturanView'

// /pengaturan/penilaian is its own static route and wins over this one.
export default async function PengaturanBagianPage(props: PageProps<'/[prodi]/pengaturan/[bagian]'>) {
  const { bagian: slug } = await props.params
  const bagian = BAGIAN_PENGATURAN.find((b) => b.slug && b.slug === slug)
  if (!bagian) notFound()
  return <PengaturanView prodi={await prodiParam(props.params)} bagian={bagian} />
}
