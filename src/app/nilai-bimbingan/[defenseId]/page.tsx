import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { getCurrentUser, canManage, isDosen } from '@/lib/roles'
import { tanggalPanjang } from '@/lib/hari'
import { aksesDosen, bolehInputLama, penilaianPath, PERAN_LABEL, peranDosen, todayJakarta, type Peran } from '@/lib/penilaian/akses'
import type { BarisNilai } from '@/lib/penilaian/aturan'
import { loadPenilaian, type NilaiRow } from '@/lib/penilaian/data'
import { baris, formatNilai } from '@/lib/penilaian/nilai'
import { editNilaiAction, inputNilaiLamaAction, submitNilaiAction } from '../actions'
import { NilaiForm } from './NilaiForm'

const PERAN: Peran[] = ['pembimbing_1', 'pembimbing_2']
const waktu = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso))
const nilaiHuruf = (n: number, tabel: BarisNilai[]) => `${formatNilai(n)} · ${baris(n, tabel).huruf}`

export default async function NilaiBimbinganPage(props: PageProps<'/nilai-bimbingan/[defenseId]'>) {
  const { defenseId } = await props.params
  const path = penilaianPath(defenseId)
  const user = await getCurrentUser()
  if (!user) redirect(`/masuk?redirectTo=${encodeURIComponent(path)}`)
  const dosen = isDosen(user.role)
  if (dosen && !user.kodeDosen) notFound()

  const data = await loadPenilaian(defenseId)
  const akses = dosen
    ? aksesDosen(data?.defense ?? null, user.kodeDosen!, new Set(Object.keys(data?.nilai ?? {}) as Peran[]), todayJakarta())
    : null
  // Not this dosen's S1 prasidang (or none at all): 404 with no hint the record exists.
  if (!data || akses?.kind === 'tidak-ada') notFound()

  const { defense, aturan } = data
  const tabel = aturan.tabelNilai
  const fakta: [string, React.ReactNode][] = [
    ['NPM', <span key="npm" className="mono">{defense.npm}</span>],
    ['Nama', defense.nama_mahasiswa],
    ['Judul skripsi', defense.judul_skripsi || '—'],
    ['IPK sebelum sidang', <span key="ipk" className="mono">{data.ipk === null ? '—' : formatNilai(data.ipk)}</span>],
    ['Tanggal prasidang', tanggalPanjang(defense.tanggal, false)],
  ]
  const peranSaya = dosen ? peranDosen(defense, user.kodeDosen!) : null
  if (peranSaya) fakta.push(['Peran Anda', PERAN_LABEL[peranSaya]])

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active={path} />
      <main className="flex-1 w-full max-w-[52rem] mx-auto px-[1.3rem] py-[1.6rem]">
        {dosen && (
          <Link href="/penilaian" className="text-[0.87rem] text-[var(--tinta-2)] hover:underline">‹ Penilaian Saya</Link>
        )}
        <h1 className="m-0 mt-[0.4rem] text-[1.6rem] font-semibold tracking-[-0.02em]">Nilai Bimbingan</h1>
        <dl className="m-0 mt-[1rem] mb-[1.6rem] grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-x-[1rem] gap-y-[0.4rem] text-[0.93rem]">
          {fakta.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-[0.73rem] uppercase tracking-[0.04em] text-[var(--tinta-3)] sm:pt-[0.2rem]">{k}</dt>
              <dd className="m-0 mb-[0.4rem] sm:mb-0">{v}</dd>
            </div>
          ))}
        </dl>

        {akses?.kind === 'belum-dibuka' && (
          <p className="m-0 p-[1rem] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] text-[0.93rem]">
            Penilaian dibuka pada <strong>{tanggalPanjang(akses.tanggal, false)}</strong>.
          </p>
        )}
        {akses?.kind === 'isi' && (
          <NilaiForm
            aspek={aturan.aspekBimbingan}
            tabel={tabel}
            aksi={submitNilaiAction.bind(null, defense.id, akses.peran)}
            tombol="Kirim nilai"
            konfirmasi={{ judul: 'Kirim nilai?', isi: 'Setelah dikirim, nilai tidak bisa diubah.', tombol: 'Kirim nilai' }}
          />
        )}
        {akses?.kind === 'terkirim' && <Terkirim row={data.nilai[akses.peran]!} tabel={tabel} />}

        {/* Staff: both dosen's grades. Only Super Admin writes: edits a submitted grade, or enters an old one. */}
        {!dosen &&
          PERAN.map((peran) => {
            const row = data.nilai[peran]
            const kode = peran === 'pembimbing_1' ? defense.pembimbing_kode : defense.penguji_kode
            return (
              <section key={peran} className="mb-[1.6rem]">
                <h2 className="m-0 mb-[0.6rem] text-[1.2rem] font-semibold tracking-[-0.01em]">
                  {PERAN_LABEL[peran]} <span className="text-[0.87rem] font-normal text-[var(--tinta-3)]">· {data.dosen[peran]}</span>
                </h2>
                {row && canManage(user.role) ? (
                  <>
                    <Meta row={row} />
                    <NilaiForm
                      aspek={row.aspek}
                      awal={row.aspek.map((a) => a.skor)}
                      tabel={tabel}
                      aksi={editNilaiAction.bind(null, row.id)}
                      tombol="Simpan perubahan"
                      konfirmasi={{ judul: 'Simpan perubahan nilai?', isi: 'Nilai sebelumnya diganti. Perubahan tercatat di Log Aktivitas.', tombol: 'Simpan' }}
                    />
                  </>
                ) : row ? (
                  <Terkirim row={row} tabel={tabel} />
                ) : canManage(user.role) && kode && bolehInputLama(defense, aturan.tanggalMulai) ? (
                  <>
                    <p className="m-0 mb-[0.6rem] text-[0.87rem] text-[var(--tinta-3)]">
                      Belum dinilai. Prasidang ini sebelum tanggal mulai penilaian, jadi nilainya dapat disalin dari berkas lama.
                    </p>
                    <h3 className="m-0 mb-[0.6rem] text-[0.93rem] font-semibold">Masukkan nilai lama</h3>
                    <NilaiForm
                      aspek={aturan.aspekBimbingan}
                      tabel={tabel}
                      aksi={inputNilaiLamaAction.bind(null, defense.id, peran)}
                      tombol="Simpan nilai lama"
                      konfirmasi={{ judul: 'Simpan nilai lama?', isi: `Nilai dicatat sebagai input manual untuk ${data.dosen[peran]}.`, tombol: 'Simpan' }}
                    />
                  </>
                ) : (
                  <p className="m-0 text-[0.93rem] text-[var(--tinta-3)]">Belum dinilai.</p>
                )}
              </section>
            )
          })}
      </main>
    </div>
  )
}

