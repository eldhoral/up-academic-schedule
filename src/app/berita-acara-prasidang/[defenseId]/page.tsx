import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { getCurrentUser, canManage, isPenguji } from '@/lib/roles'
import { tanggalPanjang } from '@/lib/hari'
import { aksesBeritaAcara, peranPrasidang, todayJakarta } from '@/lib/penilaian/akses'
import { loadBeritaAcara, type BeritaAcaraRow } from '@/lib/penilaian/data'
import {
  batasBeritaAcara, beritaAcaraPath, HASIL_LABEL, PERAN_PRASIDANG, PERAN_PRASIDANG_LABEL, STATUS_LABEL, type PeranPrasidang,
} from '@/lib/penilaian/prasidang'
import { submitBeritaAcaraAction } from '../actions'
import { BeritaAcaraForm } from './BeritaAcaraForm'

const waktu = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso))
const KOTAK = 'm-0 p-[1rem] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] text-[0.93rem]'

export default async function BeritaAcaraPage(props: PageProps<'/berita-acara-prasidang/[defenseId]'>) {
  const { defenseId } = await props.params
  const path = beritaAcaraPath(defenseId)
  const user = await getCurrentUser()
  if (!user) redirect(`/masuk?redirectTo=${encodeURIComponent(path)}`)
  // An examiner is never staff here; an EKSTERNAL never fills a berita acara (the proxy keeps it away too).
  const dosen = isPenguji(user.role)
  if (dosen && (user.role !== 'DOSEN' || !user.kodeDosen)) notFound()

  const data = await loadBeritaAcara(defenseId)
  const akses = dosen
    ? aksesBeritaAcara(data?.defense ?? null, user.kodeDosen!, new Set(Object.keys(data?.isian ?? {}) as PeranPrasidang[]), todayJakarta())
    : null
  // Not this dosen's S1 prasidang (or none at all): 404 with no hint the record exists.
  if (!data || akses?.kind === 'tidak-ada') notFound()

  const { defense, aturan } = data
  const fakta: [string, React.ReactNode][] = [
    ['NPM', <span key="npm" className="mono">{defense.npm}</span>],
    ['Nama', defense.nama_mahasiswa],
    ['Judul skripsi', defense.judul_skripsi || '—'],
    ['Tanggal prasidang', tanggalPanjang(defense.tanggal, false)],
  ]
  const peranSaya = dosen ? peranPrasidang(defense, user.kodeDosen!) : null
  if (peranSaya) fakta.push(['Peran Anda', PERAN_PRASIDANG_LABEL[peranSaya]])

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active={path} />
      <main className="flex-1 w-full max-w-[52rem] mx-auto px-[1.3rem] py-[1.6rem]">
        {dosen && <Link href="/penilaian" className="text-[0.87rem] text-[var(--tinta-2)] hover:underline">‹ Penilaian Saya</Link>}
        <h1 className="m-0 mt-[0.4rem] text-[1.6rem] font-semibold tracking-[-0.02em]">Berita Acara Prasidang</h1>
        <dl className="m-0 mt-[1rem] mb-[1.6rem] grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-x-[1rem] gap-y-[0.4rem] text-[0.93rem]">
          {fakta.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-[0.73rem] uppercase tracking-[0.04em] text-[var(--tinta-3)] sm:pt-[0.2rem]">{k}</dt>
              <dd className="m-0 mb-[0.4rem] sm:mb-0">{v}</dd>
            </div>
          ))}
        </dl>

        {akses?.kind === 'belum-dibuka' && (
          <p className={KOTAK}>Berita acara dibuka pada <strong>{tanggalPanjang(akses.tanggal, false)}</strong>.</p>
        )}
        {akses?.kind === 'isi' && (
          <>
            <h2 className="m-0 mb-[0.3rem] text-[1.2rem] font-semibold tracking-[-0.01em]">Saran Perbaikan Proposal Skripsi</h2>
            <p className="m-0 mb-[0.4rem] text-[0.87rem] text-[var(--tinta-3)]">
              Uraian mengenai masukan dan perbaikan yang harus dilakukan peserta prasidang dalam rangka perbaikan proposal skripsi yang disampaikan.
            </p>
            <p className="m-0 mb-[1rem] text-[0.87rem] text-[var(--tinta-2)]">
              Batas pengisian: <strong>{tanggalPanjang(batasBeritaAcara(defense.tanggal), false)}</strong> (paling lambat 1 hari setelah prasidang).
            </p>
            <BeritaAcaraForm
              pertanyaan={aturan.pertanyaanPrasidang}
              aksi={submitBeritaAcaraAction.bind(null, defense.id, akses.peran, aturan.pertanyaanPrasidang)}
            />
          </>
        )}
        {akses?.kind === 'terkirim' && <Terkirim row={data.isian[akses.peran]!} />}

        {/* Staff: both berita acara, the combined result and Super Admin's override. Read-only. */}
        {!dosen && (
          <>
            <section className="mb-[1.6rem]">
              <p className={KOTAK}>
                <span className="block text-[0.73rem] uppercase tracking-[0.04em] text-[var(--tinta-3)]">Status prasidang mahasiswa</span>
                <span className="font-semibold">{STATUS_LABEL[data.status]}</span>
                {data.keputusan && (
                  <span className="block mt-[0.3rem] text-[0.87rem] text-[var(--tinta-2)]">
                    Keputusan Super Admin: {HASIL_LABEL[data.keputusan.hasil]} — {data.keputusan.alasan}
                  </span>
                )}
                {canManage(user.role) && (
                  <Link href="/s1/mahasiswa" className="block mt-[0.4rem] text-[0.87rem]">Ubah keputusan di Data Mahasiswa</Link>
                )}
              </p>
            </section>
            {PERAN_PRASIDANG.map((peran) => (
              <section key={peran} className="mb-[1.6rem]">
                <h2 className="m-0 mb-[0.6rem] text-[1.2rem] font-semibold tracking-[-0.01em]">
                  {PERAN_PRASIDANG_LABEL[peran]} <span className="text-[0.87rem] font-normal text-[var(--tinta-3)]">· {data.dosen[peran]}</span>
                </h2>
                {data.isian[peran] ? <Terkirim row={data.isian[peran]!} /> : <p className="m-0 text-[0.93rem] text-[var(--tinta-3)]">Belum diisi.</p>}
              </section>
            ))}
          </>
        )}
      </main>
    </div>
  )
}

