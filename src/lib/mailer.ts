import nodemailer from 'nodemailer'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailError, lecturerDisplayName } from '@/lib/import/tables'
import { PERAN_SIDANG, PERAN_SIDANG_LABEL, type PeranSidang } from '@/lib/penilaian/akses'
import { renderRevisi } from '@/lib/penilaian/email-revisi'
import { HASIL_LABEL, PERAN_PRASIDANG_LABEL, type Hasil, type Jawaban } from '@/lib/penilaian/prasidang'
import { loadSettings, type SettingsMap } from '@/lib/settings'
import { parseDetailEmail, type DetailEmail } from '@/lib/penilaian/rekap'
import type { Revisi } from '@/lib/penilaian/nilai'
import { convertXlsxToPdf } from '@/lib/aspose'
import { kopBaris } from '@/lib/xlsx'
import { buildFormRevisiXlsx, namaFormRevisi, type FormRevisi } from '@/lib/penilaian/form-revisi-xlsx'
import { beritaAcaraDariSidang, buildBeritaAcaraXlsx } from '@/lib/penilaian/berita-acara-xlsx'
import { namaBeritaAcara } from '@/lib/penilaian/berita-acara-prasidang-xlsx'
import { loadSidang } from '@/lib/penilaian/data'
import { istilah } from '@/lib/prodi'

export type Lampiran = { filename: string; content: Uint8Array; contentType: string }
export type Transport = (msg: { to: string[]; cc?: string[]; subject: string; text: string; html: string; attachments?: Lampiran[] }) => Promise<{ accepted: string[]; rejected: string[] }>
export type EmailStatus = 'tidak_perlu' | 'terkirim' | 'gagal' | 'sebagian'
export type { DetailEmail }

/** What a send needs, loaded once. `status` is hasil_sidang (or berita_acara_prasidang).email_status as it stands. */
export type MailData = {
  /** Missing = sidang. Prasidang: penguji is the Pendamping, revisi[].halaman holds the question text. */
  jenis?: 'sidang' | 'prasidang'
  /** Missing = s1. S2 words the attached form for the tesis / seminar proposal. */
  prodi?: string
  status: string
  /** hasil_sidang.email_detail as stored: who already got the mail. */
  detailLama: DetailEmail[]
  nama: string
  npm: string
  judul: string
  tanggal: string
  yudisium: string
  academicYearId: string
  mahasiswaEmail: string | null
  penguji: { peranLabel: string; nama: string; email: string | null; revisi: Revisi }[]
  /** Pengaturan (per prodi) 'email_revisi_cc_kaprodi' / 'email_revisi_cc_wadek1', CC'd on the mail; blank = not CC'd. */
  cc?: { siapa: string; email: string | null }[]
  /** Pengaturan (per prodi) 'email_revisi_subjek' / 'email_revisi_isi'; missing = the built-in defaults. */
  template?: { subjek: string; isi: string }
  /** Pengaturan (per prodi) 'kop_baris', the kop on the attached form PDF. */
  kop?: string[]
}
export type MailDeps = {
  muat: (defenseId: string) => Promise<MailData | null>
  simpan: (defenseId: string, status: EmailStatus, detail: DetailEmail[]) => Promise<void>
  /** The form revisi as PDF, attached to the mail; missing = no attachment. */
  pdf?: (form: FormRevisi) => Promise<Uint8Array>
}

const TIDAK_DIKONFIGURASI = 'SMTP belum dikonfigurasi'
const MAKS_MS = 20_000
/** Cap on the Aspose conversion, on top of the send: a lock waits at most PDF_MS + MAKS_MS. */
const PDF_MS = 10_000

/** p, or a rejection once ms have passed. */
async function batasWaktu<T>(p: Promise<T>, ms: number, pesan: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([p, new Promise<never>((_, tolak) => { timer = setTimeout(() => tolak(new Error(pesan)), ms) })])
  } finally {
    clearTimeout(timer)
  }
}

