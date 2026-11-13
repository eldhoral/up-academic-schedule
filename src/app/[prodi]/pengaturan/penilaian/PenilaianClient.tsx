'use client'

import { useMemo, useState, useTransition, type ReactNode } from 'react'
import {
  DEFAULT_ATURAN, validateAspek, validatePilihanYudisium, validatePredikat, validateSks, validateTabelNilai, validateTanggal,
  type Aturan,
} from '@/lib/penilaian/aturan'
import { todayJakarta } from '@/lib/penilaian/akses'
import { parseAngka, round2 } from '@/lib/penilaian/nilai'
import { saveAturanAction, type Hasil, type Kunci } from './actions'

const INPUT = 'w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem] disabled:opacity-60'
const BTN = 'min-h-[2.4rem] px-[0.7rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[var(--tinta-2)] hover:bg-[var(--cekung)] cursor-pointer text-[0.87rem] disabled:opacity-40 disabled:cursor-default'
const HEAD = 'text-[0.73rem] uppercase tracking-[0.04em] text-[var(--tinta-3)]'

// Numbers are typed as text so a comma decimal works; 2.75 shows as "2,75".
const fmt = (n: number) => String(n).replace('.', ',')
type Parsed<T> = { error: string } | { value: T }

/** One typed number, or the first problem worded with its row. */
function angka(raw: string, min: number, max: number, nama: string, baris?: number): Parsed<number> {
  const r = parseAngka(raw, min, max)
  return r.ok ? { value: r.value } : { error: `${baris ? `Baris ${baris}, ` : ''}${nama}: ${r.error}` }
}

/** Maps every row, stopping at the first typed value that does not parse. */
function semua<R, T>(list: R[], f: (r: R, i: number) => Parsed<T>): Parsed<T[]> {
  const out: T[] = []
  for (let i = 0; i < list.length; i++) {
    const p = f(list[i], i)
    if ('error' in p) return p
    out.push(p.value)
  }
  return { value: out }
}

function useList<T>(initial: T[]) {
  const [list, setList] = useState(initial)
  return {
    list,
    setList,
    set: (i: number, patch: Partial<T>) => setList((l) => l.map((r, j) => (j === i ? { ...r, ...patch } : r))),
    add: (r: T) => setList((l) => [...l, r]),
    remove: (i: number) => setList((l) => l.filter((_, j) => j !== i)),
    move: (i: number, d: -1 | 1) =>
      setList((l) => {
        const j = i + d
        if (j < 0 || j >= l.length) return l
        const n = [...l]
        ;[n[i], n[j]] = [n[j], n[i]]
        return n
      }),
  }
}

/** A card with its own validation message, save button and "kembalikan ke bawaan". */
function Kartu({ judul, bantuan, kunci, error, nilai, onDefault, children }: {
  judul: string
  bantuan: string
  kunci: Kunci
  error: string | null
  nilai: unknown
  onDefault: () => void
  children: ReactNode
}) {
  const [pending, start] = useTransition()
  const [hasil, setHasil] = useState<{ h: Hasil; snap: string } | null>(null)
  const snap = JSON.stringify(nilai)
  // A result only counts for the exact content it saved; editing afterwards hides it.
  const tampil = hasil && hasil.snap === snap ? hasil.h : null

  const simpan = () => start(async () => setHasil({ h: await saveAturanAction(kunci, nilai), snap }))

  return (
    <section className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem]">
      <h2 className="m-0 text-[1.07rem] font-semibold">{judul}</h2>
      <p className="mt-[0.2rem] mb-[1rem] pb-[0.8rem] border-b border-[var(--garis)] text-[0.87rem] text-[var(--tinta-3)] leading-[1.4]">{bantuan}</p>
      {children}
      <div className="mt-[1rem] flex flex-wrap items-center gap-[0.6rem]">
        <button
          type="button"
          onClick={simpan}
          disabled={pending || !!error}
          className="px-[1rem] py-[0.6rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.93rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.98] disabled:opacity-60 transition-colors"
        >
          {pending ? 'Menyimpan…' : 'Simpan'}
        </button>
        <button type="button" onClick={onDefault} disabled={pending} className={BTN}>
          Kembalikan ke bawaan
        </button>
        <span role="status" aria-live="polite" className="text-[0.87rem]">
          {error ? (
            <span className="text-[var(--merah-teks)]">{error}</span>
          ) : tampil && 'error' in tampil ? (
            <span className="text-[var(--merah-teks)]">{tampil.error}</span>
          ) : tampil ? (
            <span className="text-[var(--hijau)]">Tersimpan.</span>
          ) : null}
        </span>
      </div>
    </section>
  )
}

