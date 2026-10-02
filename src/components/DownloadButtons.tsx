'use client'

import { useState } from 'react'

/**
 * "Unduh PDF" + "Unduh Excel" for a print page. The PDF is an Aspose conversion that takes a
 * few seconds and can fail (free quota), so it is fetched rather than navigated to: the page
 * stays put and can say what went wrong. Disabled when there is nothing to print.
 */
export function DownloadButtons({
  enabled,
  xlsxUrl,
  pdfUrl,
  pdfFallbackName,
}: {
  enabled: boolean
  xlsxUrl: string
  pdfUrl: string
  pdfFallbackName: string
}) {
  const [pdf, setPdf] = useState<'idle' | 'busy' | 'error'>('idle')

  async function downloadPdf() {
    setPdf('busy')
    try {
      const res = await fetch(pdfUrl)
      if (!res.ok) throw new Error(String(res.status))
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = /filename="(.+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? pdfFallbackName
      a.click()
      URL.revokeObjectURL(url)
      setPdf('idle')
    } catch {
      setPdf('error')
    }
  }

  return (
    <div className="ml-auto flex items-center gap-[0.53rem] flex-wrap justify-end">
      {pdf === 'error' && (
        <span role="alert" className="text-[0.8rem] text-[var(--merah-teks)]">
          Gagal membuat PDF (kuota Aspose habis?). Coba lagi nanti.
        </span>
      )}
      {enabled ? (
        <>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={pdf === 'busy'}
            className="inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] bg-[var(--cekung)] text-[var(--tinta)] font-medium cursor-pointer hover:bg-[var(--lembar)] active:scale-[0.97] transition-colors text-[0.93rem] disabled:cursor-wait disabled:opacity-60"
          >
            {pdf === 'busy' ? 'Membuat PDF…' : 'Unduh PDF'}
          </button>
          <a
            href={xlsxUrl}
            className="inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors text-[0.93rem]"
          >
            Unduh Excel
          </a>
        </>
      ) : (
        <span
          aria-disabled="true"
          title="Belum ada jadwal untuk diunduh"
          className="inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru-disabled)] text-white font-medium cursor-not-allowed text-[0.93rem]"
        >
          Unduh Excel
        </span>
      )}
    </div>
  )
}
