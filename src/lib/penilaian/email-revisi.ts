import { tanggalPanjang } from '@/lib/hari'
import type { Revisi } from './nilai'

export type RevisiInput = {
  nama: string
  npm: string
  judul: string
  tanggal: string
  yudisium: string
  /** Only examiners with revisi rows; the caller filters. */
  revisi: { peranLabel: string; nama: string; rows: Revisi }[]
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** The revisi mail: identity, yudisium and each examiner's revisi table. Grades are never part of it. */
export function renderRevisi(i: RevisiInput): { subject: string; text: string; html: string } {
  const tanggal = tanggalPanjang(i.tanggal, false)
  const ada = i.revisi.filter((r) => r.rows.length > 0)
  const subject = `Revisi Sidang Skripsi — ${i.nama} (${i.npm})`

  const text = [
    `Nama: ${i.nama}`, `NPM: ${i.npm}`, `Judul: ${i.judul}`, `Tanggal sidang: ${tanggal}`, `Yudisium: ${i.yudisium}`,
    ...ada.flatMap((r) => ['', `${r.peranLabel}: ${r.nama}`, ...r.rows.map((x) => `- Halaman ${x.halaman || '-'}: ${x.catatan}`)]),
  ].join('\n')

  const cell = 'border:1px solid #ccc;padding:4px 8px;vertical-align:top'
  const identitas = (k: string, v: string) => `<tr><td style="padding:2px 12px 2px 0"><b>${k}</b></td><td>${esc(v)}</td></tr>`
  const html = [
    '<div style="font-family:Arial,sans-serif;font-size:14px">',
    '<table style="border-collapse:collapse">',
    identitas('Nama', i.nama), identitas('NPM', i.npm), identitas('Judul', i.judul), identitas('Tanggal sidang', tanggal), identitas('Yudisium', i.yudisium),
    '</table>',
    ...ada.map((r) => [
      `<p><b>${esc(r.peranLabel)}: ${esc(r.nama)}</b></p>`,
      `<table style="border-collapse:collapse"><tr><th style="${cell}">Halaman</th><th style="${cell}">Catatan revisi</th></tr>`,
      ...r.rows.map((x) => `<tr><td style="${cell}">${esc(x.halaman) || '-'}</td><td style="${cell};white-space:pre-wrap">${esc(x.catatan)}</td></tr>`),
      '</table>',
    ].join('')),
    '</div>',
  ].join('')

  return { subject, text, html }
}
