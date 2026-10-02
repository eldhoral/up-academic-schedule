import Link from 'next/link'

/** Stands in for a preview when the selection has nothing to show or print. */
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
    <div className="flex-1 flex items-start justify-center px-[1.3rem] py-[2.5rem]">
      <div className="w-full max-w-[26rem] flex flex-col items-center gap-[0.4rem] text-center bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.6rem]">
        <h2 className="m-0 text-[1.07rem] font-semibold text-[var(--tinta)] text-balance">{title}</h2>
        <p className="m-0 max-w-[20rem] text-[0.87rem] text-[var(--tinta-3)] text-pretty">{detail}</p>
        <Link
          href={actionHref}
          className="mt-[0.8rem] inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] bg-[var(--cekung)] text-[var(--tinta)] text-[0.93rem] font-medium no-underline hover:bg-[var(--lembar)] active:scale-[0.97] transition-colors"
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  )
}