function Meta({ row }: { row: NilaiRow }) {
  return (
    <p className="m-0 mb-[0.6rem] text-[0.87rem] text-[var(--tinta-3)]">
      Dikirim {waktu(row.submitted_at)}
      {row.sumber === 'manual' && ' (input manual)'}
    </p>
  )
}

/** A submitted grade, read-only: the snapshot rows it was scored against, never the current list. */
function Terkirim({ row, tabel }: { row: NilaiRow; tabel: BarisNilai[] }) {
  return (
    <div>
      <Meta row={row} />
      <table className="w-full border-collapse border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] text-[0.93rem]">
        <thead className="bg-[var(--cekung)] text-[0.73rem] uppercase tracking-[0.04em] text-[var(--tinta-3)]">
          <tr>
            <th className="text-left font-medium px-[0.53rem] py-[0.4rem]">Aspek</th>
            <th className="text-right font-medium px-[0.53rem] py-[0.4rem]">Bobot</th>
            <th className="text-right font-medium px-[0.53rem] py-[0.4rem]">Skor</th>
          </tr>
        </thead>
        <tbody>
          {row.aspek.map((a, i) => (
            <tr key={i} className="border-t border-[var(--garis)]">
              <td className="px-[0.53rem] py-[0.4rem]">{a.label}</td>
              <td className="px-[0.53rem] py-[0.4rem] text-right mono">{a.bobot}%</td>
              <td className="px-[0.53rem] py-[0.4rem] text-right mono">{formatNilai(a.skor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="m-0 mt-[1rem]">
        <span className="block text-[0.73rem] uppercase tracking-[0.04em] text-[var(--tinta-3)]">Nilai</span>
        <span className="mono text-[1.87rem] font-semibold leading-none">{nilaiHuruf(row.nilai, tabel)}</span>
      </p>
    </div>
  )
}
