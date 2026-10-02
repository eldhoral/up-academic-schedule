import { AppHeader } from '@/components/AppHeader'
import { buildCetakData } from './cetak-data'
import { CetakClient } from './CetakClient'
import { groupSchedulesByKelas } from './schedule-rows'

export default async function CetakPage(props: PageProps<'/kuliah/cetak'>) {
  const searchParams = await props.searchParams
  const data = await buildCetakData({
    ay: searchParams.ay as string | undefined,
    jenis: searchParams.jenis as string | undefined,
    smt: searchParams.smt as string | undefined,
  })

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <div className="no-print">
        <AppHeader active="/kuliah/cetak" />
      </div>
      <CetakClient
        academicYears={data.academicYears}
        context={data.context}
        hasSchedules={data.sheets.some((s) => s.schedules.length > 0)}
        sheets={data.sheets.map(({ name, semester, angkatan, headerLines, schedules }) => ({
          name,
          semester,
          angkatan,
          headerLines,
          groups: groupSchedulesByKelas(schedules),
        }))}
        doc={{
          zoomId: data.zoomId,
          zoomPasscode: data.zoomPasscode,
          keteranganLines: data.keteranganLines,
          namaPenandatangan: data.namaPenandatangan,
          jabatanPenandatangan: data.jabatanPenandatangan,
          hasTandaTangan: Boolean(data.gambarTandaTangan),
          ukuranKertas: data.ukuranKertas,
          orientasi: data.orientasi,
        }}
      />
    </div>
  )
}
