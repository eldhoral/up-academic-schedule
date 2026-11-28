import ExcelJS from 'exceljs'
import { tanggalPanjang } from '@/lib/hari'
import { addKop, addSignatureImage, istilahLembar } from '@/lib/xlsx'
import type { BeritaAcara } from './data'
import { semesterParts } from './email-revisi'
import { HASIL_LABEL } from './prasidang'

/** Who signs and the kop: Pengaturan S1 'kop_baris' (lines) and the cetak penandatangan (Ketua Program Studi). */
export type BeritaAcaraCetak = { kop: string[]; jabatan: string; nama: string; gambarTandaTangan: string }

/** "GASAL 2026/2027" from academic_years.id "20261"; the id itself if it is not that shape. */
const semesterJudul = (id: string) => {
  const p = semesterParts(id)
  return p ? `${p.semester.toUpperCase()} ${p.mulai}/${p.mulai + 1}` : id
}

/** Berita acara file name without extension, as the faculty names them: "BA Prasidang Gasal 2026-2027- Fadel Ayafa Diraja". */
export function namaBeritaAcara(jenis: 'Prasidang' | 'Sidang', academicYearId: string, namaMahasiswa: string): string {
  const p = semesterParts(academicYearId)
  const ta = p ? `${p.semester} ${p.mulai}-${p.mulai + 1}` : academicYearId
  return `BA ${jenis} ${ta}- ${namaMahasiswa}`.replace(/[^\w .-]/g, '')
}

/**
 * The Pembimbing Pendamping's berita acara of one S1 prasidang, in the faculty's layout (BA Prasidang sample,
 * 2026-11-23): kop, title with the semester, the student, Sekretaris Sidang (= Pendamping) and Dosen Pembahas,
 * the uraian answers as "Saran dan Perbaikan", the verdict, the Ya/Tidak answers, signed by the Ketua Program Studi.
 * A4 landscape, one page (long answers shrink it, as the sample is one page).
 */
export async function buildBeritaAcaraPrasidangXlsx(d: BeritaAcara, c: BeritaAcaraCetak): Promise<Uint8Array<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Berita Acara Prasidang', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, horizontalCentered: true },
  })
  ws.columns = [{ width: 40 }, { width: 3 }, { width: 100 }]
  ws.properties.defaultRowHeight = 15
  const KECIL = { size: 10 }

  if (c.kop.length) addKop(wb, ws, c.kop)
  ws.addRow([])
  for (const t of ['BERITA ACARA', `PRASIDANG SKRIPSI SEMESTER ${semesterJudul(d.academicYearId)}`]) {
    const r = ws.addRow([t])
    ws.mergeCells(r.number, 1, r.number, 3)
    r.font = { bold: true, size: 13 }
    r.alignment = { horizontal: 'center' }
  }
  ws.addRow([])

  /** LABEL : value, wrapped; the row grows with the longer of the two. */
  const isian = (label: string, value: string, bold = false) => {
    const r = ws.addRow([label.toUpperCase(), ':', value])
    r.font = { ...KECIL, bold }
    r.eachCell((cell) => { cell.alignment = { wrapText: true, vertical: 'top' } })
    // ponytail: 10pt text fits ~1.2 chars per width unit; Aspose clips a row stored too short, so round lines up.
    const baris = Math.max(...[[label, 40], [value, 100]].map(([t, w]) =>
      String(t).split('\n').reduce((n, s) => n + Math.max(1, Math.ceil(s.length / ((w as number) * 1.2))), 0)))
    r.height = Math.max(15, baris * 13)
  }

  const { defense: def } = d
  isian('Hari, Tanggal', tanggalPanjang(def.tanggal, false))
  isian('NPM', def.npm)
  isian('Nama Mahasiswa', def.nama_mahasiswa)
  isian('Judul Proposal', def.judul_skripsi || '—')
  ws.addRow([])
  isian('Sekretaris Sidang', d.dosen.pendamping)
  isian('Dosen Pembahas', d.dosen.pembahas)
  const sub = ws.addRow(['', '', 'SARAN DAN PERBAIKAN PROPOSAL SKRIPSI'])
  sub.font = { ...KECIL, bold: true }

  const ba = d.isian.pendamping
  if (!ba) {
    isian('Berita acara', 'Belum diisi.')
  } else {
    for (const j of ba.jawaban) if (j.jenis === 'uraian') isian(j.teks, j.catatan)
    isian('Berdasarkan hasil prasidang, maka proposal skripsi ini', HASIL_LABEL[ba.hasil])
    for (const j of ba.jawaban) if (j.jenis === 'ya_tidak') isian(j.teks, `${j.ya ? 'Ya' : 'Tidak'}${j.catatan ? `/${j.catatan}` : ''}`)
  }
  if (d.keputusan) isian('Keputusan Super Admin', `${HASIL_LABEL[d.keputusan.hasil]} — ${d.keputusan.alasan}`)

  // Signature block in column C, centred, as in the sample.
  ws.addRow([])
  const tengah = (t: string, bold = false) => {
    const r = ws.addRow(['', '', t])
    r.getCell(3).font = { ...KECIL, bold }
    r.getCell(3).alignment = { horizontal: 'center' }
    return r
  }
  tengah('Mengetahui,')
  const jabatan = tengah(c.jabatan)
  addSignatureImage(wb, ws, c.gambarTandaTangan, { from: 3, to: 3, jabatanRow: jabatan.number })
  for (let i = 0; i < 4; i++) ws.addRow([])
  tengah(c.nama, true)

  istilahLembar(ws, d.defense.prodi)
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}
