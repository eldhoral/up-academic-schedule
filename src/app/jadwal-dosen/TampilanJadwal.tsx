import Image from 'next/image'
import { KETERANGAN_LABEL, type KeteranganUjian } from '@/app/[prodi]/ujian/exam-types'
import { HARI_DB, hariLabel, tanggalPanjang } from '@/lib/hari'
import { PRODI_CONFIG } from '@/lib/prodi'
import { defenseLinkLabel } from '@/app/[prodi]/sidang/defense-types'
import {
  PROGRAM_LABEL,
  SIDANG_HARI_MAJU,
  SIDANG_PERAN_LABEL,
  agendaHariIni,
  linkNilai,
  sidangHariIni,
  sidangJudul,
  ujianPeranText,
  type AgendaItem,
  type JadwalDosen,
  type KuliahItem,
  type SidangItem,
  type UjianItem,
} from './events'

/*
 * The lecturer's public page (Publik-JadwalDosen.dc.html): the app's cards and type, with the faculty's
 * sky blue and yellow (psikologi.univpancasila.ac.id) as decoration only — dark text sits on them.
 */

const SITUS_FAKULTAS = 'https://psikologi.univpancasila.ac.id/'
const short = (p: KuliahItem['prodi']) => PRODI_CONFIG[p].short

