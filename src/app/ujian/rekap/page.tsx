import { AppHeader } from '@/components/AppHeader'
import { buildRekapPengawasData } from './rekap-pengawas-data'
import { RekapPengawasClient } from './RekapPengawasClient'

export default async function RekapPengawasPage(props: PageProps<'/ujian/rekap'>) {
  const searchParams = await props.searchParams
  const data = await buildRekapPengawasData({ ay: searchParams.ay as string | undefined, ujian: searchParams.ujian as string | undefined, pengawas: searchParams.pengawas as string | undefined })

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/ujian/rekap" />
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
