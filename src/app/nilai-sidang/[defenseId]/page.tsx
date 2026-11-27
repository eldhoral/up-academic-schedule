import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AkunLain } from '@/components/AkunLain'
import { AppShell } from '@/components/AppShell'
import { KotakNilai } from '@/components/KotakNilai'
import { getCurrentUser, canManage, isPenguji } from '@/lib/roles'
import { canAccessProdi } from '@/lib/prodi'
import { tanggalPanjang } from '@/lib/hari'
import {
  adminSidang, ANGGOTA_I_LEGACY, aksesSidang, PERAN_SIDANG, PERAN_SIDANG_LABEL, penilaianSidangPath, peranPenguji,
  todayJakarta, type PeranSidang,
} from '@/lib/penilaian/akses'
import type { BarisNilai } from '@/lib/penilaian/aturan'
import { identitasPenguji, loadSidang, type HasilRow, type NilaiSidangRow } from '@/lib/penilaian/data'
import { baris, formatNilai, nilaiSidang } from '@/lib/penilaian/nilai'
import { ALASAN_ATURAN_RUSAK, bolehKirimUlang, EMAIL_LABEL } from '@/lib/penilaian/rekap'
import { hasilBeritaAcara } from '@/lib/penilaian/berita-acara-sidang'
import { KirimUlang } from '@/app/[prodi]/sidang/nilai-akhir/KirimUlang'
import {
  editNilaiSidangAction, editYudisiumAction, inputNilaiSidangAdminAction, kunciSidangAction, kunciSidangAdminAction,
  submitNilaiSidangAction,
} from '../actions'
import { Grafik, WARNA_PERAN } from './Grafik'
import { LiveSidang } from './LiveSidang'
import { PengujiForm } from './PengujiForm'
import { Unvalidasi } from './Unvalidasi'
import { YudisiumForm } from './YudisiumForm'

const waktu = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso))
const nilaiHuruf = (n: number, tabel: BarisNilai[]) => `${formatNilai(n)} · ${baris(n, tabel).huruf}`
const H2 = 'm-0 mb-[0.6rem] text-[1.2rem] font-semibold tracking-[-0.01em]'
const KOTAK = 'm-0 p-[1rem] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] text-[0.93rem]'
const KECIL = 'block text-[0.73rem] uppercase tracking-[0.04em] text-[var(--tinta-3)]'
const TH = 'font-medium px-[0.53rem] py-[0.4rem]'
const TD = 'px-[0.53rem] py-[0.4rem]'
const UNDUH = 'inline-block px-[0.8rem] py-[0.45rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[var(--tinta)] text-[0.87rem] font-medium no-underline hover:bg-[var(--cekung)]'

