import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { getCurrentUser, canManage, isPenguji } from '@/lib/roles'
import { canAccessProdi } from '@/lib/prodi'
import { tanggalPanjang } from '@/lib/hari'
import {
  ANGGOTA_I_LEGACY, aksesSidang, bolehInputLamaSidang, PERAN_SIDANG, PERAN_SIDANG_LABEL, penilaianSidangPath, peranPenguji,
  todayJakarta, type PeranSidang,
} from '@/lib/penilaian/akses'
import type { BarisNilai } from '@/lib/penilaian/aturan'
import { identitasPenguji, loadSidang, type HasilRow, type NilaiSidangRow } from '@/lib/penilaian/data'
import { baris, formatNilai, nilaiSidang } from '@/lib/penilaian/nilai'
import {
  editNilaiSidangAction, editYudisiumAction, inputNilaiSidangLamaAction, kunciSidangAction, kunciSidangLamaAction,
  submitNilaiSidangAction,
} from '../actions'
import { PengujiForm } from './PengujiForm'
import { YudisiumForm } from './YudisiumForm'

const waktu = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso))
const nilaiHuruf = (n: number, tabel: BarisNilai[]) => `${formatNilai(n)} · ${baris(n, tabel).huruf}`
const H2 = 'm-0 mb-[0.6rem] text-[1.2rem] font-semibold tracking-[-0.01em]'
const KOTAK = 'm-0 p-[1rem] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] text-[0.93rem]'
const KECIL = 'block text-[0.73rem] uppercase tracking-[0.04em] text-[var(--tinta-3)]'
const TH = 'font-medium px-[0.53rem] py-[0.4rem]'
const TD = 'px-[0.53rem] py-[0.4rem]'

