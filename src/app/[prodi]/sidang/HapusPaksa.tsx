'use client'

import { useState, useTransition } from 'react'
import { penilaianSidangPath } from '@/lib/penilaian/akses'
import { hapusPaksaAction } from './actions'
import { tanggalSingkat, type DefenseRow } from './defense-types'

/**
 * Super Admin: delete a prasidang whose berita acara is filled, or a sidang already graded. Two steps: this button
 * opens a dialog naming what is lost, and the delete only enables once the student's NPM is typed. The server checks
 * both again. `terisi` = the labels of the roles that filled or graded.
 */
export function HapusPaksa({ jenis, row, terisi, onDeleted }: { jenis: 'prasidang' | 'sidang'; row: DefenseRow; terisi: string[]; onDeleted: () => void }) {
  const sidang = jenis === 'sidang'
  const [buka, setBuka] = useState(false)
  const [ketik, setKetik] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const cocok = ketik.trim() === row.npm

  function tutup() {
    setBuka(false)
    setKetik('')
    setError('')
  }

  function hapus() {
    setError('')
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof hapusPaksaAction>>
      try {
        res = await hapusPaksaAction(jenis, row.id, ketik)
      } catch {
        res = { error: 'Tidak dapat menghapus. Periksa koneksi lalu coba lagi.' }
      }
      if ('error' in res) return setError(res.error)
      onDeleted()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setBuka(true)}
        className="px-[0.8rem] py-[0.4rem] rounded-[var(--r-kecil)] bg-[var(--merah)] text-white text-[0.87rem] font-medium cursor-pointer hover:opacity-90"
      >
        Hapus
      </button>
      {buka && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hapus-paksa-judul"
          onKeyDown={(e) => e.key === 'Escape' && !pending && tutup()}
        >
          <div className="w-full max-w-[30rem] bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.2rem] space-y-[0.8rem] text-[0.93rem]">
            <h3 id="hapus-paksa-judul" className="m-0 text-[1.1rem] font-semibold">
              {sidang ? 'Hapus sidang beserta nilainya?' : 'Hapus prasidang beserta berita acaranya?'}
            </h3>
            <p className="m-0">
              <span className="font-medium">{row.npm} · {row.nama_mahasiswa}</span>, {jenis} {tanggalSingkat(row.tanggal)}.
            </p>
            <p className="m-0 bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.87rem] text-[var(--merah-teks)]">
              {sidang
                ? `Nilai penguji (${terisi.join(', ')}), hasil sidang dan nilai bimbingan ikut terhapus. Email revisi yang sudah terkirim tidak ditarik.`
                : `Berita acara yang sudah diisi (${terisi.join(' dan ')}) ikut terhapus.`}{' '}
              Tidak bisa dikembalikan dari aplikasi; salinannya tetap tercatat di Log Aktivitas.
            </p>
            <p className="m-0 text-[0.87rem]">
              Simpan dulu:{' '}
              {sidang ? (
                <a href={penilaianSidangPath(row.id)} target="_blank" rel="noopener" className="text-[var(--biru)] underline">Buka halaman Nilai Sidang</a>
              ) : (
                <a href={`/api/berita-acara-prasidang/${row.id}?format=pdf`} className="text-[var(--biru)] underline">Unduh Berita Acara (PDF)</a>
              )}
            </p>
            <label className="block">
              <span className="block mb-[0.3rem] text-[0.87rem]">
                Ketik NPM <span className="mono font-medium">{row.npm}</span> untuk konfirmasi
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                value={ketik}
                onChange={(e) => setKetik(e.target.value)}
                className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] min-h-[2.4rem] mono"
              />
            </label>
            {error && <p role="alert" className="m-0 text-[0.87rem] text-[var(--merah-teks)]">{error}</p>}
            <div className="flex gap-[0.6rem] justify-end pt-[0.4rem]">
              <button
                type="button"
                onClick={tutup}
                disabled={pending}
                className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[0.87rem] cursor-pointer hover:bg-[var(--cekung)] disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={hapus}
                disabled={!cocok || pending}
                className="px-[0.8rem] py-[0.4rem] rounded-[var(--r-kecil)] bg-[var(--merah)] text-white text-[0.87rem] font-medium cursor-pointer disabled:opacity-50 disabled:cursor-default"
              >
                {pending ? 'Menghapus…' : 'Hapus permanen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
