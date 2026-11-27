import Link from 'next/link'
import { HalamanGagal, TOMBOL_UTAMA } from '@/components/HalamanGagal'

export default function NotFound() {
  return (
    <HalamanGagal kode="404" judul="Halaman tidak ditemukan">
      <p className="m-0 mt-[0.6rem] text-[0.93rem] text-[var(--tinta-2)] text-pretty">
        Alamatnya mungkin salah ketik, atau halamannya sudah dipindah. Mulai lagi dari Beranda.
      </p>
      <div className="mt-[1.2rem]">
        <Link href="/" className={TOMBOL_UTAMA}>Kembali ke Beranda</Link>
      </div>
    </HalamanGagal>
  )
}