/** The phases add up to MAKS_MS (5 + 5 + 10 s), so a send the race gave up on cannot still deliver afterwards. */
export const smtpOpsi = (user: string, pass: string) => ({
  host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass },
  connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10_000,
})

/** Gmail SMTP from SMTP_USER / SMTP_PASS / SMTP_FROM; null when any is missing. Credentials are never logged. */
export function smtpTransport(): Transport | null {
  const { SMTP_USER: user, SMTP_PASS: pass, SMTP_FROM: from } = process.env
  if (!user || !pass || !from) return null
  const t = nodemailer.createTransport(smtpOpsi(user, pass))
  return async (msg) => {
    const r = await t.sendMail({ from, ...msg, attachments: msg.attachments?.map((a) => ({ ...a, content: Buffer.from(a.content) })) })
    const alamat = (a: unknown) => (typeof a === 'string' ? a : (a as { address: string }).address)
    return { accepted: r.accepted.map(alamat), rejected: r.rejected.map(alamat) }
  }
}

/** Admin client: the grades, names and addresses are read for any sidang, whoever triggered the send. */
const ccSettings = (settings: SettingsMap) =>
  [{ siapa: 'Kaprodi', email: settings.email_revisi_cc_kaprodi ?? null }, { siapa: 'Wakil Dekan I', email: settings.email_revisi_cc_wadek1 ?? null }]

const dbDeps: MailDeps = {
  async muat(defenseId) {
    const db = createAdminClient()
    const { data: d, error } = await db
      .from('defenses').select('id, prodi, npm, nama_mahasiswa, judul_skripsi, tanggal, academic_year_id').eq('id', defenseId).maybeSingle()
    if (error) throw new Error(`Gagal memuat sidang: ${error.message}`)
    if (!d) return null
    const [hasil, nilai, mhs, settings] = await Promise.all([
      db.from('hasil_sidang').select('yudisium_label, email_status, email_detail').eq('defense_id', defenseId).maybeSingle(),
      db.from('nilai_sidang').select('peran, kode_dosen, ada_revisi, revisi').eq('defense_id', defenseId),
      db.from('students').select('email').eq('prodi', d.prodi).eq('npm', d.npm).maybeSingle(),
      loadSettings(db, d.prodi, false),
    ])
    const err = hasil.error ?? nilai.error ?? mhs.error
    if (err) throw new Error(`Gagal memuat sidang: ${err.message}`)
    if (!hasil.data) return null
    const kode = (nilai.data ?? []).map((n) => n.kode_dosen as string)
    const dosen = await db.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang, email').in('kode_dosen', kode)
    if (dosen.error) throw new Error(`Gagal memuat dosen: ${dosen.error.message}`)
    const penguji = PERAN_SIDANG.flatMap((p: PeranSidang) => {
      const n = (nilai.data ?? []).find((x) => x.peran === p)
      const l = n && (dosen.data ?? []).find((x) => x.kode_dosen === n.kode_dosen)
      return n && l ? [{ peranLabel: PERAN_SIDANG_LABEL[p], nama: lecturerDisplayName(l), email: l.email as string | null, revisi: n.ada_revisi ? (n.revisi as Revisi) : [] }] : []
    })
    return {
      prodi: d.prodi, status: hasil.data.email_status, detailLama: parseDetailEmail(hasil.data.email_detail), nama: d.nama_mahasiswa, npm: d.npm, judul: d.judul_skripsi, tanggal: d.tanggal, academicYearId: d.academic_year_id,
      yudisium: hasil.data.yudisium_label, mahasiswaEmail: (mhs.data?.email as string | null | undefined) ?? null, penguji,
      template: { subjek: settings.email_revisi_subjek ?? '', isi: settings.email_revisi_isi ?? '' },
      cc: ccSettings(settings),
      kop: kopBaris(settings.kop_baris),
    }
  },
  async simpan(defenseId, status, detail) {
    const { error } = await createAdminClient().from('hasil_sidang').update({ email_status: status, email_detail: detail }).eq('defense_id', defenseId)
    if (error) throw new Error(`Gagal menyimpan status email: ${error.message}`)
  },
  pdf: async (form) => convertXlsxToPdf(await buildFormRevisiXlsx(form)),
}

