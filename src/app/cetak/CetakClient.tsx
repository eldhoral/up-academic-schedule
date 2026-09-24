'use client'

import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import type { AcademicYear } from '../penjadwalan-types'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

export function CetakClient({
  academicYears,
  context,
}: {
  academicYears: AcademicYear[]
  context: { academic_year_id: string; jenis_kelas: 'reguler' | 'regsus'; semester_ke: number }
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

  const pdfUrl = `/cetak/pdf?${new URLSearchParams({
    ay: context.academic_year_id,
    jenis: context.jenis_kelas,
    smt: String(context.semester_ke),
  }).toString()}`

  return (
    <div className="flex flex-col flex-1">
      <div className="no-print min-h-[3.2rem] flex items-center gap-[0.53rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)] flex-wrap">
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
          onValueChange={(v) => navigate({ semester_ke: parseInt(v, 10) })}
          options={SEMESTERS.map((s) => ({ value: String(s), label: String(s) }))}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener"
          className="ml-auto inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors text-[0.93rem]"
        >
          Buka PDF
        </a>
      </div>

      <iframe key={pdfUrl} src={pdfUrl} title="Pratinjau Jadwal" className="flex-1 w-full border-0" />
    </div>
  )
}
