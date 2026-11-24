import { AppHeader } from '@/components/AppHeader'
import { prodiParam } from '@/lib/prodi-server'
import { buildRekapPengawasData } from './rekap-pengawas-data'
import { RekapPengawasClient } from './RekapPengawasClient'

export default async function RekapPengawasPage(props: PageProps<'/[prodi]/ujian/rekap'>) {
  const prodi = await prodiParam(props.params)
  const searchParams = await props.searchParams
  const data = await buildRekapPengawasData(prodi, { ay: searchParams.ay as string | undefined, ujian: searchParams.ujian as string | undefined, pengawas: searchParams.pengawas as string | undefined })

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/ujian/rekap" prodi={prodi} />
      <RekapPengawasClient
        academicYears={data.academicYears}
        context={{ ...data.context, pengawas: data.pengawas }}
        pengawasOptions={data.pengawasOptions}
        groups={data.groups}
        totalTugas={data.totalTugas}
        headerLines={data.headerLines}
        doc={{ namaPenandatangan: data.namaPenandatangan, jabatanPenandatangan: data.jabatanPenandatangan }}
      />
    </div>
  )
}