export default async function NilaiSidangPage(props: PageProps<'/nilai-sidang/[defenseId]'>) {
  const { defenseId } = await props.params
  const path = penilaianSidangPath(defenseId)
  const user = await getCurrentUser()
  if (!user) redirect(`/masuk?redirectTo=${encodeURIComponent(path)}`)
  // A DOSEN or EKSTERNAL is an examiner, never staff, even when it can't grade (no kode, no day account).
  const penguji = isPenguji(user.role)
  const saya = penguji ? await identitasPenguji(user) : null
  if (penguji ? !saya : !canAccessProdi(user.prodiAccess, 's1')) return <AkunLain email={user.email} path={path} />

  const data = await loadSidang(defenseId)
  const akses = saya
    ? aksesSidang(data?.defense ?? null, saya.kode, {
      submitted: new Set(Object.keys(data?.nilai ?? {}) as PeranSidang[]),
      locked: !!data?.hasil,
      today: todayJakarta(),
      akunTanggal: saya.akunTanggal,
    })
    : null
  // Not this examiner's S1 sidang (or another day's, or none at all): the signed-in-as card, with no hint the record exists.
  if (!data || akses?.kind === 'tidak-ada') return <AkunLain email={user.email} path={path} />

  const { defense, aturan, hasil } = data
  // A locked sidang's letters come from its frozen table. If that copy is unreadable we say so (as the recap does)
  // instead of showing letters from today's table.
  const rusak = !!hasil && !hasil.aturan
  const tabel = hasil?.aturan?.tabelNilai ?? aturan.tabelNilai
  // What the form shows; the action refuses the grade if the list changed before submit.
  const tampil = aturan.aspekSidang.map((a): [string, number] => [a.label, a.bobot])
  const legacy = !defense.penguji_eksternal_kode
  const peranSaya = saya ? peranPenguji(defense, saya.kode) : null
  const nSidang = nilaiSidang(PERAN_SIDANG.map((p) => data.nilai[p]?.nilai ?? null))
  const st = data.student
  // IPK after the sidang as the berita acara computes it (from Nilai Sidang, frozen rules); known once locked.
  const ba = hasil?.aturan
    ? hasilBeritaAcara({ nilai: PERAN_SIDANG.map((p) => data.nilai[p]?.nilai ?? null), aturan: hasil.aturan, lulus: hasil.yudisium_lulus, sks: st.sks, bobot: st.bobot, tepatWaktu: st.tepatWaktu }).ipk
    : null
  const ipk = {
    sebelum: st.ipk,
    setelah: ba && 'ipkSetelah' in ba ? ba.ipkSetelah : null,
    alasan: !hasil ? 'menunggu sidang dikunci' : ba && 'alasan' in ba ? ba.alasan : undefined,
  }
  const angka = (n: number | null, key: string) => <span key={key} className="mono">{n === null ? '—' : formatNilai(n)}</span>
  const fakta: [string, React.ReactNode][] = [
    ['NPM', <span key="npm" className="mono">{defense.npm}</span>],
    ['Nama', defense.nama_mahasiswa],
    ['Judul skripsi', defense.judul_skripsi || '—'],
    ['Tanggal sidang', `${tanggalPanjang(defense.tanggal, false)}${data.ruang ? ` · ${data.ruang}` : ''}`],
    ['Dosen Pembimbing I', st.pembimbing1 ?? '—'],
    ['Dosen Pembimbing II', st.pembimbing2 ?? '—'],
    ['SKS sebelum sidang', <span key="sks" className="mono">{st.sks ?? '—'}</span>],
    ['Bobot sebelum sidang', angka(st.bobot, 'bobot')],
    ['IPK sebelum sidang', angka(st.ipk, 'ipk')],
    ['Lulus tepat waktu', st.tepatWaktu ? 'Ya' : 'Tidak'],
  ]
  if (peranSaya) fakta.push(['Peran Anda', `${data.dosen[peranSaya]} (${PERAN_SIDANG_LABEL[peranSaya]})`])

  const judulPeran = (peran: PeranSidang) => (
    <h2 className={H2}>
      {PERAN_SIDANG_LABEL[peran]} <span className="text-[0.87rem] font-normal text-[var(--tinta-3)]">· {data.dosen[peran]}</span>
    </h2>
  )

  const kepala = (
    <>
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
    </>
  )
  if (rusak) {
    return (
      <AppShell active={path}>
        <main className="flex-1 w-full max-w-[52rem] mx-auto px-[1.3rem] py-[1.6rem]">
          {kepala}
          <p className={KOTAK}>{ALASAN_ATURAN_RUSAK}.</p>
        </main>
      </AppShell>
    )
  }

  return (
    <AppShell active={path}>
      <main className="flex-1 w-full max-w-[52rem] xl:max-w-[76rem] mx-auto px-[1.3rem] py-[1.6rem]">
        {kepala}

        {/* xl: Ketentuan umum stays in view on the right while scrolling (kiprat). Below xl it sits above the grades. */}
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-[1.6rem] xl:items-start">
          <details open className="mb-[1.6rem] xl:mb-0 xl:col-start-2 xl:row-start-1 xl:sticky xl:top-[1.6rem] xl:max-h-[calc(100vh-3.2rem)] xl:overflow-y-auto border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] p-[1rem]">
            <summary className="cursor-pointer text-[1.05rem] font-semibold">Ketentuan umum</summary>
            <ol className="m-0 mt-[0.6rem] pl-[1.2rem] space-y-[0.2rem] text-[0.87rem]">
              {aturan.ketentuanSidang.map((k, i) => <li key={i}>{k}</li>)}
            </ol>
            <div className="mt-[0.8rem] grid gap-[1rem] sm:grid-cols-2 xl:grid-cols-1 text-[0.87rem]">
              <div>
                <h3 className="m-0 mb-[0.3rem] text-[0.87rem] font-semibold">Konversi nilai</h3>
                <table className="w-full border-collapse border border-[var(--garis-kuat)]">
                  <thead className="bg-[var(--cekung)] text-[0.73rem] uppercase tracking-[0.04em] text-[var(--tinta-3)]">
                    <tr><th className={`text-left ${TH}`}>Angka</th><th className={`text-left ${TH}`}>Huruf</th></tr>
                  </thead>
                  <tbody>
                    {tabel.map((r, i) => (
                      <tr key={r.huruf} className="border-t border-[var(--garis)]">
                        <td className={`${TD} mono`}>{i === 0 ? `${formatNilai(r.min)}–100` : `${formatNilai(r.min)}–${formatNilai(tabel[i - 1].min - 0.01)}`}</td>
                        <td className={TD}>{r.huruf}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="m-0 mb-[0.3rem] text-[0.87rem] font-semibold">Predikat yudisium (IPK kelulusan)</h3>
                <ul className="m-0 pl-[1.1rem] space-y-[0.2rem]">
                  {(hasil?.aturan?.predikat ?? aturan.predikat).map((r) => (
                    <li key={r.predikat}>
                      <span className="mono">{formatNilai(r.min)}–{formatNilai(r.max)}</span> {r.predikat}
                      {r.butuhTepatWaktu && <span className="text-[var(--tinta-3)]"> (hanya bila lulus tepat waktu)</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </details>

          <div className="min-w-0 xl:col-start-1 xl:row-start-1">
            {!hasil && <LiveSidang defenseId={defense.id} />}

            {/* Every examiner and staff member sees the three sent grades, live (kiprat: they grade together). */}
            <section className="mb-[1.6rem]">
              <h2 className={H2}>Nilai penguji</h2>
              <div className="grid gap-[0.6rem] sm:grid-cols-3">
                {PERAN_SIDANG.map((p) => {
                  const row = data.nilai[p]
                  return (
                    <div key={p} className="border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] p-[0.8rem]" style={{ borderTop: `3px solid ${WARNA_PERAN[p]}` }}>
                      <p className="m-0 text-[0.8rem] text-[var(--tinta-3)]">{PERAN_SIDANG_LABEL[p]}</p>
                      <p className="m-0 text-[0.87rem] font-medium">{data.dosen[p]}</p>
                      <p className="m-0 mt-[0.4rem] mono text-[1.3rem] font-semibold">{row ? nilaiHuruf(row.nilai, tabel) : <span className="text-[0.87rem] font-normal text-[var(--tinta-3)]">belum dikirim</span>}</p>
                      {/* The Ketua sends an Anggota's grade back before locking (kiprat 2026-11-25). */}
                      {row && !hasil && peranSaya === 'ketua' && p !== 'ketua' && (
                        <Unvalidasi defenseId={defense.id} peran={p} label={PERAN_SIDANG_LABEL[p]} dosen={data.dosen[p]} />
                      )}
                    </div>
                  )
                })}
              </div>
              {nSidang !== null && (
                <p className="m-0 mt-[0.6rem] text-[0.93rem]">Nilai sidang (rata-rata): <span className="mono font-semibold">{nilaiHuruf(nSidang, tabel)}</span></p>
              )}
              {PERAN_SIDANG.some((p) => data.nilai[p]) && (
                <details className="mt-[0.8rem]">
                  <summary className="cursor-pointer text-[0.87rem] text-[var(--biru)]">Rincian aspek dan revisi tiap penguji</summary>
                  {PERAN_SIDANG.map((p) =>
                    data.nilai[p] ? (
                      <section key={p} className="mt-[1rem]">
                        {judulPeran(p)}
                        <Terkirim row={data.nilai[p]!} tabel={tabel} />
                      </section>
                    ) : null,
                  )}
                </details>
              )}
            </section>

            <Grafik
              nilai={Object.fromEntries(PERAN_SIDANG.flatMap((p) => (data.nilai[p] ? [[p, data.nilai[p]!.nilai]] : [])))}
              snapshot={Object.fromEntries(PERAN_SIDANG.flatMap((p) => (data.nilai[p] ? [[p, data.nilai[p]!.aspek]] : [])))}
              aspek={aturan.aspekSidang}
              ipk={ipk}
            />

            {akses?.kind === 'belum-dibuka' && (
              <p className={KOTAK}>Penilaian dibuka pada <strong>{tanggalPanjang(akses.tanggal, false)}</strong>.</p>
            )}
            {akses?.kind === 'isi' && (
              <section className="mb-[1.6rem]">
                <h2 className={H2}>Nilai Anda</h2>
                <PengujiForm
                  aspek={aturan.aspekSidang}
                  tabel={tabel}
                  pembanding={PERAN_SIDANG.flatMap((p) => (p !== akses.peran && data.nilai[p] ? [data.nilai[p]!.nilai] : []))}
                  aksi={submitNilaiSidangAction.bind(null, defense.id, akses.peran, tampil)}
                  tombol="Validasi"
                  konfirmasi={{ judul: 'Validasi nilai?', isi: 'Setelah divalidasi, nilai tidak bisa diubah.', tombol: 'Validasi' }}
                />
              </section>
            )}
            {akses?.kind === 'terkirim' && <p className={KOTAK}>Nilai Anda sudah dikirim. Ketua Sidang mengunci setelah ketiga nilai masuk.</p>}
            {/* The Ketua, own grade sent: waits for the anggota, then picks the yudisium and locks. */}
            {akses?.kind === 'menunggu-anggota' && (
              <p className={KOTAK}>
                {legacy ? `${ANGGOTA_I_LEGACY}. Sidang belum dapat dikunci.` : `Nilai Anda sudah dikirim. Menunggu ${akses.kurang.map((p) => PERAN_SIDANG_LABEL[p]).join(' dan ')} sebelum mengunci.`}
              </p>
            )}
            {akses?.kind === 'kunci' && (
              <section className="mb-[1.6rem]">
                <h2 className={H2}>Kunci sidang</h2>
                <p className="m-0 mb-[0.6rem] text-[0.87rem] text-[var(--tinta-2)]">Ketiga nilai sudah masuk. Periksa nilai di atas (Unvalidasi bila nilai Anggota perlu diisi ulang), lalu pilih yudisium dan kunci.</p>
                <YudisiumForm
                  pilihan={aturan.pilihanYudisium}
                  aksi={kunciSidangAction.bind(null, defense.id)}
                  tombol="Kunci sidang"
                  konfirmasi={{ judul: 'Kunci sidang?', isi: 'Setelah dikunci, nilai sidang tidak bisa diubah.', tombol: 'Kunci sidang' }}
                />
              </section>
            )}
            {akses?.kind === 'terkunci' && peranSaya && <Hasil hasil={hasil!} nilaiSidang={nSidang} tabel={tabel} />}

            {/* Staff: the result; Super Admin edits, enters any missing grade and locks, at any time. */}
            {!penguji && (
              <>
                {canManage(user.role) && PERAN_SIDANG.map((peran) => {
                  const row = data.nilai[peran]
                  const bisa = adminSidang(defense, new Set(Object.keys(data.nilai) as PeranSidang[]), !!hasil)
                  if (row) {
                    return (
                      <section key={peran} className="mb-[1.6rem]">
                        {judulPeran(peran)}
                        <Meta row={row} />
                        <PengujiForm
                          aspek={row.aspek}
                          awal={{ skor: row.aspek.map((a) => a.skor), adaRevisi: row.ada_revisi, revisi: row.revisi }}
                          tabel={tabel}
                          aksi={editNilaiSidangAction.bind(null, row.id)}
                          tombol="Simpan perubahan"
                          konfirmasi={{ judul: 'Simpan perubahan nilai?', isi: 'Nilai dan revisi sebelumnya diganti. Email revisi tidak dikirim ulang. Perubahan tercatat di Log Aktivitas.', tombol: 'Simpan' }}
                        />
                      </section>
                    )
                  }
                  if (!bisa.isi.includes(peran)) {
                    return peran === 'anggota_1' && legacy ? (
                      <section key={peran} className="mb-[1.6rem]">{judulPeran(peran)}<p className="m-0 text-[0.93rem] text-[var(--tinta-3)]">{ANGGOTA_I_LEGACY}.</p></section>
                    ) : null
                  }
                  return (
                    <section key={peran} className="mb-[1.6rem]">
                      {judulPeran(peran)}
                      <p className="m-0 mb-[0.6rem] text-[0.87rem] text-[var(--tinta-3)]">Belum dinilai. Super Admin dapat memasukkan nilai kapan saja.</p>
                      <PengujiForm
                        aspek={aturan.aspekSidang}
                        tabel={tabel}
                        aksi={inputNilaiSidangAdminAction.bind(null, defense.id, peran, tampil)}
                        tombol="Simpan nilai"
                        konfirmasi={{ judul: 'Simpan nilai?', isi: `Nilai dicatat sebagai input admin untuk ${data.dosen[peran]}.`, tombol: 'Simpan' }}
                      />
                    </section>
                  )
                })}

                <section className="mb-[1.6rem]">
                  <h2 className={H2}>Hasil sidang</h2>
                  {hasil ? (
                    <>
                      <Hasil hasil={hasil} nilaiSidang={nSidang} tabel={tabel} />
                      <p className="m-0 mb-[1rem] flex flex-wrap gap-[0.6rem]">
                        <a href={`/api/berita-acara/${defense.id}?format=xlsx`} className={UNDUH}>Unduh Berita Acara (Excel)</a>
                        <a href={`/api/berita-acara/${defense.id}?format=pdf`} className={UNDUH}>Unduh Berita Acara (PDF)</a>
                        <a href={`/api/form-revisi/${defense.id}?format=xlsx`} className={UNDUH}>Unduh Form Revisi (Excel)</a>
                        <a href={`/api/form-revisi/${defense.id}?format=pdf`} className={UNDUH}>Unduh Form Revisi (PDF)</a>
                      </p>
                      {canManage(user.role) && (
                        <div className="m-0 mb-[1rem] text-[0.93rem]">
                          <span className={KECIL}>Email revisi</span>
                          {EMAIL_LABEL[hasil.email_status] ?? hasil.email_status}
                          {bolehKirimUlang(hasil.email_status, hasil.locked_at) && <KirimUlang defenseId={defense.id} />}
                        </div>
                      )}
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
                  ) : canManage(user.role) && adminSidang(defense, new Set(Object.keys(data.nilai) as PeranSidang[]), false).kunci ? (
                    <YudisiumForm
                      pilihan={aturan.pilihanYudisium}
                      aksi={kunciSidangAdminAction.bind(null, defense.id)}
                      tombol="Kunci atas nama Ketua"
                      konfirmasi={{ judul: 'Kunci sidang atas nama Ketua?', isi: 'Setelah dikunci, nilai sidang tidak bisa diubah.', tombol: 'Kunci sidang' }}
                    />
                  ) : (
                    <p className="m-0 text-[0.93rem] text-[var(--tinta-3)]">
                      {legacy ? `Belum dikunci. ${ANGGOTA_I_LEGACY}.` : 'Belum dikunci.'}
                    </p>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </main>
    </AppShell>
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
      {row.sumber === 'manual' && ' (input admin)'}
    </p>
  )
}

/** A submitted grade, read-only: its snapshot rows (never the current list), the nilai, then its revisi. */
function Terkirim({ row, tabel }: { row: NilaiSidangRow; tabel: BarisNilai[] }) {
  // The form no longer asks for a halaman (kiprat 2026-11-26); older grades that have one still show it.
  const adaHalaman = row.revisi.some((r) => r.halaman?.trim())
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
      <KotakNilai nilai={row.nilai} tabel={tabel} className="mt-[1rem] w-[16rem] max-w-full" />
      <h3 className="m-0 mt-[1rem] mb-[0.4rem] text-[0.93rem] font-semibold">Revisi</h3>
      {row.ada_revisi ? (
        <table className="w-full border-collapse border border-[var(--garis-kuat)] bg-[var(--lembar)] text-[0.93rem]">
          <thead className="bg-[var(--cekung)] text-[0.73rem] uppercase tracking-[0.04em] text-[var(--tinta-3)]">
            <tr>
              {adaHalaman && <th className={`text-left w-[7rem] ${TH}`}>Halaman</th>}
              <th className={`text-left ${TH}`}>Catatan revisi</th>
            </tr>
          </thead>
          <tbody>
            {row.revisi.map((r, i) => (
              <tr key={i} className="border-t border-[var(--garis)] align-top">
                {adaHalaman && <td className={`${TD} mono`}>{r.halaman || '—'}</td>}
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