/** Prasidang: the Pendamping's berita acara (catatan per question) to the student and the Pendamping. Admin client, like dbDeps. */
const prasidangDeps: MailDeps = {
  async muat(defenseId) {
    const db = createAdminClient()
    const { data: d, error } = await db
      .from('defenses').select('id, prodi, npm, nama_mahasiswa, judul_skripsi, tanggal, academic_year_id').eq('id', defenseId).maybeSingle()
    if (error) throw new Error(`Gagal memuat prasidang: ${error.message}`)
    if (!d) return null
    const [ba, mhs, settings] = await Promise.all([
      db.from('berita_acara_prasidang').select('kode_dosen, jawaban, hasil, email_status, email_detail').eq('defense_id', defenseId).eq('peran', 'pendamping').maybeSingle(),
      db.from('students').select('email').eq('prodi', d.prodi).eq('npm', d.npm).maybeSingle(),
      loadSettings(db, d.prodi, false),
    ])
    const err = ba.error ?? mhs.error
    if (err) throw new Error(`Gagal memuat berita acara: ${err.message}`)
    if (!ba.data) return null
    const l = await db.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang, email').eq('kode_dosen', ba.data.kode_dosen).maybeSingle()
    if (l.error) throw new Error(`Gagal memuat dosen: ${l.error.message}`)
    const revisi: Revisi = (ba.data.jawaban as Jawaban[]).filter((j) => j.catatan.trim()).map((j) => ({ halaman: j.teks, catatan: j.catatan }))
    return {
      jenis: 'prasidang', prodi: d.prodi, status: ba.data.email_status, detailLama: parseDetailEmail(ba.data.email_detail),
      nama: d.nama_mahasiswa, npm: d.npm, judul: d.judul_skripsi, tanggal: d.tanggal, academicYearId: d.academic_year_id,
      yudisium: istilah(d.prodi, HASIL_LABEL[ba.data.hasil as Hasil]), mahasiswaEmail: (mhs.data?.email as string | null | undefined) ?? null,
      penguji: [{ peranLabel: PERAN_PRASIDANG_LABEL.pendamping, nama: l.data ? lecturerDisplayName(l.data) : ba.data.kode_dosen, email: (l.data?.email as string | null | undefined) ?? null, revisi }],
      template: { subjek: settings.email_prasidang_subjek ?? '', isi: settings.email_prasidang_isi ?? '' },
      cc: ccSettings(settings),
      kop: kopBaris(settings.kop_baris),
    }
  },
  async simpan(defenseId, status, detail) {
    const { error } = await createAdminClient().from('berita_acara_prasidang').update({ email_status: status, email_detail: detail })
      .eq('defense_id', defenseId).eq('peran', 'pendamping')
    if (error) throw new Error(`Gagal menyimpan status email: ${error.message}`)
  },
  pdf: dbDeps.pdf,
}

/** The catatan prasidang mail: kirimRevisi's rules (status, retry, CC, PDF) on the Pendamping's berita acara. */
export const kirimCatatanPrasidang = (defenseId: string, transport: Transport | null = smtpTransport()) =>
  kirimRevisi(defenseId, transport, prasidangDeps)

/**
 * Sends the revisi mail (student + the three examiners, Kaprodi and Wakil Dekan I in CC; one message) and records the outcome on hasil_sidang.
 * Only from 'menunggu' (first send) or 'gagal'/'sebagian' (retry); any other status is returned untouched, so a
 * double click can't re-send a finished mail. A retry mails only the addresses not already 'terkirim' in the stored
 * detail and merges the outcome into it. Never throws on a send problem: it becomes 'gagal'.
 * ponytail: no lock against two concurrent retries; add a status 'mengirim' compare-and-set if that ever happens.
 */
