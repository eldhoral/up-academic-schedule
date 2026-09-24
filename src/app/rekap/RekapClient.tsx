'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import { lecturerDisplayName } from '@/lib/import/tables'
import type { AcademicYear, Lecturer } from '../penjadwalan-types'

export function RekapClient({
  academicYears,
  lecturers,
  academicYearId,
  selectedDosen,
}: {
  academicYears: AcademicYear[]
  lecturers: Lecturer[]
  academicYearId: string
  selectedDosen: string // kode_dosen, or 'all'
}) {
  const router = useRouter()
  const [showPreview, setShowPreview] = useState(false)

  function navigate(next: { ay?: string; dosen?: string }) {
    const params = new URLSearchParams({
      ay: next.ay ?? academicYearId,
      dosen: next.dosen ?? selectedDosen,
    })
    setShowPreview(false)
    router.push(`/rekap?${params.toString()}`)
  }

  const query = new URLSearchParams({ ay: academicYearId, dosen: selectedDosen }).toString()
  const xlsxUrl = `/rekap/xlsx?${query}`
  const pdfUrl = `/rekap/pdf?${query}`

  return (
    <div className="flex flex-col flex-1">
      <div className="min-h-[3.2rem] flex items-center gap-[0.53rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)] flex-wrap">
        <label className="text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-ay">
          Tahun akademik
        </label>
        <Select
          id="ctx-ay"
          value={academicYearId}
          onValueChange={(v) => navigate({ ay: v })}
          options={academicYears.map((ay) => ({ value: ay.id, label: ay.label }))}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-dosen">
          Dosen
        </label>
        <Select
          id="ctx-dosen"
          value={selectedDosen}
          onValueChange={(v) => navigate({ dosen: v })}
          options={[
            { value: 'all', label: `Semua dosen (${lecturers.length})` },
            ...lecturers.map((l) => ({ value: l.kode_dosen, label: lecturerDisplayName(l) })),
          ]}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem] max-w-[18rem]"
        />

        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="ml-auto inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] bg-[var(--cekung)] font-medium cursor-pointer hover:bg-[var(--lembar)] active:scale-[0.97] transition-colors text-[0.93rem]"
        >
          Lihat Pratinjau PDF
        </button>

        <a
          href={xlsxUrl}
          className="inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors text-[0.93rem]"
        >
          Unduh Excel
        </a>
      </div>

      {showPreview && <iframe key={pdfUrl} src={pdfUrl} title="Pratinjau Surat Penugasan" className="flex-1 w-full border-0" />}
    </div>
  )
}
