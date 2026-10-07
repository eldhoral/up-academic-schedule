import { AppHeader } from '@/components/AppHeader'
import { prodiParam } from '@/lib/prodi-server'
import { buildUjianCetakData } from './ujian-cetak-data'
import { UjianCetakClient } from './UjianCetakClient'

export default async function UjianCetakPage(props: PageProps<'/[prodi]/ujian/cetak'>) {
  const prodi = await prodiParam(props.params)
  const searchParams = await props.searchParams
  const data = await buildUjianCetakData(prodi, {
    ay: searchParams.ay as string | undefined,
    ujian: searchParams.ujian as string | undefined,
    jenis: searchParams.jenis as string | undefined,
    smt: searchParams.smt as string | undefined,
    dosen: searchParams.dosen as string | undefined,
  })

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/ujian/cetak" prodi={prodi} />
      <UjianCetakClient
        academicYears={data.academicYears}
        context={{ ...data.context, dosen: data.dosen?.value ?? '' }}
        dosenOptions={data.dosenOptions}
        sheets={data.sheets}
        doc={{ namaPenandatangan: data.namaPenandatangan, jabatanPenandatangan: data.jabatanPenandatangan }}
      />
    </div>
  )
}
