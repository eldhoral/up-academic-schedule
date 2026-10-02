import { AppHeader } from '@/components/AppHeader'
import { buildUjianCetakData } from './ujian-cetak-data'
import { UjianCetakClient } from './UjianCetakClient'

export default async function UjianCetakPage(props: PageProps<'/ujian/cetak'>) {
  const searchParams = await props.searchParams
  const data = await buildUjianCetakData({
    ay: searchParams.ay as string | undefined,
    ujian: searchParams.ujian as string | undefined,
    jenis: searchParams.jenis as string | undefined,
    smt: searchParams.smt as string | undefined,
  })

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/ujian/cetak" />
      <UjianCetakClient
        academicYears={data.academicYears}
        context={data.context}
        sheets={data.sheets}
        doc={{ namaPenandatangan: data.namaPenandatangan, jabatanPenandatangan: data.jabatanPenandatangan }}
      />
    </div>
  )
}
