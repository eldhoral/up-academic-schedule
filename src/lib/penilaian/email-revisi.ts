import { tanggalPanjang } from '@/lib/hari'
import { substituteTemplate } from '@/lib/print'
import type { Revisi } from './nilai'

/** Defaults of the 'email_revisi_subjek' / 'email_revisi_isi' settings (S1), used when a setting is missing or blank. */
export const SUBJEK_REVISI_BAWAAN = 'Revisi Sidang Skripsi — {nama} ({npm})'
export const ISI_REVISI_BAWAAN =
  'Kepada Yth,\n{nama}\n\n\nBerikut dikirimkan Form Revisi Sidang Skripsi\nSemester {semester}.\n\nDemikian dan terima kasih.\n\nSalam,\nAkademik F.Psi UP'

/** Defaults of the 'email_prasidang_subjek' / 'email_prasidang_isi' settings (S1). {hasil} = hasil prasidang. */
export const SUBJEK_PRASIDANG = 'Catatan Prasidang Skripsi — {nama} ({npm})'
export const ISI_PRASIDANG =
  'Kepada Yth,\n{nama}\n\n\nBerikut dikirimkan Form Revisi (catatan) Prasidang Skripsi\nSemester {semester}.\n\nHasil prasidang: {hasil}\n\nDemikian dan terima kasih.\n\nSalam,\nAkademik F.Psi UP'

/** academic_years.id "20252" → { semester: 'Genap', mulai: 2025 } (last digit 1 = Gasal, 2 = Genap); null if not that shape. */
export function semesterParts(academicYearId: string): { semester: 'Gasal' | 'Genap'; mulai: number } | null {
  const m = /^(\d{4})([12])$/.exec(academicYearId.trim())
  return m ? { semester: m[2] === '1' ? 'Gasal' : 'Genap', mulai: Number(m[1]) } : null
}

/** academic_years.id "20252" → "Genap TA. 2025/2026"; anything else as is. */
export function semesterTA(academicYearId: string): string {
  const p = semesterParts(academicYearId)
  return p ? `${p.semester} TA. ${p.mulai}/${p.mulai + 1}` : academicYearId
}

export type RevisiInput = {
  nama: string
  npm: string
  judul: string
  tanggal: string
  yudisium: string
  /** defenses.academic_year_id, shown via semesterTA() as {semester}. */
  academicYearId: string
  /** Only examiners with revisi rows; the caller filters. */
  revisi: { peranLabel: string; nama: string; rows: Revisi }[]
  /** The admin's templates from Pengaturan; blank or missing = the defaults above. */
  template?: { subjek: string; isi: string }
  /** The form revisi PDF is attached: a body without {revisi} then gets no tables appended. */
  lampiran?: boolean
  /** What rows[].halaman holds: 'Halaman' (sidang, default) or 'Pertanyaan' (prasidang: the question text). */
  kolom?: string
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/**
 * The revisi mail from the admin's templates. {revisi} is each examiner's revisi table; a body without it gets the
 * tables at the end unless the form PDF is attached, so the student always receives them. Grades are never part of it.
 */
export function renderRevisi(i: RevisiInput): { subject: string; text: string; html: string } {
  const ada = i.revisi.filter((r) => r.rows.length > 0)
  const vars = { nama: i.nama, npm: i.npm, judul: i.judul, tanggal: tanggalPanjang(i.tanggal, false), yudisium: i.yudisium, semester: semesterTA(i.academicYearId), hasil: i.yudisium }
  const prasidang = i.kolom === 'Pertanyaan'
  const subjekT = i.template?.subjek.trim() || (prasidang ? SUBJEK_PRASIDANG : SUBJEK_REVISI_BAWAAN)
  const isiT0 = i.template?.isi.trim() ? i.template.isi.replace(/\r\n?/g, '\n') : prasidang ? ISI_PRASIDANG : ISI_REVISI_BAWAAN
  const isiT = isiT0.includes('{revisi}') || i.lampiran ? isiT0 : `${isiT0}\n\n{revisi}`

  const subject = substituteTemplate(subjekT, vars).replace(/\s*[\r\n]+\s*/g, ' ')

  const kolom = i.kolom ?? 'Halaman'
  const rujukan = (h: string) => (kolom === 'Halaman' ? `Halaman ${h || '-'}` : h || '-')
  // The sidang form no longer asks for a halaman (kiprat 2026-11-26): the column shows only when a row has one.
  const pakai = (rows: Revisi) => kolom !== 'Halaman' || rows.some((x) => x.halaman?.trim())
  const revisiText = ada.flatMap((r, n) => [
    ...(n ? [''] : []), `${r.peranLabel}: ${r.nama}`, ...r.rows.map((x) => `- ${pakai(r.rows) ? `${rujukan(x.halaman)}: ` : ''}${x.catatan}`),
  ]).join('\n')
  const text = substituteTemplate(isiT, { ...vars, revisi: revisiText })

  const cell = 'border:1px solid #ccc;padding:4px 8px;vertical-align:top'
  const revisiHtml = ada.map((r) => [
    `<p><b>${esc(r.peranLabel)}: ${esc(r.nama)}</b></p>`,
    `<table style="border-collapse:collapse"><tr>${pakai(r.rows) ? `<th style="${cell}">${esc(kolom)}</th>` : ''}<th style="${cell}">Catatan revisi</th></tr>`,
    ...r.rows.map((x) => `<tr>${pakai(r.rows) ? `<td style="${cell}">${esc(x.halaman) || '-'}</td>` : ''}<td style="${cell};white-space:pre-wrap">${esc(x.catatan)}</td></tr>`),
    '</table>',
  ].join('')).join('')
  // Escape the admin's text first, then fill in escaped values; only {revisi} brings markup.
  const escVars = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, esc(v)]))
  const body = esc(isiT).split('{revisi}').map((part) => substituteTemplate(part, escVars).replace(/\n/g, '<br>')).join(`</div>${revisiHtml}<div>`)
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px"><div>${body}</div></div>`

  return { subject, text, html }
}
