import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AkunLain } from '@/components/AkunLain'
import { AppHeader } from '@/components/AppHeader'
import { getCurrentUser, canManage, isPenguji } from '@/lib/roles'
import { tanggalPanjang } from '@/lib/hari'
import { aksesBimbingan, penilaianPath, PERAN_LABEL, peranBimbingan, todayJakarta, type Peran } from '@/lib/penilaian/akses'
import type { BarisNilai } from '@/lib/penilaian/aturan'
import { loadPenilaian, type NilaiRow } from '@/lib/penilaian/data'
import { baris, formatNilai } from '@/lib/penilaian/nilai'
import { editNilaiAction, inputNilaiAdminAction, submitNilaiAction } from '../actions'
import { NilaiForm } from './NilaiForm'

const PERAN: Peran[] = ['pembimbing_1', 'pembimbing_2']
const waktu = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso))
const nilaiHuruf = (n: number, tabel: BarisNilai[]) => `${formatNilai(n)} · ${baris(n, tabel).huruf}`
const KOTAK = 'm-0 p-[1rem] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] text-[0.93rem]'

export default async function NilaiBimbinganPage(props: PageProps<'/nilai-bimbingan/[defenseId]'>) {
  const { defenseId } = await props.params
  const path = penilaianPath(defenseId)
  const user = await getCurrentUser()
  if (!user) redirect(`/masuk?redirectTo=${encodeURIComponent(path)}`)
  // An examiner (DOSEN or EKSTERNAL) is never staff here; an EKSTERNAL never grades bimbingan (the proxy keeps it away too).
  const dosen = isPenguji(user.role)
  if (dosen && (user.role !== 'DOSEN' || !user.kodeDosen)) return <AkunLain email={user.email} path={path} />

  const data = await loadPenilaian(defenseId)
  const akses = dosen
    ? aksesBimbingan(data?.defense ?? null, user.kodeDosen!, {
      submitted: new Set(Object.keys(data?.nilai ?? {}) as Peran[]),
      kunci: data?.kunci ?? null,
      today: todayJakarta(),
      batasHari: data?.aturan.batasHariBimbingan ?? 0,
    })
    : null
  // Not the student's Pembimbing on this S1 sidang (or none at all): the signed-in-as card, with no hint the record exists.
  if (!data || akses?.kind === 'tidak-ada') return <AkunLain email={user.email} path={path} />

  const { defense, aturan } = data
  const tabel = aturan.tabelNilai
  // What the form shows; the action refuses the grade if the list changed before submit.
  const tampil = aturan.aspekBimbingan.map((a): [string, number] => [a.label, a.bobot])
  const fakta: [string, React.ReactNode][] = [
    ['NPM', <span key="npm" className="mono">{defense.npm}</span>],
    ['Nama', defense.nama_mahasiswa],
    ['Judul skripsi', defense.judul_skripsi || '—'],
    ['IPK sebelum sidang', <span key="ipk" className="mono">{data.ipk === null ? '—' : formatNilai(data.ipk)}</span>],
    ['Tanggal sidang', tanggalPanjang(defense.tanggal, false)],
  ]
  const peranSaya = dosen ? peranBimbingan(defense, user.kodeDosen!) : null
  if (peranSaya) fakta.push(['Peran Anda', `${data.dosen[peranSaya]} (${PERAN_LABEL[peranSaya]})`])

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

        {akses?.kind === 'menunggu-kunci' && <p className={KOTAK}>Penilaian bimbingan dibuka setelah sidang dikunci Ketua.</p>}
        {akses?.kind === 'tidak-lulus' && <p className={KOTAK}>Sidang tidak lulus: nilai bimbingan tidak dibuka.</p>}
        {akses?.kind === 'lewat' && (
          <p className={KOTAK}>Batas pengisian sudah lewat (<strong>{tanggalPanjang(akses.batas, false)}</strong>). Hubungi admin akademik.</p>
        )}
        {akses?.kind === 'isi' && (
          <p className="m-0 mb-[0.8rem] text-[0.87rem] text-[var(--tinta-2)]">Batas pengisian: <strong>{tanggalPanjang(akses.batas, false)}</strong></p>
        )}
        {akses?.kind === 'isi' && (
          <NilaiForm
            aspek={aturan.aspekBimbingan}
            tabel={tabel}
            aksi={submitNilaiAction.bind(null, defense.id, akses.peran, tampil)}
            tombol="Kirim nilai"
            konfirmasi={{ judul: 'Kirim nilai?', isi: 'Setelah dikirim, nilai tidak bisa diubah.', tombol: 'Kirim nilai' }}
          />
        )}
        {akses?.kind === 'terkirim' && <Terkirim row={data.nilai[akses.peran]!} tabel={tabel} />}

        {/* Staff: both dosen's grades. Only Super Admin writes, at any time: edits a submitted grade, or enters a missing one. */}
        {!dosen && defense.tanpa_pembimbing_2 && (
          <p className="m-0 mb-[1rem] text-[0.93rem] text-[var(--tinta-2)]">
            Tanpa Dosen Pembimbing II: Nilai Bimbingan = nilai Pembimbing I.
          </p>
        )}
        {!dosen &&
          PERAN.filter((p) => !(p === 'pembimbing_2' && defense.tanpa_pembimbing_2)).map((peran) => {
            const row = data.nilai[peran]
            const kode = peran === 'pembimbing_1' ? defense.pembimbing_1_kode : defense.pembimbing_2_kode
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
                ) : canManage(user.role) && kode ? (
                  <>
                    <p className="m-0 mb-[0.6rem] text-[0.87rem] text-[var(--tinta-3)]">Belum dinilai. Super Admin dapat memasukkan nilai kapan saja.</p>
                    <h3 className="m-0 mb-[0.6rem] text-[0.93rem] font-semibold">Masukkan nilai</h3>
                    <NilaiForm
                      aspek={aturan.aspekBimbingan}
                      tabel={tabel}
                      aksi={inputNilaiAdminAction.bind(null, defense.id, peran, tampil)}
                      tombol="Simpan nilai"
                      konfirmasi={{ judul: 'Simpan nilai?', isi: `Nilai dicatat sebagai input admin untuk ${data.dosen[peran]}.`, tombol: 'Simpan' }}
                    />
                  </>
                ) : (
                  <p className="m-0 text-[0.93rem] text-[var(--tinta-3)]">
                    {kode ? 'Belum dinilai.' : 'Dosen Pembimbing untuk peran ini belum diisi di Data Mahasiswa.'}
                  </p>
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
      {row.sumber === 'manual' && ' (input admin)'}
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
