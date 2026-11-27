import Image from 'next/image'

/** The frame of the 404 and error pages: the faculty logo over one quiet card, nothing else to break. */
export function HalamanGagal({ kode, judul, children }: { kode: string; judul: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-[1.067rem] py-[2.4rem]">
      <div className="w-full max-w-[26rem]">
        <Image src="/images/logo-psikologi-up.png" alt="Fakultas Psikologi Universitas Pancasila" width={800} height={176} className="w-[12rem] h-auto mb-[1.6rem]" priority />
        <div className="bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.6rem]">
          <p className="mono m-0 text-[0.8rem] text-[var(--tinta-3)]">{kode}</p>
          <h1 className="m-0 mt-[0.4rem] text-[1.33rem] font-semibold tracking-[-0.01em] text-balance">{judul}</h1>
          {children}
        </div>
      </div>
    </main>
  )
}

export const TOMBOL_UTAMA =
  'inline-flex items-center px-[0.9rem] py-[0.45rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.93rem] font-medium no-underline cursor-pointer hover:bg-[var(--biru-hover)]'
export const TOMBOL_KEDUA =
  'inline-flex items-center px-[0.9rem] py-[0.45rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] bg-[var(--lembar)] text-[var(--tinta)] text-[0.93rem] no-underline cursor-pointer hover:bg-[var(--cekung)]'