/** "1 Sep 2026" */
const tanggalPendek = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
/** { hari: 'Sen', tgl: 14, bulan: 'Des' } for the date blocks. */
const blok = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`)
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('id-ID', { ...o, timeZone: 'UTC' })
  return { hari: f({ weekday: 'short' }), tgl: d.getUTCDate(), bulan: f({ month: 'short' }) }
}
const jamUjian = (u: UjianItem) => (u.keterangan === 'take_home' ? 'Take Home' : `${u.jam_mulai}–${u.jam_selesai}`)
/** The room, else how it runs (Daring…); a take-home already says so in its time slot. */
const tempatUjian = (u: UjianItem) => u.tempat || (u.keterangan === 'take_home' ? '' : KETERANGAN_LABEL[u.keterangan as KeteranganUjian])

/** The page body, from data alone. */
export function TampilanJadwal({ jadwal, today, host, feedPath }: { jadwal: JadwalDosen; today: string; host: string; feedPath: string }) {
  const term = jadwal.term
  const hasTermDates = !!(term?.mulai && term?.selesai)
  // Today's prasidang, sidang up to SIDANG_HARI_MAJU days ahead (to review the materi); other dates live in the calendar feed.
  const hariIni = sidangHariIni(jadwal.sidang, today)
  const sidang = [...hariIni.prasidang, ...hariIni.sidang].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.jam_mulai.localeCompare(b.jam_mulai))
  const agenda = agendaHariIni(jadwal, today)
  // Upcoming first (soonest on top), then what has passed.
  const ujian = [...jadwal.ujian.filter((u) => u.tanggal >= today), ...jadwal.ujian.filter((u) => u.tanggal < today)]
  const ujianMendatang = jadwal.ujian.filter((u) => u.tanggal >= today).length
  const kuliahPerHari = HARI_DB.map((h) => ({ hari: h, kelas: jadwal.kuliah.filter((k) => k.hari === h).sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai)) })).filter((g) => g.kelas.length)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)] leading-[normal]">
      <header className="bg-[var(--brand-langit)]">
        <div className="mx-auto flex max-w-[74.667rem] items-center gap-[0.667rem] px-[1.067rem] py-[0.667rem] sm:gap-[0.933rem] sm:px-[2.133rem] sm:py-[0.8rem]">
          <Image src="/images/logo-universitas-pancasila.png" alt="Universitas Pancasila" width={64} height={64} className="h-[36px] w-auto sm:h-[44px]" />
          <span aria-hidden="true" className="h-[26px] w-px bg-[var(--tinta)]/25 sm:h-[32px]" />
          <Image src="/images/logo-fakultas-psikologi.png" alt="Fakultas Psikologi" width={64} height={64} className="h-[36px] w-auto sm:h-[44px]" />
          <div className="leading-[1.25]">
            <div className="text-[0.733rem] sm:text-[0.8rem]">Universitas Pancasila</div>
            <div className="text-[0.933rem] font-semibold sm:text-[1rem]">Fakultas Psikologi</div>
          </div>
          <a href={SITUS_FAKULTAS} target="_blank" rel="noopener noreferrer" className="ml-auto hidden text-[0.867rem] font-medium text-[var(--tinta)] no-underline hover:underline sm:inline">
            psikologi.univpancasila.ac.id ↗
          </a>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[74.667rem] flex-1 flex-col gap-[0.933rem] px-[1.067rem] pt-[1.067rem] pb-[2.4rem] sm:gap-[1.467rem] sm:px-[2.133rem] sm:pt-[1.867rem]">
        {/* Who this is for, and the one action that matters: subscribe. */}
        <section className="grid overflow-hidden rounded-[var(--r-kartu)] border border-[var(--garis)] bg-[var(--lembar)] sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-[0.667rem] p-[1.067rem] sm:gap-[0.933rem] sm:px-[2.133rem] sm:py-[2rem]">
            <div>
              <p className="m-0 text-[0.733rem] font-semibold tracking-[0.06em] text-[var(--tinta-3)] uppercase sm:text-[0.8rem]">
                Jadwal Dosen{term ? ` · ${term.label}` : ''}
              </p>
              <span aria-hidden="true" className="mt-[0.533rem] block h-[4px] w-[40px] rounded-[2px] bg-[var(--brand-langit)] sm:w-[48px]" />
            </div>
            <h1 className="m-0 text-[1.467rem] leading-[1.25] font-semibold tracking-[-0.01em] sm:text-[2rem] sm:tracking-[-0.02em]">{jadwal.nama}</h1>
            <p className="m-0 text-[0.867rem] text-[var(--tinta-3)] sm:text-[0.933rem]">
              {!term
                ? 'Belum ada tahun akademik aktif.'
                : hasTermDates
                  ? `Perkuliahan ${tanggalPendek(term.mulai!)} – ${tanggalPendek(term.selesai!)} · Kalender ikut diperbarui saat jadwal berubah`
                  : 'Tanggal perkuliahan belum diatur, jadi kuliah belum masuk ke kalender.'}
            </p>
            <div className="mt-[0.267rem] flex flex-col gap-[0.667rem] sm:flex-row sm:flex-wrap">
              <a
                href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(`webcal://${host}${feedPath}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tekan inline-flex min-h-[2.933rem] items-center justify-center gap-[0.533rem] rounded-[var(--r-item)] bg-[var(--aksen)] px-[1.2rem] text-[0.933rem] font-semibold text-white no-underline hover:bg-[#1546A8]"
              >
                <Ikon d="M3 10h18M8 2v4M16 2v4M12 13v5M9.5 15.5h5" kotak />
                Tambah ke Google Calendar
              </a>
              <a
                href={`${feedPath}?unduh=1`}
                className="tekan inline-flex min-h-[2.933rem] items-center justify-center gap-[0.533rem] rounded-[var(--r-item)] border border-[var(--garis-kuat)] bg-[var(--lembar)] px-[1.067rem] text-[0.933rem] font-medium text-[var(--tinta)] no-underline hover:bg-[var(--cekung)]"
              >
                <Ikon d="M12 3v12M7 10l5 5 5-5M4 20h16" />
                Unduh .ics
              </a>
            </div>
            <p className="m-0 text-[0.8rem] text-[var(--tinta-3)]">
              Apple Calendar atau Outlook:{' '}
              <a href={`webcal://${host}${feedPath}`} className="text-[var(--aksen)]">
                berlangganan kalender
              </a>
            </p>
          </div>
          {/* The campus, with the faculty site's big rounded corner. On a phone it sits on top. */}
          <div className="relative order-first h-[8.8rem] sm:order-none sm:h-auto sm:min-h-[18.667rem]">
            <Image
              src="/images/fakultas-psikologi.jpg"
              alt="Gedung Fakultas Psikologi, Universitas Pancasila"
              fill
              sizes="(min-width: 640px) 45vw, 100vw"
              className="rounded-bl-[64px] object-cover object-[center_20%] sm:rounded-bl-[120px]"
              priority
            />
          </div>
        </section>

        <div className="grid grid-cols-3 gap-[0.533rem] sm:gap-[0.933rem]">
          <Angka ikon="kuliah" angka={jadwal.kuliah.length} judul="Kuliah" />
          <Angka ikon="ujian" angka={ujianMendatang} judul="Ujian" />
          <Angka ikon="sidang" angka={sidang.length} judul="Sidang & prasidang" />
        </div>

        {/* Today, marked with the faculty's yellow. */}
        <section className="rounded-[var(--r-kartu)] border border-l-4 border-[var(--garis)] border-l-[var(--brand-kuning)] bg-[var(--lembar)] p-[1.067rem] sm:p-[1.333rem]">
          <div className="mb-[0.267rem] flex flex-wrap items-baseline gap-[0.533rem]">
            <h2 className="m-0 text-[1.067rem] font-semibold sm:text-[1.133rem]">Hari ini</h2>
            <span className="rounded-[4px] bg-[var(--brand-kuning-lembut)] px-[0.467rem] py-[0.133rem] text-[0.8rem] font-semibold text-[var(--brand-kuning-teks)]">
              {tanggalPanjang(today, false)}
            </span>
          </div>
          {agenda.length === 0 ? <Kosong>Tidak ada jadwal hari ini.</Kosong> : agenda.map((a, i) => <BarisAgenda key={`${a.jenis}-${a.item.id}`} a={a} pertama={i === 0} today={today} />)}
        </section>

        <div className="grid items-start gap-[0.933rem] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Kartu judul="Jadwal Kuliah" className="lg:order-none order-last">
            {kuliahPerHari.length === 0 ? (
              <Kosong>Tidak ada jadwal kuliah semester ini.</Kosong>
            ) : (
              kuliahPerHari.map((g) => (
                <div key={g.hari}>
                  <div className="pt-[0.933rem] pb-[0.4rem] text-[0.733rem] font-semibold tracking-[0.06em] text-[var(--tinta-3)] uppercase">{hariLabel(g.hari)}</div>
                  {g.kelas.map((k) => (
                    <Baris key={k.id} jam={`${k.jam_mulai}–${k.jam_selesai}`} judul={`${k.nama_mk} (${k.kelas})`} meta={metaKuliah(k)} />
                  ))}
                </div>
              ))
            )}
          </Kartu>

          <div className="flex flex-col gap-[0.933rem]">
            <Kartu judul="Sidang & Prasidang" kolom>
              {sidang.length === 0 ? (
                <Kosong>{`Tidak ada jadwal sidang dalam ${SIDANG_HARI_MAJU} hari ke depan.`}</Kosong>
              ) : (
                <>
                  {sidang.map((s) => (
                    <BarisTanggal key={s.id} tanggal={s.tanggal} judul={`${sidangJudul(s)} · ${s.nama_mahasiswa}`} meta={`${s.jam_mulai}–${s.jam_selesai} · ${metaSidang(s)}`}>
                      <TombolSidang s={s} today={today} />
                    </BarisTanggal>
                  ))}
                  <p className="m-0 text-[0.8rem] text-[var(--tinta-3)]">Tombol Beri Nilai muncul pada hari sidang.</p>
                </>
              )}
            </Kartu>

            <Kartu judul="Ujian" kolom>
              {ujian.length === 0 ? (
                <Kosong>Tidak ada tugas ujian semester ini.</Kosong>
              ) : (
                ujian.map((u) => {
                  const lewat = u.tanggal < today
                  return (
                    <BarisTanggal
                      key={u.id}
                      tanggal={u.tanggal}
                      lewat={lewat}
                      judul={`${u.jenis_ujian.toUpperCase()} · ${u.nama_mk} (${u.kelas})`}
                      meta={[blok(u.tanggal).bulan, jamUjian(u), ujianPeranText(u.peran), `${short(u.prodi)} ${PROGRAM_LABEL[u.jenis_kelas]}`, tempatUjian(u)].filter(Boolean).join(' · ')}
                    />
                  )
                })
              )}
            </Kartu>
          </div>
        </div>
      </main>

      {/* The faculty, and a reminder that the link is personal. */}
      <footer className="border-t-4 border-[var(--brand-langit)] bg-[var(--lembar)]">
        <div className="mx-auto flex max-w-[74.667rem] flex-wrap items-center gap-x-[0.8rem] gap-y-[0.267rem] px-[1.067rem] py-[1.2rem] text-[0.8rem] text-[var(--tinta-3)] sm:px-[2.133rem] sm:text-[0.867rem]">
          <Image src="/images/logo-fakultas-psikologi.png" alt="" width={56} height={56} className="hidden h-[28px] w-auto sm:block" />
          <span>
            <b className="font-semibold text-[var(--tinta)]">Fakultas Psikologi Universitas Pancasila</b> · Tautan ini khusus untuk Anda, mohon tidak dibagikan.
          </span>
          <a href={SITUS_FAKULTAS} target="_blank" rel="noopener noreferrer" className="text-[var(--aksen)] sm:ml-auto">
            psikologi.univpancasila.ac.id
          </a>
        </div>
      </footer>
    </div>
  )
}

