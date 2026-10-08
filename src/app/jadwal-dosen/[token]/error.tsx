'use client'

export default function JadwalDosenError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="min-h-screen bg-[var(--kertas)] text-[var(--tinta)]">
      <main className="max-w-[56rem] mx-auto p-[1rem] sm:p-[1.6rem]">
        <section className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.2rem] sm:p-[1.6rem]">
          <h1 className="m-0 text-[1.3rem] font-semibold">Jadwal tidak dapat dimuat. Coba lagi nanti.</h1>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-[1rem] px-[0.8rem] py-[0.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium hover:bg-[var(--biru-hover)]"
          >
            Coba lagi
          </button>
        </section>
      </main>
    </div>
  )
}
