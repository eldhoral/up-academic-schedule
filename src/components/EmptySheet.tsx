import Link from 'next/link'

/** Stands in for a print preview when the selection has nothing to print: a blank
 *  page in the printed sheet's A4 proportion, so no Aspose conversion is spent on it. */
export function EmptySheet({
  title,
  detail,
  actionHref,
  actionLabel,
}: {
  title: string
  detail: string
  actionHref: string
  actionLabel: string
}) {
  return (
    <div className="flex-1 flex items-start justify-center px-[1.3rem] py-[2rem]">
      <div className="w-full max-w-[22rem] aspect-[1/1.414] flex flex-col bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] p-[1.6rem]">
        {/* The printed page's kop rule, with nothing under it. */}
        <div aria-hidden="true" className="pb-[1.6rem] border-b-2 border-[var(--garis)]" />
        <div className="flex-1 flex flex-col items-center justify-center gap-[0.4rem] text-center">
          <h2 className="m-0 text-[1.07rem] font-semibold text-[var(--tinta)] text-balance">{title}</h2>
          <p className="m-0 max-w-[17rem] text-[0.87rem] text-[var(--tinta-3)] text-pretty">{detail}</p>
          <Link
            href={actionHref}
            className="mt-[0.8rem] inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] bg-[var(--cekung)] text-[var(--tinta)] text-[0.93rem] font-medium no-underline hover:bg-[var(--lembar)] active:scale-[0.97] transition-colors"
          >
            {actionLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