export async function kirimRevisi(
  defenseId: string, transport: Transport | null = smtpTransport(), deps: MailDeps = dbDeps, timeoutMs = MAKS_MS,
): Promise<EmailStatus> {
  const m = await deps.muat(defenseId)
  if (!m) return 'tidak_perlu'
  if (!['menunggu', 'gagal', 'sebagian'].includes(m.status)) return m.status as EmailStatus
  const jenis = m.jenis ?? 'sidang'
  const kolom = jenis === 'sidang' ? 'Halaman' : 'Pertanyaan'
  const revisi = m.penguji.filter((p) => p.revisi.length > 0).map((p) => ({ peranLabel: p.peranLabel, nama: p.nama, rows: p.revisi }))
  if (revisi.length === 0) {
    // Record it, or a stuck 'gagal'/'sebagian' keeps its retry button forever.
    await deps.simpan(defenseId, 'tidak_perlu', [])
    return 'tidak_perlu'
  }

  const sudah = m.detailLama.filter((x) => x.status === 'terkirim')
  const sudahAda = new Set(sudah.map((x) => x.alamat.trim().toLowerCase()))

  // Skipped addresses stay in the detail, so the recap shows who did not get the mail.
  const detail: DetailEmail[] = []
  const to: string[] = []
  const cc: string[] = []
  const penerima = [
    ...[['Mahasiswa', m.mahasiswaEmail] as const, ...m.penguji.map((p) => [p.peranLabel, p.email] as const)].map(([siapa, raw]) => ({ siapa, raw, ke: to })),
    // A blank CC setting means "don't CC", not a skipped recipient.
    ...(m.cc ?? []).filter((c) => c.email?.trim()).map((c) => ({ siapa: c.siapa, raw: c.email, ke: cc })),
  ]
  for (const { siapa, raw, ke } of penerima) {
    const alamat = (raw ?? '').trim()
    if (!alamat) detail.push({ alamat, status: 'dilewati', alasan: `Email ${siapa} kosong` })
    else if (emailError(alamat)) detail.push({ alamat, status: 'dilewati', alasan: `Email ${siapa} tidak valid` })
    else if (!sudahAda.has(alamat.toLowerCase()) && ![...to, ...cc].some((a) => a.toLowerCase() === alamat.toLowerCase())) ke.push(alamat)
  }
  const semuaKe = [...to, ...cc]

  // A PDF that fails or is late is left out, not a failed send: the body then carries the revisi tables instead.
  const lampiran = async (): Promise<Lampiran[]> => {
    if (!deps.pdf) return []
    const form: FormRevisi = {
      jenis, prodi: m.prodi, kolom, hasil: m.yudisium, kop: m.kop, npm: m.npm, nama: m.nama, judul: m.judul, tanggal: m.tanggal,
      bagian: m.penguji.map((p) => ({ peranLabel: p.peranLabel, nama: p.nama, rows: p.revisi.map((r) => ({ rujukan: r.halaman, catatan: r.catatan })) })),
    }
    try {
      const content = await batasWaktu(deps.pdf(form), Math.min(timeoutMs, PDF_MS), 'Melewati batas waktu PDF')
      return [{ filename: `${namaFormRevisi(form)}.pdf`, content, contentType: 'application/pdf' }]
    } catch (e) {
      console.error('Form revisi PDF gagal dibuat, email dikirim tanpa lampiran:', e instanceof Error ? e.message : 'error')
      return []
    }
  }

  const kirim = async (): Promise<DetailEmail[]> => {
    if (!transport) return semuaKe.map((alamat) => ({ alamat, status: 'gagal', alasan: TIDAK_DIKONFIGURASI }))
    if (semuaKe.length === 0) return []
    const attachments = await lampiran()
    try {
      const hasil = await batasWaktu(transport({ to, ...(cc.length ? { cc } : {}), ...renderRevisi({ ...m, revisi, kolom, lampiran: attachments.length > 0 }), attachments }), timeoutMs, 'Melewati batas waktu pengiriman')
      const terima = new Set(hasil.accepted.map((a) => a.toLowerCase()))
      return semuaKe.map((alamat) => terima.has(alamat.toLowerCase())
        ? { alamat, status: 'terkirim' as const }
        : { alamat, status: 'gagal' as const, alasan: 'Ditolak server email' })
    } catch (e) {
      const alasan = e instanceof Error ? e.message : String(e)
      return semuaKe.map((alamat) => ({ alamat, status: 'gagal' as const, alasan }))
    }
  }

  const dikirim = await kirim()
  const semua = [...sudah, ...dikirim, ...detail]
  const ok = semua.filter((x) => x.status === 'terkirim').length
  const status: EmailStatus = ok === 0 ? 'gagal' : ok === semua.length ? 'terkirim' : 'sebagian'
  // Order in the stored detail: earlier successes, this send's recipients, skipped ones last.
  await deps.simpan(defenseId, status, semua)
  return status
}

