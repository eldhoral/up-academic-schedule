import ExcelJS from 'exceljs'
import { BORDER_ALL } from '@/lib/xlsx'
import { tanggalPanjang } from '@/lib/hari'
import { PERAN_SIDANG_LABEL, type PeranSidang } from './akses'
import type { AturanBeku, Yudisium } from './aturan'
import { baris, formatNilai, ipkSebelum } from './nilai'
import { hasilBeritaAcara } from './berita-acara-sidang'

/** Everything one locked sidang's berita acara shows. The numbers come from Nilai Sidang (hasilBeritaAcara). */
export type BeritaAcaraSidang = {
  npm: string
  nama: string
  judul: string
  tanggal: string
  pembimbing1: string | null
  pembimbing2: string | null
  penguji: { peran: PeranSidang; nama: string; nilai: number | null }[]
  aturan: AturanBeku
  pilihan: Yudisium[]
  yudisium: Yudisium
  sks: number | null
  bobot: number | null
  tepatWaktu: boolean
}

const TEMPAT = 'FAKULTAS PSIKOLOGI UNIVERSITAS PANCASILA'
const LABEL_BA: Record<PeranSidang, string> = { ketua: 'Ketua Penguji', anggota_1: 'Anggota Penguji 1', anggota_2: 'Anggota Penguji 2' }
const PENJELASAN: Record<string, string> = {
  'Lulus Dengan Revisi':
    'Lulus dengan revisi. Revisi dilakukan sampai dengan waktu yang sudah ditetapkan pembimbingan dari Dosen Pembimbing. Jika dalam batas waktu yang ditentukan revisi belum diselesaikan, kelulusan dianggap dibatalkan.',
  'Tidak Lulus': 'Mahasiswa yang tidak lulus dapat mengikuti Sidang Skripsi pada semester berikutnya.',
}

/** The BERITA ACARA tab of the sidang sheet, one sheet per file, A4 portrait. Numbers stay numbers (0.00). */
export async function buildBeritaAcaraXlsx(d: BeritaAcaraSidang): Promise<Uint8Array<ArrayBuffer>> {
  const h = hasilBeritaAcara({
    nilai: d.penguji.map((p) => p.nilai), aturan: d.aturan, lulus: d.yudisium.lulus, sks: d.sks, bobot: d.bobot, tepatWaktu: d.tepatWaktu,
  })
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Berita Acara', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })
  ws.columns = [{ width: 34 }, { width: 3 }, { width: 34 }, { width: 12 }, { width: 12 }, { width: 12 }]
  const huruf = (n: number | null) => (n === null ? '' : baris(n, d.aturan.tabelNilai).huruf)
  const tebal = (r: ExcelJS.Row) => { r.font = { bold: true } }
  const kosong = () => ws.addRow([])
  const isian = (label: string, value: string | number) => ws.addRow([label, ':', value])

  const judul = ws.addRow(['BERITA ACARA UJIAN SKRIPSI SARJANA (S1) PSIKOLOGI'])
  ws.mergeCells(judul.number, 1, judul.number, 6)
  judul.font = { bold: true, size: 13 }
  judul.alignment = { horizontal: 'center' }
  kosong()
  ws.addRow(['Pada hari ini'])
  isian('Hari/Tanggal', tanggalPanjang(d.tanggal, false))
  isian('Bertempat di', TEMPAT)
  kosong()
  ws.addRow(['Telah dilangsungkan Ujian Skripsi atas nama'])
  isian('NPM', d.npm)
  isian('Nama Mahasiswa', d.nama)
  isian('Judul Skripsi', d.judul || '—').getCell(3).alignment = { wrapText: true, vertical: 'top' }
  kosong()
  isian('Dosen Pembimbing 1', d.pembimbing1 ?? '—')
  isian('Dosen Pembimbing 2', d.pembimbing2 ?? '—')
  kosong()

  // I. Rincian nilai
  tebal(ws.addRow(['I. Rincian Nilai Sidang Skripsi']))
  const head = ws.addRow(['PENGUJI', '', 'NAMA', 'NILAI', 'NILAI HURUF'])
  tebal(head)
  const tabel: ExcelJS.Row[] = [head]
  for (const p of d.penguji) tabel.push(ws.addRow([LABEL_BA[p.peran] ?? PERAN_SIDANG_LABEL[p.peran], '', p.nama, p.nilai, huruf(p.nilai)]))
  const rata = ws.addRow(['RATA-RATA', '', '', h.nilaiSidang, h.huruf ?? ''])
  tebal(rata)
  tabel.push(rata)
  for (const r of tabel) for (let c = 1; c <= 5; c++) r.getCell(c).border = BORDER_ALL
  for (const r of tabel.slice(1)) r.getCell(4).numFmt = '0.00'
  kosong()

  // II. IPK (from Nilai Sidang, as the sheet did)
  tebal(ws.addRow(['II. Indeks Prestasi Kumulatif (IPK) Semester Berjalan']))
  tebal(ws.addRow(['', '', '', 'SKS', 'BOBOT', 'IPK']))
  if ('alasan' in h.ipk) {
    ws.addRow(['Kredit yang sudah diambil (sebelum skripsi)', '', '', d.sks ?? '', d.bobot ?? ''])
    ws.addRow(['IPK setelah Sidang Skripsi', '', h.ipk.alasan])
  } else {
    const i = h.ipk
    ws.addRow(['Kredit yang sudah diambil (sebelum skripsi)', '', '', i.sks, i.bobot, ipkSebelum(i.bobot, i.sks) ?? ''])
    ws.addRow(['Kredit skripsi', '', `Nilai ${formatNilai(h.nilaiSidang!)} · ${h.huruf} · mutu ${formatNilai(h.mutu!)}`, i.sksSkripsi, i.bobotSkripsi])
    ws.addRow(['Jumlah', '', '', i.jumlahSks, i.jumlahBobot])
    const ipk = ws.addRow(['IPK setelah Sidang Skripsi', '', '', '', '', i.ipkSetelah])
    tebal(ipk)
    ipk.getCell(6).numFmt = '0.00'
  }
  kosong()

  // III. Yudisium
  tebal(ws.addRow(['III. Yudisium']))
  // A yudisium renamed after the lock is not in today's list: print it anyway, ticked.
  const pilihan = d.pilihan.some((y) => y.label === d.yudisium.label) ? d.pilihan : [...d.pilihan, d.yudisium]
  for (const y of pilihan) {
    const pilih = y.label === d.yudisium.label
    ws.addRow([y.label, pilih ? '☒' : '☐'])
    if (PENJELASAN[y.label]) ws.addRow([PENJELASAN[y.label]]).getCell(1).alignment = { wrapText: true }
  }
  const predikat = 'alasan' in h.ipk ? '—' : (h.ipk.predikat ?? '—')
  tebal(ws.addRow(['Predikat Kelulusan', ':', predikat]))
  kosong()
  ws.addRow(['Yudisium berdasarkan IPK kelulusan dengan rincian sebagai berikut:'])
  d.aturan.predikat.forEach((p, i) =>
    ws.addRow([`${i + 1}.  IPK ${formatNilai(p.min)} – ${formatNilai(p.max)}  ${p.predikat}${p.butuhTepatWaktu ? ' (hanya bila lulus tepat waktu)' : ''}`]),
  )

  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf as ArrayBuffer)
}
