import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { KETERANGAN_LABEL, type KeteranganUjian } from '@/app/[prodi]/ujian/exam-types'
import { hariLabel, tanggalPanjang } from '@/lib/hari'
import { PRODI_CONFIG } from '@/lib/prodi'
import { PROGRAM_LABEL, SIDANG_PERAN_LABEL, sidangJudul, ujianPeranText } from '../events'
import { loadJadwalDosen } from '../jadwal-data'

export const metadata: Metadata = { title: 'Jadwal Dosen', robots: { index: false, follow: false } }

const todayJakarta = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())

export default async function JadwalDosenPage(props: PageProps<'/jadwal-dosen/[token]'>) {
  const { token } = await props.params
  const jadwal = await loadJadwalDosen(token)
  if (!jadwal) notFound()

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const feedPath = `/jadwal-dosen/${token}/kalender.ics`
  const today = todayJakarta()
  // Upcoming first (soonest on top), then what has passed.
  const upcomingFirst = <T extends { tanggal: string }>(items: T[]) => [...items.filter((i) => i.tanggal >= today), ...items.filter((i) => i.tanggal < today)]
  const term = jadwal.term
  const hasTermDates = !!(term?.mulai && term?.selesai)

  return (
    <div className="min-h-screen bg-[var(--kertas)] text-[var(--tinta)]">
      <main className="max-w-[56rem] mx-auto p-[1rem] sm:p-[1.6rem] space-y-[1.2rem]">
        <header className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.2rem] sm:p-[1.6rem]">
          <p className="m-0 text-[0.8rem] font-semibold uppercase tracking-[0.04em] text-[var(--tinta-3)]">Jadwal Dosen</p>
          <h1 className="m-0 mt-[0.2rem] text-[1.3rem] font-semibold">{jadwal.nama}</h1>
          <p className="m-0 mt-[0.3rem] text-[0.93rem] text-[var(--tinta-2)]">
            {term ? term.label : 'Belum ada tahun akademik aktif.'}
            {hasTermDates && ` · Perkuliahan ${tanggalPanjang(term!.mulai!, false)} – ${tanggalPanjang(term!.selesai!, false)}`}
          </p>
          <div className="flex flex-wrap gap-[0.6rem] mt-[1rem]">
            <a
              href={`webcal://${host}${feedPath}`}
              className="px-[0.8rem] py-[0.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium no-underline hover:bg-[var(--biru-hover)]"
            >
              Langganan kalender
            </a>
            <a
              href={`${feedPath}?unduh=1`}
              className="px-[0.8rem] py-[0.5rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[var(--tinta)] text-[0.87rem] font-medium no-underline hover:bg-[var(--cekung)]"
            >
              Unduh .ics
            </a>
            <a
              href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(`webcal://${host}${feedPath}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-[0.8rem] py-[0.5rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[var(--tinta)] text-[0.87rem] font-medium no-underline hover:bg-[var(--cekung)]"
            >
              Google Calendar
            </a>
          </div>
          <p className="m-0 mt-[0.6rem] text-[0.8rem] text-[var(--tinta-3)]">
            Kalender yang dilanggan diperbarui otomatis (bisa tertunda beberapa jam). Jangan bagikan link ini ke orang lain.
          </p>
        </header>

        <Section title="Kuliah" empty={jadwal.kuliah.length === 0 ? 'Tidak ada jadwal kuliah semester ini.' : null}>
          {term && !hasTermDates && jadwal.kuliah.length > 0 && (
            <p className="m-0 mb-[0.6rem] text-[0.87rem] text-[var(--tinta-3)]">
              Tanggal mulai dan selesai perkuliahan belum diatur, jadi kuliah belum masuk ke kalender.
            </p>
          )}
          <ul className="list-none m-0 p-0 divide-y divide-[var(--garis)]">
            {jadwal.kuliah.map((k) => (
              <Row
                key={k.id}
                when={`${hariLabel(k.hari)} · ${k.jam_mulai}–${k.jam_selesai}${k.minggu === 'setiap' ? '' : ` · minggu ${k.minggu}`}`}
                what={`${k.nama_mk} (${k.kelas})`}
                detail={`${PRODI_CONFIG[k.prodi].short} ${PROGRAM_LABEL[k.jenis_kelas]}${k.tempat ? ` · ${k.tempat}` : ''}`}
              />
            ))}
          </ul>
        </Section>

        <Section title="Ujian" empty={jadwal.ujian.length === 0 ? 'Tidak ada tugas ujian semester ini.' : null}>
          <ul className="list-none m-0 p-0 divide-y divide-[var(--garis)]">
            {upcomingFirst(jadwal.ujian).map((u) => (
              <Row
                key={u.id}
                past={u.tanggal < today}
                when={`${tanggalPanjang(u.tanggal, false)} · ${u.keterangan === 'take_home' ? 'Take Home' : `${u.jam_mulai}–${u.jam_selesai}`}`}
                what={`${u.jenis_ujian.toUpperCase()} ${ujianPeranText(u.peran)} · ${u.nama_mk} (${u.kelas})`}
                detail={`${PRODI_CONFIG[u.prodi].short} ${PROGRAM_LABEL[u.jenis_kelas]} · ${u.tempat || KETERANGAN_LABEL[u.keterangan as KeteranganUjian]}`}
              />
            ))}
          </ul>
        </Section>

        <Section title="Sidang" empty={jadwal.sidang.length === 0 ? 'Tidak ada jadwal sidang semester ini.' : null}>
          <ul className="list-none m-0 p-0 divide-y divide-[var(--garis)]">
            {upcomingFirst(jadwal.sidang).map((s) => (
              <Row
                key={s.id}
                past={s.tanggal < today}
                when={`${tanggalPanjang(s.tanggal, false)} · ${s.jam_mulai}–${s.jam_selesai}`}
                what={`${sidangJudul(s)} · ${s.nama_mahasiswa}`}
                detail={`${SIDANG_PERAN_LABEL[s.jenis][s.peran]} · ${PRODI_CONFIG[s.prodi].short}${s.tempat ? ` · ${s.tempat}` : ''}`}
              />
            ))}
          </ul>
        </Section>
      </main>
    </div>
  )
}

function Section({ title, empty, children }: { title: string; empty: string | null; children: React.ReactNode }) {
  return (
    <section className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.2rem] sm:p-[1.6rem]">
      <h2 className="m-0 mb-[0.6rem] text-[1.05rem] font-semibold">{title}</h2>
      {empty ? <p className="m-0 text-[0.93rem] text-[var(--tinta-3)]">{empty}</p> : children}
    </section>
  )
}

function Row({ when, what, detail, past = false }: { when: string; what: string; detail: string; past?: boolean }) {
  return (
    <li className={`py-[0.6rem] ${past ? 'opacity-50' : ''}`}>
      <p className="m-0 text-[0.8rem] text-[var(--tinta-3)] mono">{when}</p>
      <p className="m-0 mt-[0.1rem] text-[0.93rem] font-medium">{what}</p>
      <p className="m-0 mt-[0.1rem] text-[0.87rem] text-[var(--tinta-2)]">{detail}</p>
    </li>
  )
}
