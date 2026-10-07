'use client'

import { useRouter } from 'next/navigation'
import { DownloadButtons } from '@/components/DownloadButtons'
import { EmptySheet } from '@/components/EmptySheet'
import { Select } from '@/components/Select'
import { JENIS_LABEL, tanggalSingkat, type DefenseJenis } from '../defense-types'
import { SidangCetakPreview, type SidangDoc } from './SidangCetakPreview'
import type { SidangSheet } from './sidang-cetak-data'
import type { AcademicYear } from '../../kuliah/penjadwalan-types'
import { useProdi } from '@/lib/use-prodi'

const CONTROL = 'bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]'

type Context = { academic_year_id: string; jenis: DefenseJenis; tanggal: string }

export function SidangCetakClient({
  academicYears,
  context,
  dates,
  sheets,
  doc,
}: {
  academicYears: AcademicYear[]
  context: Context
  dates: string[]
  sheets: SidangSheet[]
  doc: SidangDoc
}) {
  const prodi = useProdi()
  const router = useRouter()
  const queryOf = (c: Context) => new URLSearchParams({ ay: c.academic_year_id, jenis: c.jenis, tanggal: c.tanggal }).toString()
  const query = queryOf(context)
  const kind = JENIS_LABEL[context.jenis]
  const yearLabel = academicYears.find((ay) => ay.id === context.academic_year_id)?.label ?? ''

  function navigate(next: Partial<Context>) {
    // A different year or jenis has different dates, so go back to all of them.
    router.push(`/${prodi}/sidang/cetak?${queryOf({ ...context, tanggal: 'all', ...next })}`)
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="min-h-[3.2rem] flex items-center gap-[0.53rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)] flex-wrap">
        <label className="text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-ay">
          Tahun akademik
        </label>
        <Select
          id="ctx-ay"
          value={context.academic_year_id}
          onValueChange={(v) => navigate({ academic_year_id: v })}
          options={academicYears.map((ay) => ({ value: ay.id, label: ay.label }))}
          className={CONTROL}
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-jenis">
          Jenis
        </label>
        <Select
          id="ctx-jenis"
          value={context.jenis}
          onValueChange={(v) => navigate({ jenis: v as DefenseJenis })}
          options={[
            { value: 'prasidang', label: 'Prasidang' },
            { value: 'sidang', label: 'Sidang' },
          ]}
          className={CONTROL}
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-tanggal">
          Tanggal
        </label>
        <Select
          id="ctx-tanggal"
          value={context.tanggal}
          onValueChange={(v) => navigate({ tanggal: v })}
          options={[{ value: 'all', label: 'Semua tanggal' }, ...dates.map((d) => ({ value: d, label: tanggalSingkat(d) }))]}
          className={CONTROL}
        />

        <DownloadButtons
          enabled={sheets.length > 0}
          xlsxUrl={`/${prodi}/sidang/cetak/xlsx?${query}`}
          pdfUrl={`/${prodi}/sidang/cetak/pdf?${query}`}
          pdfFallbackName={`Jadwal ${kind}.pdf`}
        />
      </div>

      {sheets.length > 0 ? (
        <SidangCetakPreview jenis={context.jenis} sheets={sheets} doc={doc} prodi={prodi} />
      ) : (
        <EmptySheet
          title={`Belum ada jadwal ${kind.toLowerCase()} untuk dicetak`}
          detail={`${yearLabel} belum memiliki jadwal ${kind.toLowerCase()}${context.tanggal === 'all' ? '' : ` pada ${tanggalSingkat(context.tanggal)}`}.`}
          actionHref={`/${prodi}/sidang?${new URLSearchParams({ ay: context.academic_year_id, jenis: context.jenis })}`}
          actionLabel="Buka Jadwal Sidang"
        />
      )}
    </div>
  )
}
