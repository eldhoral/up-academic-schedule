'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import { buatPasswordBaruAction, perpanjangAction } from './actions'

export type Akun = {
  userId: string
  kode: string
  nama: string
  tanggal: string
  username: string
  berlakuSampai: string | null
  aktif: boolean
  mahasiswa: { npm: string; nama: string; jam: string }[]
}

const tanggalPanjang = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

const BUTTON = 'px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[0.87rem] cursor-pointer hover:bg-[var(--cekung)] disabled:opacity-60'
const HARI = Array.from({ length: 7 }, (_, i) => ({ value: String(i + 1), label: `+${i + 1} hari` }))

export function AkunClient({ akun, bisaPerpanjang }: { akun: Akun[]; bisaPerpanjang: boolean }) {
  const [reset, setReset] = useState<Akun | null>(null)

  return (
    <div className="px-[1.3rem] py-[1rem]">
      <p className="m-0 mb-[1rem] text-[0.87rem] text-[var(--tinta-3)] max-w-[44rem]">
        Satu akun per dosen eksternal per tanggal sidang, dipakai untuk semua mahasiswa yang diuji hari itu. Akun berlaku sampai sehari setelah sidang.
      </p>
      <ul className="m-0 p-0 list-none grid gap-[0.8rem] [grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr))]">
        {akun.map((a) => (
          <AkunCard key={a.userId} akun={a} bisaPerpanjang={bisaPerpanjang} onReset={() => setReset(a)} />
        ))}
      </ul>
      {reset && <PasswordModal akun={reset} onClose={() => setReset(null)} />}
    </div>
  )
}

function AkunCard({ akun: a, bisaPerpanjang, onReset }: { akun: Akun; bisaPerpanjang: boolean; onReset: () => void }) {
  const router = useRouter()
  const [hari, setHari] = useState('1')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function perpanjang() {
    setError('')
    startTransition(async () => {
      const res = await perpanjangAction(a.userId, Number(hari))
      if ('error' in res) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <li className="bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1rem] flex flex-col gap-[0.6rem]">
      <div className="flex items-start justify-between gap-[0.6rem]">
        <div className="min-w-0">
          <h2 className="m-0 text-[1rem] font-semibold">{a.nama}</h2>
          <p className="m-0 text-[0.87rem] text-[var(--tinta-2)]">{tanggalPanjang(a.tanggal)}</p>
        </div>
        <span
          className={`shrink-0 px-[0.5rem] py-[0.13rem] rounded-[var(--r-kecil)] text-[0.8rem] font-medium ${
            a.aktif ? 'bg-[var(--hijau-lembut)] text-[var(--hijau)]' : 'bg-[var(--cekung)] text-[var(--tinta-2)] border border-[var(--garis)]'
          }`}
        >
          {a.aktif ? 'Aktif' : 'Kedaluwarsa'}
        </span>
      </div>

      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-[0.8rem] gap-y-[0.25rem] text-[0.87rem]">
        <dt className="text-[var(--tinta-3)]">Username</dt>
        <dd className="m-0 mono select-all break-all">{a.username}</dd>
        <dt className="text-[var(--tinta-3)]">Berlaku sampai</dt>
        <dd className="m-0">{a.berlakuSampai ? tanggalPanjang(a.berlakuSampai) : '—'}</dd>
      </dl>

      <div className="text-[0.87rem]">
        <p className="m-0 mb-[0.25rem] text-[var(--tinta-3)]">Mahasiswa hari itu</p>
        {a.mahasiswa.length === 0 ? (
          <p className="m-0 text-[var(--tinta-3)]">Tidak ada lagi sidang dengan dosen ini pada tanggal tersebut.</p>
        ) : (
          <ul className="m-0 pl-0 list-none space-y-[0.13rem]">
            {a.mahasiswa.map((m) => (
              <li key={m.npm}>
                <span className="mono text-[var(--tinta-2)]">{m.jam}</span> {m.nama} <span className="mono text-[var(--tinta-3)]">({m.npm})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div role="alert" className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.5rem] text-[0.87rem] text-[var(--merah-teks)]">
          {error}
        </div>
      )}

      <div className="mt-auto pt-[0.6rem] border-t border-[var(--garis)] flex flex-wrap items-center gap-[0.5rem]">
        <button type="button" onClick={onReset} className={BUTTON}>
          Buat password baru
        </button>
        {bisaPerpanjang && (
          <div className="flex items-center gap-[0.4rem] ml-auto">
            <Select value={hari} onValueChange={setHari} options={HARI} ariaLabel={`Perpanjang akun ${a.username}`} className="min-w-[7rem] text-[0.87rem]" />
            <button type="button" onClick={perpanjang} disabled={isPending} className={BUTTON}>
              {isPending ? 'Memperpanjang…' : 'Perpanjang'}
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

/** Confirm, then show the new password once. The old one stops working at once. */
function PasswordModal({ akun, onClose }: { akun: Akun; onClose: () => void }) {
  const [password, setPassword] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function buat() {
    setError('')
    startTransition(async () => {
      const res = await buatPasswordBaruAction(akun.userId)
      if ('error' in res) setError(res.error)
      else setPassword(res.password)
    })
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Username: ${akun.username}\nKata sandi: ${password ?? ''}`)
      setCopied(true)
    } catch {
      setError('Tidak dapat menyalin. Catat kata sandi secara manual.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="sandi-judul">
      <div className="w-full max-w-[26rem] bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.4rem]">
        <h3 id="sandi-judul" className="m-0 text-[1.1rem] font-semibold mb-[0.6rem]">Buat password baru</h3>

        {error && (
          <div role="alert" className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.87rem] text-[var(--merah-teks)] mb-[0.8rem]">
            {error}
          </div>
        )}

        {password === null ? (
          <p className="text-[0.93rem] text-[var(--tinta-2)] mb-[1rem]">
            Buat kata sandi baru untuk <strong>{akun.nama}</strong> (<span className="mono">{akun.username}</span>)? Kata sandi lama langsung tidak berlaku.
          </p>
        ) : (
          <>
            <p className="text-[0.93rem] text-[var(--tinta-2)] mb-[0.6rem]">
              Kata sandi baru untuk <span className="mono">{akun.username}</span>:
            </p>
            <code className="block mb-[0.6rem] bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[1rem] tracking-[0.05em] select-all">
              {password}
            </code>
            <p className="text-[0.8rem] text-[var(--tinta-3)] mb-[1rem]">Kata sandi ini tidak akan ditampilkan lagi. Serahkan langsung ke penguji.</p>
          </>
        )}

        <div className="flex gap-[0.6rem] justify-end">
          {password !== null && (
            <button type="button" onClick={copy} className={BUTTON}>
              {copied ? 'Tersalin' : 'Salin'}
            </button>
          )}
          <button type="button" onClick={onClose} className={BUTTON}>
            {password === null ? 'Batal' : 'Tutup'}
          </button>
          {password === null && (
            <button
              type="button"
              disabled={isPending}
              onClick={buat}
              className="px-[0.8rem] py-[0.4rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] disabled:opacity-60"
            >
              {isPending ? 'Membuat…' : 'Buat password baru'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
