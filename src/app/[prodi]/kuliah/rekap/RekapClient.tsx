'use client'

import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import { EmptySheet } from '@/components/EmptySheet'
import { RekapIndex, RekapLetter, type IndexRow, type LetterView, type SuratFacts } from './RekapPreview'
import { lecturerDisplayName } from '@/lib/import/tables'
import type { AcademicYear, Lecturer } from '../penjadwalan-types'
import { useProdi } from '@/lib/use-prodi'

export function RekapClient({
  academicYears,
  lecturers,
  academicYearId,
  selectedDosen,
  hasLetters,
  index,
  letter,
  facts,
}: {
  academicYears: AcademicYear[]
  lecturers: Lecturer[]
  academicYearId: string
  selectedDosen: string // kode_dosen, or 'all'
  hasLetters: boolean
  index: IndexRow[]
  letter: LetterView | null // null = "Semua dosen" overview
  facts: SuratFacts
}) {
  const prodi = useProdi()
  const router = useRouter()

  function navigate(next: { ay?: string; dosen?: string }) {
    const params = new URLSearchParams({
      ay: next.ay ?? academicYearId,
      dosen: next.dosen ?? selectedDosen,
    })
    router.push(`/${prodi}/kuliah/rekap?${params.toString()}`)
  }

  const query = new URLSearchParams({ ay: academicYearId, dosen: selectedDosen }).toString()
  const docxUrl = `/${prodi}/kuliah/rekap/docx?${query}`
  const yearLabel = academicYears.find((ay) => ay.id === academicYearId)?.label ?? ''
  const selectedLecturer = lecturers.find((l) => l.kode_dosen === selectedDosen)
  const dosenLabel = selectedLecturer ? lecturerDisplayName(selectedLecturer) : 'Dosen ini'

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

        {hasLetters ? (
          <a
            href={docxUrl}
            className="ml-auto inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors text-[0.93rem]"
          >
            Unduh Word
          </a>
        ) : (
          <span
            aria-disabled="true"
            title="Belum ada jadwal untuk diunduh"
            className="ml-auto inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru-disabled)] text-white font-medium cursor-not-allowed text-[0.93rem]"
          >
            Unduh Word
          </span>
        )}
      </div>

      {hasLetters ? (
        letter ? (
          <RekapLetter letter={letter} ay={academicYearId} facts={facts} prodi={prodi} />
        ) : (
          <RekapIndex rows={index} ay={academicYearId} facts={facts} prodi={prodi} />
        )
      ) : (
        <EmptySheet
          {...(selectedDosen === 'all'
            ? {
                title: 'Belum ada dosen untuk direkap',
                detail: `Tahun akademik ${yearLabel} belum memiliki jadwal mengajar.`,
              }
            : {
                title: 'Belum ada jadwal untuk direkap',
                detail: `${dosenLabel} belum memiliki jadwal mengajar di tahun akademik ${yearLabel}.`,
              })}
          actionHref={`/${prodi}/kuliah?${new URLSearchParams({ ay: academicYearId }).toString()}`}
          actionLabel="Buka Penjadwalan"
        />
      )}
    </div>
  )
}
