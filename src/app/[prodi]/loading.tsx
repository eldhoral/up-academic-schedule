/**
 * Shown at once on navigation inside /s1 and /s2 while the page's queries run.
 * Header-height bar plus a few grey rows: the shape of every schedule page.
 */
export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)]" aria-busy="true" aria-live="polite">
      <div className="h-[3.4rem] bg-[var(--lembar)] border-b border-[var(--garis)]" />
      <div className="p-[1.3rem] space-y-[0.8rem] animate-pulse">
        <span className="sr-only">Memuat&hellip;</span>
        <div className="h-[2.4rem] max-w-[28rem] rounded-[var(--r-kecil)] bg-[var(--cekung)]" />
        <div className="h-[1.6rem] max-w-[16rem] rounded-[var(--r-kecil)] bg-[var(--cekung)]" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[2.4rem] rounded-[var(--r-kecil)] bg-[var(--cekung)]" />
        ))}
      </div>
    </div>
  )
}