/** Move up, move down, remove: the controls at the end of every ordered row. */
function BarisAksi({ i, n, move, remove }: { i: number; n: number; move: (i: number, d: -1 | 1) => void; remove: (i: number) => void }) {
  return (
    <div className="flex gap-[0.2rem]">
      <button type="button" className={BTN} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Naikkan baris ${i + 1}`}>↑</button>
      <button type="button" className={BTN} disabled={i === n - 1} onClick={() => move(i, 1)} aria-label={`Turunkan baris ${i + 1}`}>↓</button>
      <button type="button" className={`${BTN} hover:text-[var(--merah)]`} onClick={() => remove(i)} aria-label={`Hapus baris ${i + 1}`}>×</button>
    </div>
  )
}

const aspekRows = (a: Aturan['aspekBimbingan']) => a.map((r) => ({ label: r.label, bobot: fmt(r.bobot), sub: r.sub.join('\n') }))
const tabelRows = (t: Aturan['tabelNilai']) => t.map((r) => ({ min: fmt(r.min), huruf: r.huruf, mutu: fmt(r.mutu) }))
const predikatRows = (p: Aturan['predikat']) => p.map((r) => ({ min: fmt(r.min), max: fmt(r.max), predikat: r.predikat, butuh: r.butuhTepatWaktu }))

export function PenilaianClient({ aturan }: { aturan: Aturan }) {
  return (
    <div className="space-y-[1.2rem]">
      <AspekKartu
        awal={aturan.aspekBimbingan}
        judul="Aspek bimbingan"
        bantuan="Aspek prasidang yang dinilai dosen pembimbing. Total bobot harus 100. Sub-aspek, satu per baris, tampil sebagai panduan di form."
        kunci="aspek_bimbingan"
        bawaan={DEFAULT_ATURAN.aspekBimbingan}
      />
      <AspekKartu
        awal={aturan.aspekSidang}
        judul="Aspek sidang"
        bantuan="Aspek sidang yang dinilai tiga penguji. Total bobot harus 100. Sub-aspek, satu per baris, tampil sebagai panduan di form."
        kunci="aspek_sidang"
        bawaan={DEFAULT_ATURAN.aspekSidang}
      />
      <YudisiumKartu awal={aturan.pilihanYudisium} />
      <TabelKartu awal={aturan.tabelNilai} />
      <PredikatKartu awal={aturan.predikat} />
      <SksKartu awal={aturan.sksSkripsi} />
      <TanggalKartu awal={aturan.tanggalMulai} />
    </div>
  )
}

function AspekKartu({ awal, judul, bantuan, kunci, bawaan }: {
  awal: Aturan['aspekBimbingan']
  judul: string
  bantuan: string
  kunci: 'aspek_bimbingan' | 'aspek_sidang'
  bawaan: Aturan['aspekBimbingan']
}) {
  const { list, setList, set, add, remove, move } = useList(aspekRows(awal))
  const parsed = useMemo(() => semua(list, (r, i) => {
    const b = angka(r.bobot, 0, 100, 'Bobot', i + 1)
    return 'error' in b ? b : { value: { label: r.label.trim(), bobot: b.value, sub: r.sub.split('\n').map((s) => s.trim()).filter(Boolean) } }
  }), [list])
  const error = 'error' in parsed ? parsed.error : validateAspek(parsed.value)
  const total = round2(list.reduce((s, r) => { const b = parseAngka(r.bobot, 0, 100); return s + (b.ok ? b.value : 0) }, 0))

  return (
    <Kartu
      judul={judul}
      bantuan={bantuan}
      kunci={kunci}
      error={error}
      nilai={'value' in parsed ? parsed.value : null}
      onDefault={() => setList(aspekRows(bawaan))}
    >
      <div className="space-y-[0.8rem]">
        {list.map((r, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_6rem_auto] gap-[0.5rem] items-start p-[0.8rem] bg-[var(--cekung)]/50 border border-[var(--garis)] rounded-[var(--r-kecil)]">
            <input className={INPUT} value={r.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Nama aspek" aria-label={`Nama aspek baris ${i + 1}`} />
            <input className={`${INPUT} mono`} inputMode="decimal" value={r.bobot} onChange={(e) => set(i, { bobot: e.target.value })} placeholder="Bobot %" aria-label={`Bobot persen baris ${i + 1}`} />
            <BarisAksi i={i} n={list.length} move={move} remove={remove} />
            <textarea className={`${INPUT} sm:col-span-3`} rows={Math.max(2, r.sub.split('\n').length)} value={r.sub} onChange={(e) => set(i, { sub: e.target.value })} placeholder="Sub-aspek, satu per baris" aria-label={`Sub-aspek baris ${i + 1}`} />
          </div>
        ))}
      </div>
      <div className="mt-[0.6rem] flex items-center justify-between gap-[1rem]">
        <button type="button" className={BTN} onClick={() => add({ label: '', bobot: '', sub: '' })}>+ Tambah aspek</button>
        <span className="text-[0.93rem]">Total bobot <span className="mono font-medium">{fmt(total)}</span> dari 100</span>
      </div>
    </Kartu>
  )
}

function YudisiumKartu({ awal }: { awal: Aturan['pilihanYudisium'] }) {
  const { list, setList, set, add, remove, move } = useList(awal)
  const nilai = useMemo(() => list.map((r) => ({ label: r.label.trim(), lulus: r.lulus })), [list])
  const error = validatePilihanYudisium(nilai)

  return (
    <Kartu
      judul="Pilihan yudisium"
      bantuan="Pilihan yang diberikan Ketua Penguji saat mengunci nilai. Harus ada minimal satu pilihan lulus dan satu tidak lulus; Nilai Akhir hanya dihitung untuk pilihan lulus. Mengubah pilihan tidak mengubah sidang yang sudah dikunci."
      kunci="pilihan_yudisium"
      error={error}
      nilai={nilai}
      onDefault={() => setList(DEFAULT_ATURAN.pilihanYudisium.map((r) => ({ ...r })))}
    >
      <div className="space-y-[0.4rem]">
        {list.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_6rem_auto] gap-[0.5rem] items-center">
            <input className={INPUT} value={r.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Nama yudisium" aria-label={`Nama yudisium baris ${i + 1}`} />
            <label className="flex items-center gap-[0.4rem] text-[0.87rem] min-h-[2.4rem]">
              <input type="checkbox" checked={r.lulus} onChange={(e) => set(i, { lulus: e.target.checked })} />
              Lulus
            </label>
            <BarisAksi i={i} n={list.length} move={move} remove={remove} />
          </div>
        ))}
      </div>
      <button type="button" className={`${BTN} mt-[0.6rem]`} onClick={() => add({ label: '', lulus: false })}>+ Tambah pilihan</button>
    </Kartu>
  )
}

function TabelKartu({ awal }: { awal: Aturan['tabelNilai'] }) {
  const { list, setList, set, add, remove, move } = useList(tabelRows(awal))
  const parsed = useMemo(() => semua(list, (r, i) => {
    const min = angka(r.min, 0, 100, 'Batas bawah', i + 1)
    if ('error' in min) return min
    const mutu = angka(r.mutu, 0, 4, 'Bobot mutu', i + 1)
    return 'error' in mutu ? mutu : { value: { min: min.value, huruf: r.huruf.trim(), mutu: mutu.value } }
  }), [list])
  const error = 'error' in parsed ? parsed.error : validateTabelNilai(parsed.value)

  return (
    <Kartu
      judul="Tabel Nilai"
      bantuan="Huruf mutu dari nilai angka. Sebuah nilai memakai baris dengan batas bawah tertinggi yang tidak melebihinya. Harus ada baris dengan batas bawah 0."
      kunci="tabel_nilai"
      error={error}
      nilai={'value' in parsed ? parsed.value : null}
      onDefault={() => setList(tabelRows(DEFAULT_ATURAN.tabelNilai))}
    >
      <div className="overflow-x-auto">
        <div className="min-w-[30rem] space-y-[0.4rem]">
          <div className={`grid grid-cols-[6rem_6rem_6rem_auto] gap-[0.5rem] ${HEAD}`}>
            <span>Batas bawah</span><span>Huruf</span><span>Bobot mutu</span><span className="w-[8.6rem]" />
          </div>
          {list.map((r, i) => (
            <div key={i} className="grid grid-cols-[6rem_6rem_6rem_auto] gap-[0.5rem] items-center">
              <input className={`${INPUT} mono`} inputMode="decimal" value={r.min} onChange={(e) => set(i, { min: e.target.value })} aria-label={`Batas bawah baris ${i + 1}`} />
              <input className={INPUT} value={r.huruf} onChange={(e) => set(i, { huruf: e.target.value })} aria-label={`Huruf baris ${i + 1}`} />
              <input className={`${INPUT} mono`} inputMode="decimal" value={r.mutu} onChange={(e) => set(i, { mutu: e.target.value })} aria-label={`Bobot mutu baris ${i + 1}`} />
              <BarisAksi i={i} n={list.length} move={move} remove={remove} />
            </div>
          ))}
        </div>
      </div>
      <button type="button" className={`${BTN} mt-[0.6rem]`} onClick={() => add({ min: '', huruf: '', mutu: '' })}>+ Tambah baris</button>
    </Kartu>
  )
}

function PredikatKartu({ awal }: { awal: Aturan['predikat'] }) {
  const { list, setList, set, add, remove, move } = useList(predikatRows(awal))
  const parsed = useMemo(() => semua(list, (r, i) => {
    const min = angka(r.min, 0, 4, 'IPK min', i + 1)
    if ('error' in min) return min
    const max = angka(r.max, 0, 4, 'IPK max', i + 1)
    return 'error' in max ? max : { value: { min: min.value, max: max.value, predikat: r.predikat.trim(), butuhTepatWaktu: r.butuh } }
  }), [list])
  const error = 'error' in parsed ? parsed.error : validatePredikat(parsed.value)

  return (
    <Kartu
      judul="Predikat yudisium"
      bantuan="Predikat dari IPK akhir. Rentang IPK tidak boleh tumpang tindih. Dipakai saat nilai sidang diisi."
      kunci="predikat"
      error={error}
      nilai={'value' in parsed ? parsed.value : null}
      onDefault={() => setList(predikatRows(DEFAULT_ATURAN.predikat))}
    >
      <div className="overflow-x-auto">
        <div className="min-w-[38rem] space-y-[0.4rem]">
          <div className={`grid grid-cols-[5rem_5rem_1fr_9rem_auto] gap-[0.5rem] ${HEAD}`}>
            <span>IPK min</span><span>IPK max</span><span>Predikat</span><span>Syarat</span><span className="w-[8.6rem]" />
          </div>
          {list.map((r, i) => (
            <div key={i} className="grid grid-cols-[5rem_5rem_1fr_9rem_auto] gap-[0.5rem] items-center">
              <input className={`${INPUT} mono`} inputMode="decimal" value={r.min} onChange={(e) => set(i, { min: e.target.value })} aria-label={`IPK min baris ${i + 1}`} />
              <input className={`${INPUT} mono`} inputMode="decimal" value={r.max} onChange={(e) => set(i, { max: e.target.value })} aria-label={`IPK max baris ${i + 1}`} />
              <input className={INPUT} value={r.predikat} onChange={(e) => set(i, { predikat: e.target.value })} aria-label={`Predikat baris ${i + 1}`} />
              <label className="flex items-center gap-[0.4rem] text-[0.87rem] min-h-[2.4rem]">
                <input type="checkbox" checked={r.butuh} onChange={(e) => set(i, { butuh: e.target.checked })} />
                Wajib tepat waktu
              </label>
              <BarisAksi i={i} n={list.length} move={move} remove={remove} />
            </div>
          ))}
        </div>
      </div>
      <button type="button" className={`${BTN} mt-[0.6rem]`} onClick={() => add({ min: '', max: '', predikat: '', butuh: false })}>+ Tambah predikat</button>
    </Kartu>
  )
}

function SksKartu({ awal }: { awal: number }) {
  const [v, setV] = useState(String(awal))
  const p = angka(v, 1, 999, 'SKS skripsi')
  const error = 'error' in p ? p.error : validateSks(p.value)

  return (
    <Kartu
      judul="SKS skripsi"
      bantuan="Jumlah SKS mata kuliah skripsi, dipakai saat IPK akhir dihitung."
      kunci="sks_skripsi"
      error={error}
      nilai={'value' in p ? p.value : null}
      onDefault={() => setV(String(DEFAULT_ATURAN.sksSkripsi))}
    >
      <div className="max-w-[8rem]">
        <input className={`${INPUT} mono`} inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} aria-label="SKS skripsi" />
      </div>
    </Kartu>
  )
}

function TanggalKartu({ awal }: { awal: string }) {
  const [v, setV] = useState(awal)
  const error = validateTanggal(v)

  return (
    <Kartu
      judul="Tanggal mulai penilaian"
      bantuan="Prasidang dan sidang sebelum tanggal ini dianggap lama: dosen tidak menilai online, hanya Super Admin yang dapat mengisi nilainya."
      kunci="tanggal_mulai_penilaian"
      error={error}
      nilai={v}
      onDefault={() => setV(todayJakarta())}
    >
      <div className="max-w-[12rem]">
        <input type="date" className={`${INPUT} mono`} value={v} onChange={(e) => setV(e.target.value)} aria-label="Tanggal mulai penilaian" />
      </div>
    </Kartu>
  )
}
