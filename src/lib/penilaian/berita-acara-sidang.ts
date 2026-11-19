import type { AturanBeku } from './aturan'
import { baris, ipkSetelah, nilaiSidang, predikat, round2 } from './nilai'

export type IpkBeritaAcara =
  | { sks: number; bobot: number; sksSkripsi: number; bobotSkripsi: number; jumlahSks: number; jumlahBobot: number; ipkSetelah: number; predikat: string | null }
  | { alasan: string }

/**
 * The berita acara's numbers, from Nilai Sidang as the sheet's BERITA ACARA tab did (not Nilai Akhir, user decision):
 * Nilai Sidang → huruf and mutu (frozen Tabel Nilai) → IPK setelah sidang and predikat (frozen rules).
 */
export function hasilBeritaAcara(i: {
  nilai: (number | null)[]
  aturan: AturanBeku
  lulus: boolean
  sks: number | null
  bobot: number | null
  tepatWaktu: boolean
}): { nilaiSidang: number | null; huruf: string | null; mutu: number | null; ipk: IpkBeritaAcara } {
  const ns = nilaiSidang(i.nilai)
  const b = ns === null ? null : baris(ns, i.aturan.tabelNilai)
  const out = { nilaiSidang: ns, huruf: b?.huruf ?? null, mutu: b?.mutu ?? null }
  if (!i.lulus) return { ...out, ipk: { alasan: 'Sidang tidak lulus.' } }
  if (i.sks === null || i.bobot === null) return { ...out, ipk: { alasan: 'SKS/Bobot sebelum sidang belum diisi.' } }
  if (!b) return { ...out, ipk: { alasan: 'Nilai sidang belum lengkap.' } }
  const sksSkripsi = i.aturan.sksSkripsi
  const ipk = ipkSetelah(i.bobot, i.sks, b.mutu, sksSkripsi)
  return {
    ...out,
    ipk: {
      sks: i.sks, bobot: i.bobot, sksSkripsi, bobotSkripsi: round2(sksSkripsi * b.mutu),
      jumlahSks: i.sks + sksSkripsi, jumlahBobot: round2(i.bobot + sksSkripsi * b.mutu),
      ipkSetelah: ipk, predikat: predikat(ipk, i.tepatWaktu, i.aturan.predikat),
    },
  }
}
