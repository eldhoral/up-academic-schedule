'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { renderAsync } from 'docx-preview'
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

  function navigate(next: { ay?: string; dosen?: string }) {
    const params = new URLSearchParams({
      ay: next.ay ?? academicYearId,
      dosen: next.dosen ?? selectedDosen,
    })
    router.push(`/rekap?${params.toString()}`)
  }

  const query = new URLSearchParams({ ay: academicYearId, dosen: selectedDosen }).toString()
  const docxUrl = `/rekap/docx?${query}`

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

        <a
          href={docxUrl}
          className="ml-auto inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors text-[0.93rem]"
        >
          Unduh Word
        </a>
      </div>

      <DocxPreview key={docxUrl} url={docxUrl} />
    </div>
  )
}

function DocxPreview({ url }: { url: string }) {
  const previewRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        return res.blob()
      })
      .then((blob) => {
        if (cancelled || !previewRef.current) return
        // experimental: computes tab stops, which the Nomor/date line relies on.
        return renderAsync(blob, previewRef.current, undefined, { experimental: true })
      })
      .then(() => {
        // docx-preview's floating-image support is rough; patch the kop logo to sit
        // where Word puts it: top-aligned (a baseline 0x0 inline-block stretches the
        // line), offset from the column rather than the indented text start, and
        // behind the text (multiply lets black text show through).
        previewRef.current?.querySelectorAll<HTMLElement>('header div[style*="position: relative"]').forEach((el) => {
          const indent = el.closest('p')?.style.textIndent || '0px'
          el.style.verticalAlign = 'top'
          el.style.left = `calc(${el.style.left || '0px'} - ${indent})`
          el.style.mixBlendMode = 'multiply'
        })
        if (!cancelled) setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <>
      {status === 'error' && <p className="text-center text-[0.93rem] text-[var(--merah)] py-[2rem]">Gagal memuat pratinjau.</p>}
      <div ref={previewRef} className="flex-1 overflow-auto bg-[var(--kertas)] py-[1rem]" />
    </>
  )
}
