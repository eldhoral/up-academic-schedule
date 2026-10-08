export default function JadwalDosenNotFound() {
  return (
    <div className="min-h-screen bg-[var(--kertas)] text-[var(--tinta)]">
      <main className="max-w-[56rem] mx-auto p-[1rem] sm:p-[1.6rem]">
        <section className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.2rem] sm:p-[1.6rem]">
          <h1 className="m-0 text-[1.3rem] font-semibold">Link jadwal tidak ditemukan.</h1>
          <p className="m-0 mt-[0.4rem] text-[0.93rem] text-[var(--tinta-2)]">
            Link ini mungkin sudah diganti. Minta link jadwal yang baru ke staf prodi.
          </p>
        </section>
      </main>
    </div>
  )
}
