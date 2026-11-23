import { type Hasil, type PeranPrasidang, type StatusPrasidang } from './prasidang'

type PrasidangIn = { id: string; npm: string; tanggal: string; created_at: string }
type IsianIn = { defense_id: string; peran: PeranPrasidang; hasil: Hasil }
type KeputusanIn = { npm: string; prasidang_id: string | null; hasil: Hasil }

/** The student's latest S1 prasidang: by tanggal, then created_at (as the DB orders it). */
export function prasidangTerbaru<P extends PrasidangIn>(npm: string, prasidang: P[]): P | null {
  let best: P | null = null
  for (const p of prasidang) {
    if (p.npm !== npm) continue
    if (!best || p.tanggal > best.tanggal || (p.tanggal === best.tanggal && p.created_at > best.created_at)) best = p
  }
  return best
}

/** Same rules as status_prasidang() in the DB, for pages that list many students at once. */
export function statusPrasidang(npm: string, prasidang: PrasidangIn[], isian: IsianIn[], keputusan: KeputusanIn[]): StatusPrasidang {
  const p = prasidangTerbaru(npm, prasidang)
  const k = keputusan.find((x) => x.npm === npm && x.prasidang_id === (p?.id ?? null))
  if (k) return k.hasil
  if (!p) return 'tidak_ada'
  return hasilPendamping(p.id, isian)
}

/** A prasidang's verdict: its Pembimbing Pendamping's berita acara (an old pembahas row is ignored). */
const hasilPendamping = (defenseId: string, isian: IsianIn[]): StatusPrasidang =>
  isian.find((x) => x.defense_id === defenseId && x.peran === 'pendamping')?.hasil ?? 'belum_lengkap'

export type RekapPrasidang = {
  defenseId: string
  tanggal: string
  npm: string
  nama: string
  judul: string
  status: StatusPrasidang
  keputusan: { hasil: Hasil; alasan: string } | null
  adaSidang: boolean
}

type DefenseIn = PrasidangIn & { nama_mahasiswa: string; judul_skripsi: string }

/** One row per S1 prasidang of the year, in the order given (the SQL query sorts them). status is this prasidang's own berita acara; keputusan only if it is for this one. */
export function buildRekapPrasidang(
  defenses: DefenseIn[],
  isian: IsianIn[],
  keputusan: (KeputusanIn & { alasan: string })[],
  npmSidang: Set<string>,
): RekapPrasidang[] {
  return defenses
    .map((d): RekapPrasidang => {
      const k = keputusan.find((x) => x.npm === d.npm && x.prasidang_id === d.id)
      return {
        defenseId: d.id,
        tanggal: d.tanggal,
        npm: d.npm,
        nama: d.nama_mahasiswa,
        judul: d.judul_skripsi,
        status: hasilPendamping(d.id, isian),
        keputusan: k ? { hasil: k.hasil, alasan: k.alasan } : null,
        adaSidang: npmSidang.has(d.npm),
      }
    })
}