export default async function NilaiSidangPage(props: PageProps<'/nilai-sidang/[defenseId]'>) {
  const { defenseId } = await props.params
  const path = penilaianSidangPath(defenseId)
  const user = await getCurrentUser()
  if (!user) redirect(`/masuk?redirectTo=${encodeURIComponent(path)}`)
  // A DOSEN or EKSTERNAL is an examiner, never staff, even when it can't grade (no kode, no day account).
  const penguji = isPenguji(user.role)
  const saya = penguji ? await identitasPenguji(user) : null
  if (penguji ? !saya : !canAccessProdi(user.prodiAccess, 's1')) notFound()

  const data = await loadSidang(defenseId)
  const akses = saya
    ? aksesSidang(data?.defense ?? null, saya.kode, {
      submitted: new Set(Object.keys(data?.nilai ?? {}) as PeranSidang[]),
      locked: !!data?.hasil,
      today: todayJakarta(),
      akunTanggal: saya.akunTanggal,
    })
    : null
  // Not this examiner's S1 sidang (or another day's, or none at all): 404 with no hint the record exists.
  if (!data || akses?.kind === 'tidak-ada') notFound()

  const { defense, aturan, hasil } = data
  // A locked sidang's letters come from its frozen table; an unusable frozen copy falls back to the current one.
  const tabel = hasil?.aturan?.tabelNilai ?? aturan.tabelNilai
  // What the form shows; the action refuses the grade if the list changed before submit.
  const tampil = aturan.aspekSidang.map((a): [string, number] => [a.label, a.bobot])
  const legacy = !defense.penguji_eksternal_kode
  const peranSaya = saya ? peranPenguji(defense, saya.kode) : null
  const nSidang = nilaiSidang(PERAN_SIDANG.map((p) => data.nilai[p]?.nilai ?? null))
  const fakta: [string, React.ReactNode][] = [
    ['NPM', <span key="npm" className="mono">{defense.npm}</span>],
    ['Nama', defense.nama_mahasiswa],
    ['Judul skripsi', defense.judul_skripsi || '—'],
    ['IPK sebelum sidang', <span key="ipk" className="mono">{data.student.ipk === null ? '—' : formatNilai(data.student.ipk)}</span>],
    ['Tanggal sidang', tanggalPanjang(defense.tanggal, false)],
  ]
  if (peranSaya) fakta.push(['Peran Anda', PERAN_SIDANG_LABEL[peranSaya]])

  const judulPeran = (peran: PeranSidang) => (
    <h2 className={H2}>
      {PERAN_SIDANG_LABEL[peran]} <span className="text-[0.87rem] font-normal text-[var(--tinta-3)]">· {data.dosen[peran]}</span>
    </h2>
  )

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active={path} />
      <main className="flex-1 w-full max-w-[52rem] mx-auto px-[1.3rem] py-[1.6rem]">
        {penguji && (
          <Link href="/penilaian" className="text-[0.87rem] text-[var(--tinta-2)] hover:underline">‹ Penilaian Saya</Link>
        )}
        <h1 className="m-0 mt-[0.4rem] text-[1.6rem] font-semibold tracking-[-0.02em]">Nilai Sidang</h1>
        <dl className="m-0 mt-[1rem] mb-[1.6rem] grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-x-[1rem] gap-y-[0.4rem] text-[0.93rem]">
          {fakta.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-[0.73rem] uppercase tracking-[0.04em] text-[var(--tinta-3)] sm:pt-[0.2rem]">{k}</dt>
              <dd className="m-0 mb-[0.4rem] sm:mb-0">{v}</dd>
            </div>
          ))}
        </dl>

        {akses?.kind === 'belum-dibuka' && (
          <p className={KOTAK}>Penilaian dibuka pada <strong>{tanggalPanjang(akses.tanggal, false)}</strong>.</p>
        )}
        {akses?.kind === 'isi' && (
          <PengujiForm
            aspek={aturan.aspekSidang}
            tabel={tabel}
            aksi={submitNilaiSidangAction.bind(null, defense.id, akses.peran, tampil)}
            tombol="Kirim nilai"
            konfirmasi={{ judul: 'Kirim nilai?', isi: 'Setelah dikirim, nilai tidak bisa diubah.', tombol: 'Kirim nilai' }}
          />
        )}
        {akses?.kind === 'terkirim' && <Terkirim row={data.nilai[akses.peran]!} tabel={tabel} />}
        {akses?.kind === 'menunggu-anggota' && (
          <p className={KOTAK}>
            {legacy ? `${ANGGOTA_I_LEGACY}. Sidang belum dapat dikunci.` : `Menunggu ${akses.kurang.map((p) => PERAN_SIDANG_LABEL[p]).join(' dan ')}.`}
          </p>
        )}
        {/* The Ketua: both anggota's grades and revisi, then its own grade with the yudisium, sent and locked in one go. */}
        {akses?.kind === 'kunci' && (
          <>
            {(['anggota_1', 'anggota_2'] as const).map((p) => (
              <section key={p} className="mb-[1.6rem]">
                {judulPeran(p)}
                <Terkirim row={data.nilai[p]!} tabel={tabel} />
              </section>
            ))}
            <section>
              <h2 className={H2}>Nilai Anda</h2>
              <PengujiForm
                aspek={aturan.aspekSidang}
                tabel={tabel}
                yudisium={aturan.pilihanYudisium}
                aksi={kunciSidangAction.bind(null, defense.id, tampil)}
                tombol="Kirim nilai dan kunci"
                konfirmasi={{ judul: 'Kirim nilai dan kunci sidang?', isi: 'Setelah dikunci, nilai sidang tidak bisa diubah.', tombol: 'Kirim nilai dan kunci' }}
              />
            </section>
          </>
        )}
        {/* Locked: the result, and the grades this examiner may read (the Ketua all three, an anggota its own). */}
        {akses?.kind === 'terkunci' && peranSaya && (
          <>
            <Hasil hasil={hasil!} nilaiSidang={peranSaya === 'ketua' ? nSidang : null} tabel={tabel} />
            {(peranSaya === 'ketua' ? PERAN_SIDANG : [peranSaya]).map((p) =>
              data.nilai[p] ? (
                <section key={p} className="mb-[1.6rem]">
                  {judulPeran(p)}
                  <Terkirim row={data.nilai[p]} tabel={tabel} />
                </section>
              ) : null,
            )}
          </>
        )}

        {/* Staff: all three grades and the result. Only Super Admin writes: edits, or enters an old sidang's grades and locks it. */}
        {!penguji && (
          <>
            {PERAN_SIDANG.map((peran) => {
              const row = data.nilai[peran]
              const kode = peran === 'ketua' ? defense.penguji_kode : peran === 'anggota_1' ? defense.penguji_eksternal_kode : defense.pembimbing_kode
              return (
                <section key={peran} className="mb-[1.6rem]">
                  {judulPeran(peran)}
                  {row && canManage(user.role) ? (
                    <>
                      <Meta row={row} />
                      <PengujiForm
                        aspek={row.aspek}
                        awal={{ skor: row.aspek.map((a) => a.skor), adaRevisi: row.ada_revisi, revisi: row.revisi }}
                        tabel={tabel}
                        aksi={editNilaiSidangAction.bind(null, row.id)}
                        tombol="Simpan perubahan"
                        konfirmasi={{ judul: 'Simpan perubahan nilai?', isi: 'Nilai dan revisi sebelumnya diganti. Email revisi tidak dikirim ulang. Perubahan tercatat di Log Aktivitas.', tombol: 'Simpan' }}
                      />
                    </>
                  ) : row ? (
                    <Terkirim row={row} tabel={tabel} />
                  ) : peran === 'anggota_1' && legacy ? (
                    <p className="m-0 text-[0.93rem] text-[var(--tinta-3)]">{ANGGOTA_I_LEGACY}.</p>
                  ) : canManage(user.role) && kode && !hasil && bolehInputLamaSidang(defense, aturan.tanggalMulai) ? (
                    <>
                      <p className="m-0 mb-[0.6rem] text-[0.87rem] text-[var(--tinta-3)]">
                        Belum dinilai. Sidang ini sebelum tanggal mulai penilaian, jadi nilainya dapat disalin dari berkas lama.
                      </p>
                      <h3 className="m-0 mb-[0.6rem] text-[0.93rem] font-semibold">Masukkan nilai lama</h3>
                      <PengujiForm
                        aspek={aturan.aspekSidang}
                        tabel={tabel}
                        aksi={inputNilaiSidangLamaAction.bind(null, defense.id, peran, tampil)}
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

            <section className="mb-[1.6rem]">
              <h2 className={H2}>Hasil sidang</h2>
              {hasil ? (
                <>
                  <Hasil hasil={hasil} nilaiSidang={nSidang} tabel={tabel} />
                  {canManage(user.role) && (
                    <YudisiumForm
                      pilihan={aturan.pilihanYudisium}
                      awal={hasil.yudisium_label}
                      aksi={editYudisiumAction.bind(null, defense.id)}
                      tombol="Simpan yudisium"
                      konfirmasi={{ judul: 'Ubah yudisium?', isi: 'Email revisi tidak dikirim ulang. Perubahan tercatat di Log Aktivitas.', tombol: 'Simpan' }}
                    />
                  )}
                </>
              ) : canManage(user.role) && bolehInputLamaSidang(defense, aturan.tanggalMulai) && PERAN_SIDANG.every((p) => data.nilai[p]) ? (
                <YudisiumForm
                  pilihan={aturan.pilihanYudisium}
                  aksi={kunciSidangLamaAction.bind(null, defense.id)}
                  tombol="Kunci sidang"
                  konfirmasi={{ judul: 'Kunci sidang?', isi: 'Setelah dikunci, nilai sidang tidak bisa diubah. Email revisi tidak dikirim untuk sidang lama.', tombol: 'Kunci sidang' }}
                />
              ) : (
                <p className="m-0 text-[0.93rem] text-[var(--tinta-3)]">
                  {legacy ? `Belum dikunci. ${ANGGOTA_I_LEGACY}.` : 'Belum dikunci.'}
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

/** The locked result. nilaiSidang is shown only to those who may read all three grades. */
function Hasil({ hasil, nilaiSidang: ns, tabel }: { hasil: HasilRow; nilaiSidang: number | null; tabel: BarisNilai[] }) {
  return (
    <div className="mb-[1.6rem] flex flex-wrap gap-x-[2rem] gap-y-[0.8rem] p-[1rem] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)]">
      <p className="m-0">
        <span className={KECIL}>Yudisium</span>
        <span className="text-[1.1rem] font-semibold">{hasil.yudisium_label}</span>
      </p>
      {ns !== null && (
        <p className="m-0">
          <span className={KECIL}>Nilai Sidang</span>
          <span className="mono text-[1.1rem] font-semibold">{nilaiHuruf(ns, tabel)}</span>
        </p>
      )}
      <p className="m-0">
        <span className={KECIL}>Dikunci</span>
        <span className="text-[0.93rem]">{waktu(hasil.locked_at)}</span>
      </p>
    </div>
  )
}

function Meta({ row }: { row: NilaiSidangRow }) {
  return (
    <p className="m-0 mb-[0.6rem] text-[0.87rem] text-[var(--tinta-3)]">
      Dikirim {waktu(row.submitted_at)}
      {row.sumber === 'manual' && ' (input manual)'}
    </p>
  )
}

/** A submitted grade, read-only: its snapshot rows (never the current list), the nilai, then its revisi. */
function Terkirim({ row, tabel }: { row: NilaiSidangRow; tabel: BarisNilai[] }) {
  return (
    <div>
      <Meta row={row} />
      <table className="w-full border-collapse border border-[var(--garis-kuat)] bg-[var(--lembar)] text-[0.93rem]">
        <thead className="bg-[var(--cekung)] text-[0.73rem] uppercase tracking-[0.04em] text-[var(--tinta-3)]">
          <tr>
            <th className={`text-left ${TH}`}>Aspek</th>
            <th className={`text-right ${TH}`}>Bobot</th>
            <th className={`text-right ${TH}`}>Skor</th>
          </tr>
        </thead>
        <tbody>
          {row.aspek.map((a, i) => (
            <tr key={i} className="border-t border-[var(--garis)]">
              <td className={TD}>{a.label}</td>
              <td className={`${TD} text-right mono`}>{a.bobot}%</td>
              <td className={`${TD} text-right mono`}>{formatNilai(a.skor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="m-0 mt-[1rem]">
        <span className={KECIL}>Nilai</span>
        <span className="mono text-[1.87rem] font-semibold leading-none">{nilaiHuruf(row.nilai, tabel)}</span>
      </p>
      <h3 className="m-0 mt-[1rem] mb-[0.4rem] text-[0.93rem] font-semibold">Revisi</h3>
      {row.ada_revisi ? (
        <table className="w-full border-collapse border border-[var(--garis-kuat)] bg-[var(--lembar)] text-[0.93rem]">
          <thead className="bg-[var(--cekung)] text-[0.73rem] uppercase tracking-[0.04em] text-[var(--tinta-3)]">
            <tr>
              <th className={`text-left w-[7rem] ${TH}`}>Halaman</th>
              <th className={`text-left ${TH}`}>Catatan revisi</th>
            </tr>
          </thead>
          <tbody>
            {row.revisi.map((r, i) => (
              <tr key={i} className="border-t border-[var(--garis)] align-top">
                <td className={`${TD} mono`}>{r.halaman || '—'}</td>
                <td className={`${TD} whitespace-pre-line`}>{r.catatan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="m-0 text-[0.93rem] text-[var(--tinta-3)]">Tidak ada revisi.</p>
      )}
    </div>
  )
}
