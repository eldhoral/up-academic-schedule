'use client' // Error boundaries must be Client Components

import Link from 'next/link'
import { useEffect } from 'react'
import { HalamanGagal, TOMBOL_KEDUA, TOMBOL_UTAMA } from '@/components/HalamanGagal'

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <HalamanGagal kode="Galat" judul="Halaman ini gagal dimuat">
      <p className="m-0 mt-[0.6rem] text-[0.93rem] text-[var(--tinta-2)] text-pretty">
        Biasanya karena koneksi terputus sebentar. Coba lagi; data yang sudah tersimpan tidak hilang.
      </p>
      {error.digest && (
        <p className="m-0 mt-[0.6rem] text-[0.8rem] text-[var(--tinta-3)]">
          Jika terus terjadi, kirim kode ini ke administrator: <span className="mono">{error.digest}</span>
        </p>
      )}
      <div className="mt-[1.2rem] flex flex-wrap gap-[0.5rem]">
        <button type="button" onClick={() => retry()} className={TOMBOL_UTAMA}>Coba lagi</button>
        <Link href="/" className={TOMBOL_KEDUA}>Kembali ke Beranda</Link>
      </div>
    </HalamanGagal>
  )
}
