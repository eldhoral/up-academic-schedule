'use client'

import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import { DownloadButtons } from '@/components/DownloadButtons'
import { EmptySheet } from '@/components/EmptySheet'
import { CetakPreview, type CetakDoc, type PreviewSheet } from './CetakPreview'
import type { AcademicYear, KuliahContext } from '../penjadwalan-types'
import { useProdi } from '@/lib/use-prodi'
import { PRODI_CONFIG, semesterList, type JenisKelas } from '@/lib/prodi'

export function CetakClient({
  academicYears,
  context,
  hasSchedules,
  sheets,
  doc,
}: {
  academicYears: AcademicYear[]
  context: Omit<KuliahContext, 'semester_ke'> & { semester_ke: number | 'all' }
  hasSchedules: boolean
  sheets: PreviewSheet[]
  doc: CetakDoc
}) {
  const prodi = useProdi()
  const router = useRouter()

  function navigate(next: Partial<typeof context>) {
    const merged = { ...context, ...next }
    const params = new URLSearchParams({
      ay: merged.academic_year_id,
      jenis: merged.jenis_kelas,
      smt: String(merged.semester_ke),
    })
    router.push(`/${prodi}/kuliah/cetak?${params.toString()}`)
  }

  const query = new URLSearchParams({
    ay: context.academic_year_id,
    jenis: context.jenis_kelas,
    smt: String(context.semester_ke),
  }).toString()
  const xlsxUrl = `/${prodi}/kuliah/cetak/xlsx?${query}`

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
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        {PRODI_CONFIG[prodi].jenisKelas.length > 1 && (
          <>
            <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-jenis">
              Jenis Kelas
            </label>
            <Select
              id="ctx-jenis"
              value={context.jenis_kelas}
              onValueChange={(v) => navigate({ jenis_kelas: v as JenisKelas })}
              options={[
                { value: 'reguler', label: 'Reguler' },
                { value: 'regsus', label: 'Reguler Khusus' },
              ]}
              className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
            />
          </>
        )}

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-smt">
          Semester
        </label>
        <Select
          id="ctx-smt"
          value={String(context.semester_ke)}
          onValueChange={(v) => navigate({ semester_ke: v === 'all' ? 'all' : parseInt(v, 10) })}
          options={[
            { value: 'all', label: 'Semua semester' },
            ...semesterList(prodi).map((s) => ({ value: String(s), label: String(s) })),
          ]}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        <DownloadButtons
          enabled={hasSchedules}
          xlsxUrl={xlsxUrl}
          pdfUrl={`/${prodi}/kuliah/cetak/pdf?${query}`}
          pdfFallbackName="Jadwal Perkuliahan.pdf"
        />
      </div>

      {hasSchedules ? (
        <CetakPreview sheets={sheets} doc={doc} prodi={prodi} />
      ) : (
        <EmptySheet
          title="Belum ada jadwal untuk dicetak"
          detail={`${context.semester_ke === 'all' ? 'Semua semester' : `Semester ${context.semester_ke}`} · ${PRODI_CONFIG[prodi].jenisKelas.length > 1 ? `${context.jenis_kelas === 'reguler' ? 'Reguler' : 'Reguler Khusus'} · ` : ''}${
            academicYears.find((ay) => ay.id === context.academic_year_id)?.label ?? ''
          } belum memiliki jadwal.`}
          // Penjadwalan works one semester at a time; "Semua semester" opens its default.
          actionHref={`/${prodi}/kuliah?${context.semester_ke === 'all' ? new URLSearchParams({ ay: context.academic_year_id, jenis: context.jenis_kelas }) : query}`}
          actionLabel="Buka Penjadwalan"
        />
      )}
    </div>
  )
}