/**
 * The locked sidang's berita acara to its three examiners (kiprat 2026-11-25), apart from the revisi mail: it holds every
 * grade, so never to the student. PDF, or the Excel file when Aspose fails. Skipped for an old sidang, like the revisi mail.
 * ponytail: best effort, only logged; add an email status column and a retry button if a lost mail ever matters.
 */
export async function kirimBeritaAcara(defenseId: string, transport: Transport | null = smtpTransport()): Promise<void> {
  const db = createAdminClient()
  const data = await loadSidang(defenseId)
  const isi = data && beritaAcaraDariSidang(data, kopBaris((await loadSettings(db, data.defense.prodi, false)).kop_baris))
  if (!data || !isi || data.defense.tanggal < data.aturan.tanggalMulai) return
  if (!transport) {
    console.error('Berita acara sidang tidak dikirim:', TIDAK_DIKONFIGURASI)
    return
  }
  const kode = PERAN_SIDANG.flatMap((p) => (data.nilai[p] ? [data.nilai[p]!.kode_dosen] : []))
  const { data: dosen, error } = await db.from('lecturers').select('email').in('kode_dosen', kode)
  if (error) throw new Error(`Gagal memuat dosen: ${error.message}`)
  const to = [...new Set((dosen ?? []).map((d) => ((d.email as string | null) ?? '').trim()).filter((a) => a && !emailError(a)))]
  if (to.length === 0) return

  const xlsx = await buildBeritaAcaraXlsx(isi)
  const nama = istilah(data.defense.prodi, namaBeritaAcara('Sidang', data.defense.academic_year_id, data.defense.nama_mahasiswa))
  let lampiran: Lampiran
  try {
    lampiran = { filename: `${nama}.pdf`, content: await batasWaktu(convertXlsxToPdf(xlsx), PDF_MS, 'Melewati batas waktu PDF'), contentType: 'application/pdf' }
  } catch (e) {
    console.error('Berita acara PDF gagal dibuat, dikirim sebagai Excel:', e instanceof Error ? e.message : 'error')
    lampiran = { filename: `${nama}.xlsx`, content: xlsx, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  }
  const { nama_mahasiswa: mhs, npm } = data.defense
  const text = istilah(data.defense.prodi, `Yth. Bapak/Ibu Dosen Penguji,\n\nTerlampir Berita Acara Sidang Skripsi ${mhs} (${npm}).\n\nDemikian dan terima kasih.\n\nSalam,\nAkademik F.Psi UP`)
  const r = await batasWaktu(transport({
    to, subject: istilah(data.defense.prodi, `Berita Acara Sidang Skripsi — ${mhs} (${npm})`), text,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>`,
    attachments: [lampiran],
  }), MAKS_MS, 'Melewati batas waktu pengiriman')
  if (r.rejected.length) console.error('Berita acara sidang ditolak untuk', r.rejected.length, 'alamat')
}