const metaKuliah = (k: KuliahItem) =>
  [`${short(k.prodi)} ${PROGRAM_LABEL[k.jenis_kelas]}`, k.tempat, k.minggu === 'setiap' ? '' : `minggu ${k.minggu}`].filter(Boolean).join(' · ')
const metaSidang = (s: SidangItem) => [SIDANG_PERAN_LABEL[s.jenis][s.peran], short(s.prodi), s.tempat].filter(Boolean).join(' · ')

function BarisAgenda({ a, pertama, today }: { a: AgendaItem; pertama: boolean; today: string }) {
  if (a.jenis === 'kuliah')
    return <Baris pertama={pertama} jam={`${a.item.jam_mulai}–${a.item.jam_selesai}`} judul={`Kuliah · ${a.item.nama_mk} (${a.item.kelas})`} meta={metaKuliah(a.item)} />
  if (a.jenis === 'ujian')
    return (
      <Baris
        pertama={pertama}
        jam={jamUjian(a.item)}
        judul={`${a.item.jenis_ujian.toUpperCase()} · ${a.item.nama_mk} (${a.item.kelas})`}
        meta={[ujianPeranText(a.item.peran), `${short(a.item.prodi)} ${PROGRAM_LABEL[a.item.jenis_kelas]}`, tempatUjian(a.item)].filter(Boolean).join(' · ')}
      />
    )
  return (
    <Baris pertama={pertama} jam={`${a.item.jam_mulai}–${a.item.jam_selesai}`} judul={`${sidangJudul(a.item)} · ${a.item.nama_mahasiswa}`} meta={metaSidang(a.item)}>
      <TombolSidang s={a.item} today={today} />
    </Baris>
  )
}

