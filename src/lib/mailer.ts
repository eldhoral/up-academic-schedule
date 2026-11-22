import nodemailer from 'nodemailer'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailError, lecturerDisplayName } from '@/lib/import/tables'
import { PERAN_SIDANG, PERAN_SIDANG_LABEL, type PeranSidang } from '@/lib/penilaian/akses'
import { renderRevisi } from '@/lib/penilaian/email-revisi'
import { loadSettings } from '@/lib/settings'
import { parseDetailEmail, type DetailEmail } from '@/lib/penilaian/rekap'
import type { Revisi } from '@/lib/penilaian/nilai'
import { convertXlsxToPdf } from '@/lib/aspose'
import { buildFormRevisiXlsx, namaFormRevisi, type FormRevisi } from '@/lib/penilaian/form-revisi-xlsx'

export type Lampiran = { filename: string; content: Uint8Array; contentType: string }
export type Transport = (msg: { to: string[]; subject: string; text: string; html: string; attachments?: Lampiran[] }) => Promise<{ accepted: string[]; rejected: string[] }>
export type EmailStatus = 'tidak_perlu' | 'terkirim' | 'gagal' | 'sebagian'
export type { DetailEmail }

/** What a send needs, loaded once. `status` is hasil_sidang.email_status as it stands. */
export type MailData = {
  status: string
  /** hasil_sidang.email_detail as stored: who already got the mail. */
  detailLama: DetailEmail[]
  nama: string
  npm: string
  judul: string
  tanggal: string
  yudisium: string
  mahasiswaEmail: string | null
  penguji: { peranLabel: string; nama: string; email: string | null; revisi: Revisi }[]
  /** Pengaturan S1 'email_revisi_subjek' / 'email_revisi_isi'; missing = the built-in defaults. */
  template?: { subjek: string; isi: string }
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
const dbDeps: MailDeps = {
  async muat(defenseId) {
    const db = createAdminClient()
    const { data: d, error } = await db
      .from('defenses').select('id, npm, nama_mahasiswa, judul_skripsi, tanggal').eq('id', defenseId).maybeSingle()
    if (error) throw new Error(`Gagal memuat sidang: ${error.message}`)
    if (!d) return null
    const [hasil, nilai, mhs, settings] = await Promise.all([
      db.from('hasil_sidang').select('yudisium_label, email_status, email_detail').eq('defense_id', defenseId).maybeSingle(),
      db.from('nilai_sidang').select('peran, kode_dosen, ada_revisi, revisi').eq('defense_id', defenseId),
      db.from('students').select('email').eq('prodi', 's1').eq('npm', d.npm).maybeSingle(),
      loadSettings(db, 's1', false),
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
      status: hasil.data.email_status, detailLama: parseDetailEmail(hasil.data.email_detail), nama: d.nama_mahasiswa, npm: d.npm, judul: d.judul_skripsi, tanggal: d.tanggal,
      yudisium: hasil.data.yudisium_label, mahasiswaEmail: (mhs.data?.email as string | null | undefined) ?? null, penguji,
      template: { subjek: settings.email_revisi_subjek ?? '', isi: settings.email_revisi_isi ?? '' },
    }
  },
  async simpan(defenseId, status, detail) {
    const { error } = await createAdminClient().from('hasil_sidang').update({ email_status: status, email_detail: detail }).eq('defense_id', defenseId)
    if (error) throw new Error(`Gagal menyimpan status email: ${error.message}`)
  },
  pdf: async (form) => convertXlsxToPdf(await buildFormRevisiXlsx(form)),
}

/**
 * Sends the revisi mail (student + the three examiners, one message) and records the outcome on hasil_sidang.
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
  for (const [siapa, raw] of [['Mahasiswa', m.mahasiswaEmail], ...m.penguji.map((p) => [p.peranLabel, p.email] as const)] as const) {
    const alamat = (raw ?? '').trim()
    if (!alamat) detail.push({ alamat, status: 'dilewati', alasan: `Email ${siapa} kosong` })
    else if (emailError(alamat)) detail.push({ alamat, status: 'dilewati', alasan: `Email ${siapa} tidak valid` })
    else if (!sudahAda.has(alamat.toLowerCase()) && !to.some((a) => a.toLowerCase() === alamat.toLowerCase())) to.push(alamat)
  }

  // The attachment is a convenience (the body has every revisi): a PDF that fails or is late is left out, not a failed send.
  const lampiran = async (): Promise<Lampiran[]> => {
    if (!deps.pdf) return []
    const form: FormRevisi = {
      jenis: 'sidang', kolom: 'Halaman', hasil: m.yudisium, npm: m.npm, nama: m.nama, judul: m.judul, tanggal: m.tanggal,
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
    if (!transport) return to.map((alamat) => ({ alamat, status: 'gagal', alasan: TIDAK_DIKONFIGURASI }))
    if (to.length === 0) return []
    const attachments = await lampiran()
    try {
      const hasil = await batasWaktu(transport({ to, ...renderRevisi({ ...m, revisi }), attachments }), timeoutMs, 'Melewati batas waktu pengiriman')
      const terima = new Set(hasil.accepted.map((a) => a.toLowerCase()))
      return to.map((alamat) => terima.has(alamat.toLowerCase())
        ? { alamat, status: 'terkirim' as const }
        : { alamat, status: 'gagal' as const, alasan: 'Ditolak server email' })
    } catch (e) {
      const alasan = e instanceof Error ? e.message : String(e)
      return to.map((alamat) => ({ alamat, status: 'gagal' as const, alasan }))
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
