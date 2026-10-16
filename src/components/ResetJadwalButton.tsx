'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import { PRODI, PRODI_CONFIG, type Prodi } from '@/lib/prodi'
import { countJadwalAction, resetJadwalAction, type ResetCounts, type ResetKind } from '@/app/actions/reset-jadwal'

type Year = { id: string; label: string; is_active: boolean }
type Step = 'pilih' | 'konfirmasi' | 'selesai'

const ROWS: { kind: ResetKind; label: (p: Prodi) => string }[] = [
  { kind: 'kuliah', label: () => 'Mata Kuliah & Dosen' },
  { kind: 'ujian', label: () => 'UTS & UAS' },
  { kind: 'sidang', label: (p) => PRODI_CONFIG[p].defense.section },
]
const ALL = ROWS.flatMap((r) => PRODI.map((p) => `${r.kind}:${p}`))

const btn = 'min-h-[2.4rem] px-[0.8rem] rounded-[var(--r-kecil)] text-[0.87rem] cursor-pointer transition-colors active:scale-[0.98] disabled:opacity-60 disabled:cursor-default disabled:active:scale-100'
const btnQuiet = `${btn} border border-[var(--garis-kuat)] hover:bg-[var(--cekung)]`

/** Menu "Reset Jadwal" (Super Admin only): pick a year and which jadwal × prodi, confirm, delete. */
export function ResetJadwalButton({ years }: { years: Year[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-block py-[0.4rem] px-0 bg-transparent border-0 text-[0.93rem] text-[var(--tinta-2)] cursor-pointer hover:text-[var(--merah)] hover:underline"
      >
        Reset Jadwal
      </button>
      {open && <ResetJadwalModal years={years} onClose={() => setOpen(false)} />}
    </>
  )
}

function ResetJadwalModal({ years, onClose }: { years: Year[]; onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('pilih')
  const [yearId, setYearId] = useState((years.find((y) => y.is_active) ?? years[0])?.id ?? '')
  const [picked, setPicked] = useState(() => new Set(ALL))
  const [counts, setCounts] = useState<ResetCounts | null>(null)
  const [error, setError] = useState('')
  const [typed, setTyped] = useState('')
  const [deleted, setDeleted] = useState(0)
  const [isCounting, startCounting] = useTransition()
  const [isResetting, startResetting] = useTransition()

  const year = years.find((y) => y.id === yearId)

  useEffect(() => {
    if (!yearId) return
    startCounting(async () => {
      const result = await countJadwalAction(yearId)
      setCounts('counts' in result ? result.counts : null)
      setError('error' in result ? result.error : '')
    })
  }, [yearId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !isResetting && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isResetting, onClose])

  const count = (kind: ResetKind, p: Prodi) => counts?.[kind][p] ?? 0
  const targets = ROWS.flatMap((r) =>
    PRODI.filter((p) => picked.has(`${r.kind}:${p}`) && count(r.kind, p) > 0).map((p) => ({ kind: r.kind, prodi: p, label: r.label(p), n: count(r.kind, p) })),
  )
  const total = targets.reduce((sum, t) => sum + t.n, 0)

  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const reset = () =>
    startResetting(async () => {
      setError('')
      const result = await resetJadwalAction(yearId, targets.map(({ kind, prodi }) => ({ kind, prodi })))
      if ('error' in result) {
        setError(result.error)
        return
      }
      setDeleted(result.deleted)
      setStep('selesai')
      router.refresh()
    })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="reset-jadwal-judul">
      <div className="w-full max-w-[34rem] max-h-full overflow-y-auto bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)]">
        {step === 'konfirmasi' && (
          <div className="px-[1.4rem] py-[0.8rem] bg-[var(--merah-lembut)] border-b border-[var(--merah-garis)] text-[var(--merah-teks)]">
            <p className="m-0 text-[0.73rem] font-semibold uppercase tracking-[0.04em]">Tindakan berbahaya</p>
            <p className="m-0 mt-[0.13rem] text-[0.93rem]">Jadwal yang dihapus tidak bisa dikembalikan.</p>
          </div>
        )}

        <div className="p-[1.4rem]">
          <h3 id="reset-jadwal-judul" className="m-0 text-[1.1rem] font-semibold">
            {step === 'selesai' ? 'Jadwal direset' : 'Reset Jadwal'}
          </h3>

          {error && (
            <div className="mt-[1rem] bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.87rem] text-[var(--merah-teks)]">
              {error}
            </div>
          )}

          {step === 'pilih' && (
            <>
              <p className="m-0 mt-[0.2rem] text-[0.87rem] text-[var(--tinta-3)]">
                Hapus jadwal satu tahun akademik. Data master (dosen, mata kuliah, ruangan, mahasiswa) tidak ikut terhapus.
              </p>

              <div className="mt-[1rem]">
                <span className="block text-[0.87rem] font-medium mb-[0.3rem]">Tahun akademik</span>
                <Select
                  ariaLabel="Tahun akademik"
                  value={yearId}
                  onValueChange={setYearId}
                  options={years.map((y) => ({ value: y.id, label: y.is_active ? `${y.label} (aktif)` : y.label }))}
                  className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem]"
                />
              </div>

              <table className="mt-[1rem] w-full border-collapse border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] text-[0.87rem]">
                <thead className="bg-[var(--cekung)]">
                  <tr>
                    <th className="text-left px-[0.6rem] py-[0.4rem] text-[0.73rem] font-medium uppercase tracking-[0.04em] text-[var(--tinta-3)]">Jadwal</th>
                    {PRODI.map((p) => (
                      <th key={p} className="w-[28%] text-left px-[0.6rem] py-[0.4rem] text-[0.73rem] font-medium uppercase tracking-[0.04em] text-[var(--tinta-3)] border-l border-[var(--garis)]">
                        {PRODI_CONFIG[p].short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => (
                    <tr key={r.kind} className="border-t border-[var(--garis)]">
                      <th scope="row" className="text-left font-medium px-[0.6rem] py-[0.4rem]">
                        {r.kind === 'sidang' ? 'Sidang & Seminar' : r.label('s1')}
                      </th>
                      {PRODI.map((p) => {
                        const key = `${r.kind}:${p}`
                        const n = count(r.kind, p)
                        const on = picked.has(key) && n > 0
                        return (
                          <td key={p} className={`p-0 border-l border-[var(--garis)] transition-colors ${on ? 'bg-[var(--merah-lembut)]' : ''}`}>
                            <label className={`flex items-start gap-[0.5rem] min-h-[2.6rem] px-[0.6rem] py-[0.4rem] ${n > 0 ? 'cursor-pointer' : 'cursor-default'}`}>
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={n === 0 || isCounting}
                                onChange={() => toggle(key)}
                                aria-label={`${PRODI_CONFIG[p].short} ${r.label(p)}`}
                                className="mt-[0.2rem] w-[1rem] h-[1rem] accent-[var(--merah)]"
                              />
                              <span className="min-w-0">
                                <span className={`mono ${on ? 'text-[var(--merah-teks)] font-semibold' : n > 0 ? 'text-[var(--tinta)]' : 'text-[var(--tinta-3)]'}`}>
                                  {isCounting || !counts ? '…' : n}
                                </span>{' '}
                                <span className="text-[var(--tinta-3)]">jadwal</span>
                                {r.kind === 'sidang' && <span className="block text-[0.8rem] text-[var(--tinta-3)] leading-[1.3]">{r.label(p)}</span>}
                              </span>
                            </label>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-[1.2rem] flex items-end justify-between gap-[1rem] flex-wrap">
                <p className="m-0" aria-live="polite">
                  <span className={`mono block text-[1.87rem] leading-none font-semibold tracking-[-0.025em] ${total > 0 ? 'text-[var(--merah)]' : 'text-[var(--tinta-3)]'}`}>
                    {isCounting ? '…' : total}
                  </span>
                  <span className="text-[0.73rem] font-semibold uppercase tracking-[0.04em] text-[var(--tinta-3)]">jadwal akan dihapus</span>
                </p>
                <div className="flex gap-[0.6rem] ml-auto">
                  <button type="button" onClick={onClose} className={btnQuiet}>
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={isCounting || total === 0}
                    onClick={() => {
                      setTyped('')
                      setStep('konfirmasi')
                    }}
                    className={`${btn} border border-[var(--merah-garis)] text-[var(--merah)] font-medium hover:bg-[var(--merah-lembut)]`}
                  >
                    Lanjut
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 'konfirmasi' && year && (
            <>
              <p className="m-0 mt-[0.2rem] text-[0.87rem] text-[var(--tinta-3)]">
                Tahun akademik <span className="font-medium text-[var(--tinta)]">{year.label}</span>
              </p>
              <ul className="m-0 mt-[0.8rem] p-0 list-none border border-[var(--garis-kuat)] rounded-[var(--r-kecil)]">
                {targets.map((t) => (
                  <li key={`${t.kind}:${t.prodi}`} className="flex justify-between gap-[1rem] px-[0.6rem] py-[0.4rem] border-b border-[var(--garis)] last:border-b-0 text-[0.93rem]">
                    <span>
                      <span className="text-[var(--tinta-3)]">{PRODI_CONFIG[t.prodi].short} · </span>
                      {t.label}
                    </span>
                    <span className="mono whitespace-nowrap">{t.n} jadwal</span>
                  </li>
                ))}
              </ul>

              <label htmlFor="reset-jadwal-ketik" className="block mt-[1rem] text-[0.87rem]">
                Ketik <span className="mono font-semibold select-all">{year.label}</span> untuk melanjutkan
              </label>
              <input
                id="reset-jadwal-ketik"
                autoFocus
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="mt-[0.3rem] w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mono"
              />

              <div className="mt-[1.2rem] flex gap-[0.6rem] justify-end flex-wrap">
                <button type="button" disabled={isResetting} onClick={() => setStep('pilih')} className={btnQuiet}>
                  Kembali
                </button>
                <button
                  type="button"
                  disabled={isResetting || typed.trim() !== year.label}
                  onClick={reset}
                  className={`${btn} bg-[var(--merah)] text-white font-medium`}
                >
                  {isResetting ? 'Menghapus…' : `Hapus ${total} jadwal`}
                </button>
              </div>
            </>
          )}

          {step === 'selesai' && (
            <>
              <p className="m-0 mt-[0.8rem] bg-[var(--hijau-lembut)] border border-[var(--hijau)]/30 rounded-[var(--r-kecil)] p-[0.7rem] text-[0.93rem] text-[var(--hijau)]">
                <span className="mono font-semibold">{deleted}</span> jadwal dihapus dari {year?.label}.
              </p>
              <div className="mt-[1.2rem] flex justify-end">
                <button type="button" onClick={onClose} className={btnQuiet}>
                  Tutup
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