/** A time-led row: classes and today's agenda. */
function Baris({ jam, judul, meta, pertama = false, children }: { jam: string; judul: string; meta: string; pertama?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-[0.8rem] py-[0.667rem] sm:gap-[0.933rem] ${pertama ? '' : 'border-t border-[var(--garis)]'}`}>
      <div className="mono w-[5.6rem] shrink-0 pt-px text-[0.8rem] text-[var(--tinta-2)] sm:w-[6.133rem] sm:text-[0.867rem]">{jam}</div>
      <div className="min-w-0 grow">
        <div className="text-[0.933rem] font-semibold">{judul}</div>
        <div className="text-[0.867rem] text-[var(--tinta-3)]">{meta}</div>
        {children}
      </div>
    </div>
  )
}

/** A date-led row (as Beranda's Sidang Mendatang): exams and sidang. */
function BarisTanggal({ tanggal, judul, meta, lewat = false, children }: { tanggal: string; judul: string; meta: string; lewat?: boolean; children?: React.ReactNode }) {
  const b = blok(tanggal)
  return (
    <div className={`flex items-start gap-[0.8rem] ${lewat ? 'opacity-55' : ''}`}>
      <div className="w-[3.067rem] shrink-0 rounded-[var(--r-item)] bg-[var(--cekung)] py-[0.333rem] text-center">
        <div className="text-[0.733rem] text-[var(--tinta-3)]">{b.hari}</div>
        <div className="text-[1.133rem] leading-[1.2] font-semibold">{b.tgl}</div>
      </div>
      <div className="min-w-0 grow">
        <div className="text-[0.933rem] font-semibold">
          {judul}
          {lewat && <span className="ml-[0.4rem] rounded-[4px] bg-[var(--kertas)] px-[0.4rem] py-px text-[0.733rem] font-medium text-[var(--tinta-2)]">Selesai</span>}
        </div>
        <div className="text-[0.867rem] text-[var(--tinta-3)]">{meta}</div>
        {children}
      </div>
    </div>
  )
}

/** Materi always (to review ahead); grading opens on the sidang day. */
function TombolSidang({ s, today }: { s: SidangItem; today: string }) {
  const nilai = s.tanggal === today ? linkNilai(s) : null
  if (!s.link && !nilai) return null
  return (
    <div className="mt-[0.533rem] flex flex-wrap gap-[0.533rem]">
      {/* Opens the material in a new tab, always through http(s) — the column's DB check keeps javascript: out. */}
      {s.link && (
        <a
          href={s.link}
          target="_blank"
          rel="noopener noreferrer"
          className="tekan inline-flex min-h-[2.4rem] items-center gap-[0.4rem] rounded-[8px] bg-[var(--aksen)] px-[0.8rem] text-[0.867rem] font-medium text-white no-underline hover:bg-[#1546A8]"
        >
          {defenseLinkLabel(s.link)} <span aria-hidden="true">↗</span>
        </a>
      )}
      {/* Grants nothing by itself: the page behind it needs a DOSEN login. */}
      {nilai && (
        <a
          href={nilai}
          target="_blank"
          rel="noopener noreferrer"
          className="tekan inline-flex min-h-[2.4rem] items-center gap-[0.4rem] rounded-[8px] border border-[var(--garis-kuat)] bg-[var(--lembar)] px-[0.8rem] text-[0.867rem] font-medium text-[var(--tinta)] no-underline hover:bg-[var(--cekung)]"
        >
          {s.jenis === 'prasidang' ? 'Isi Berita Acara' : 'Beri Nilai'} <span aria-hidden="true">↗</span>
        </a>
      )}
    </div>
  )
}

function Kartu({ judul, kolom = false, className = '', children }: { judul: string; kolom?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-[var(--r-kartu)] border border-[var(--garis)] bg-[var(--lembar)] p-[1.067rem] sm:p-[1.333rem] ${kolom ? 'flex flex-col gap-[0.8rem]' : ''} ${className}`}>
      <h2 className="m-0 text-[1.067rem] font-semibold sm:text-[1.133rem]">{judul}</h2>
      {children}
    </section>
  )
}