/** A submitted berita acara, read-only: the questions it was answered against, never the current list. */
function Terkirim({ row }: { row: BeritaAcaraRow }) {
  return (
    <div>
      <p className="m-0 mb-[0.6rem] text-[0.87rem] text-[var(--tinta-3)]">Dikirim {waktu(row.submitted_at)}</p>
      <ol className="m-0 p-0 list-none border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] divide-y divide-[var(--garis)] text-[0.93rem]">
        {row.jawaban.map((j, i) => (
          <li key={i} className="p-[0.9rem]">
            <p className="m-0 font-medium">{j.teks}</p>
            {j.jenis === 'uraian' ? (
              <p className="m-0 mt-[0.2rem] whitespace-pre-line">{j.catatan}</p>
            ) : (
              <>
                <p className="m-0 mt-[0.2rem]">{j.ya ? 'Ya' : 'Tidak'}</p>
                {j.catatan && <p className="m-0 mt-[0.2rem] text-[var(--tinta-2)] whitespace-pre-line">{j.catatan}</p>}
              </>
            )}
          </li>
        ))}
      </ol>
      <p className="m-0 mt-[1rem]">
        <span className="block text-[0.73rem] uppercase tracking-[0.04em] text-[var(--tinta-3)]">Hasil prasidang</span>
        <span className="text-[1.2rem] font-semibold">{HASIL_LABEL[row.hasil]}</span>
      </p>
    </div>
  )
}
