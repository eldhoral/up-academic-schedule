/** The student's details at the top of the grading pages, as a bordered two-column table (2026-11-28). */
export function TabelFakta({ fakta }: { fakta: [string, React.ReactNode][] }) {
  return (
    <div className="mt-[1rem] mb-[1.6rem] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] overflow-hidden bg-[var(--lembar)]">
      <table className="w-full border-collapse text-[0.93rem]">
        <tbody>
          {fakta.map(([k, v]) => (
            <tr key={k} className="border-t border-[var(--garis)] first:border-t-0">
              <th scope="row" className="w-[38%] sm:w-[13rem] px-[0.8rem] py-[0.5rem] bg-[var(--cekung)] border-r border-[var(--garis)] text-left align-top text-[0.73rem] font-semibold uppercase tracking-[0.04em] text-[var(--tinta-2)]">
                {k}
              </th>
              <td className="px-[0.8rem] py-[0.5rem] align-top">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
