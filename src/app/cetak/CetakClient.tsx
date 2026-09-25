'use client'

import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import { EmptySheet } from '@/components/EmptySheet'
import type { AcademicYear } from '../penjadwalan-types'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

export function CetakClient({
  academicYears,
  context,
  hasSchedules,
}: {
  academicYears: AcademicYear[]
  context: { academic_year_id: string; jenis_kelas: 'reguler' | 'regsus'; semester_ke: number | 'all' }
  hasSchedules: boolean
}) {
  const router = useRouter()

  function navigate(next: Partial<typeof context>) {
    const merged = { ...context, ...next }
    const params = new URLSearchParams({
      ay: merged.academic_year_id,
      jenis: merged.jenis_kelas,
      smt: String(merged.semester_ke),
    })
    router.push(`/cetak?${params.toString()}`)
  }

  const query = new URLSearchParams({
    ay: context.academic_year_id,
    jenis: context.jenis_kelas,
    smt: String(context.semester_ke),
  }).toString()
  const xlsxUrl = `/cetak/xlsx?${query}`
  const pdfUrl = `/cetak/pdf?${query}`

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

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-jenis">
          Jenis Kelas
        </label>
        <Select
          id="ctx-jenis"
          value={context.jenis_kelas}
          onValueChange={(v) => navigate({ jenis_kelas: v as 'reguler' | 'regsus' })}
          options={[
            { value: 'reguler', label: 'Reguler' },
            { value: 'regsus', label: 'Reguler Khusus' },
          ]}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-smt">
          Semester
        </label>
        <Select
          id="ctx-smt"
          value={String(context.semester_ke)}
          onValueChange={(v) => navigate({ semester_ke: v === 'all' ? 'all' : parseInt(v, 10) })}
          options={[
            { value: 'all', label: 'Semua semester' },
            ...SEMESTERS.map((s) => ({ value: String(s), label: String(s) })),
          ]}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        {hasSchedules ? (
          <a
            href={xlsxUrl}
            className="ml-auto inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors text-[0.93rem]"
          >
            Unduh Excel
          </a>
        ) : (
          <span
            aria-disabled="true"
            title="Belum ada jadwal untuk diunduh"
            className="ml-auto inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru-disabled)] text-white font-medium cursor-not-allowed text-[0.93rem]"
          >
            Unduh Excel
          </span>
        )}
      </div>

      {hasSchedules ? (
        <iframe key={pdfUrl} src={pdfUrl} title="Pratinjau Jadwal" className="flex-1 w-full border-0" />
      ) : (
        <EmptySheet
          title="Belum ada jadwal untuk dicetak"
          detail={`${context.semester_ke === 'all' ? 'Semua semester' : `Semester ${context.semester_ke}`} · ${context.jenis_kelas === 'reguler' ? 'Reguler' : 'Reguler Khusus'} · ${
            academicYears.find((ay) => ay.id === context.academic_year_id)?.label ?? ''
          } belum memiliki jadwal.`}
          // Penjadwalan works one semester at a time; "Semua semester" opens its default.
          actionHref={`/?${context.semester_ke === 'all' ? new URLSearchParams({ ay: context.academic_year_id, jenis: context.jenis_kelas }) : query}`}
          actionLabel="Buka Penjadwalan"
        />
      )}
    </div>
  )
}