const Kosong = ({ children }: { children: React.ReactNode }) => <p className="m-0 py-[0.533rem] text-[0.933rem] text-[var(--tinta-3)]">{children}</p>

const IKON_ANGKA = {
  kuliah: { warna: 'bg-[var(--aksen-lembut)] text-[var(--aksen)]', d: 'M3 10h18M8 2v4M16 2v4', kotak: true },
  ujian: { warna: 'bg-[var(--aksen-lembut)] text-[var(--aksen)]', d: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9', kotak: false },
  sidang: { warna: 'bg-[var(--hijau-lembut)] text-[var(--hijau)]', d: 'M22 10 12 5 2 10l10 5 10-5ZM6 12v5c3 2 9 2 12 0v-5', kotak: false },
} as const

/** A count tile, like Beranda's; on a phone just the number and its title. */
function Angka({ ikon, angka, judul }: { ikon: keyof typeof IKON_ANGKA; angka: number; judul: string }) {
  const i = IKON_ANGKA[ikon]
  return (
    <div className="flex items-center gap-[0.933rem] rounded-[12px] border border-[var(--garis)] bg-[var(--lembar)] px-[0.8rem] py-[0.667rem] sm:rounded-[var(--r-kartu)] sm:p-[1.067rem]">
      <span aria-hidden="true" className={`hidden size-[2.933rem] shrink-0 items-center justify-center rounded-[var(--r-item)] sm:flex ${i.warna}`}>
        <Ikon d={i.d} kotak={i.kotak} ukuran={19} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-col-reverse sm:flex-col">
          <div className="text-[0.8rem] text-[var(--tinta-3)] sm:text-[0.933rem]">{judul}</div>
          <span className="text-[1.467rem] font-semibold sm:text-[1.733rem]">{angka}</span>
        </div>
      </div>
    </div>
  )
}

function Ikon({ d, kotak = false, ukuran = 17 }: { d: string; kotak?: boolean; ukuran?: number }) {
  return (
    <svg aria-hidden="true" width={ukuran} height={ukuran} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      {kotak && <rect x="3" y="4" width="18" height="17" rx="2" />}
      <path d={d} />
    </svg>
  )
}
