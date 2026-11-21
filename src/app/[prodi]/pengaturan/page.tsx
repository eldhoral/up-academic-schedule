import { prodiParam } from '@/lib/prodi-server'
import { BAGIAN_PENGATURAN } from '@/lib/pengaturan-bagian'
import { PengaturanView } from './PengaturanView'

export default async function PengaturanPage(props: PageProps<'/[prodi]/pengaturan'>) {
  return <PengaturanView prodi={await prodiParam(props.params)} bagian={BAGIAN_PENGATURAN[0]} />
}
