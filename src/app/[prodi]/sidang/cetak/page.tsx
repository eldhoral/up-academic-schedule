import { AppShell } from '@/components/AppShell'
import { prodiParam } from '@/lib/prodi-server'
import { buildSidangCetakData } from './sidang-cetak-data'
import { SidangCetakClient } from './SidangCetakClient'

export default async function SidangCetakPage(props: PageProps<'/[prodi]/sidang/cetak'>) {
  const prodi = await prodiParam(props.params)
  const searchParams = await props.searchParams
  const data = await buildSidangCetakData(prodi, {
    ay: searchParams.ay as string | undefined,
    jenis: searchParams.jenis as string | undefined,
    tanggal: searchParams.tanggal as string | undefined,
  })

  return (
    <AppShell active="/sidang/cetak" prodi={prodi}>
      <SidangCetakClient
        academicYears={data.academicYears}
        context={data.context}
        dates={data.dates}
        sheets={data.sheets}
        doc={{
          zoomId: data.zoomId,
          zoomPasscode: data.zoomPasscode,
          namaWakilDekan: data.namaWakilDekan,
          jabatanWakilDekan: data.jabatanWakilDekan,
          namaPenandatangan: data.namaPenandatangan,
          jabatanPenandatangan: data.jabatanPenandatangan,
        }}
      />
    </AppShell>
  )
}
