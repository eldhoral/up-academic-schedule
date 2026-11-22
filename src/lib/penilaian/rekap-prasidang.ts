import { gabungHasil, type Hasil, type PeranPrasidang, type StatusPrasidang } from './prasidang'

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
  const h = (peran: PeranPrasidang) => isian.find((x) => x.defense_id === p.id && x.peran === peran)?.hasil ?? null
  return gabungHasil(h('pendamping'), h('pembahas'))
}

export type RekapPrasidang = {
  defenseId: string
  tanggal: string
  npm: string
  nama: string
  judul: string
  pendamping: { nama: string; hasil: Hasil | null }
  pembahas: { nama: string; hasil: Hasil | null }
  gabungan: StatusPrasidang
  keputusan: { hasil: Hasil; alasan: string } | null
  adaSidang: boolean
}

type DefenseIn = PrasidangIn & { nama_mahasiswa: string; judul_skripsi: string; pembimbing_kode: string | null; penguji_kode: string | null }

/** One row per S1 prasidang of the year, in the order given (the SQL query sorts them). gabungan is this prasidang's own pair; keputusan only if it is for this one. */
export function buildRekapPrasidang(
  defenses: DefenseIn[],
  isian: IsianIn[],
  keputusan: (KeputusanIn & { alasan: string })[],
  npmSidang: Set<string>,
  namaDosen: (kode: string) => string,
): RekapPrasidang[] {
  return defenses
    .map((d): RekapPrasidang => {
      const h = (peran: PeranPrasidang) => isian.find((x) => x.defense_id === d.id && x.peran === peran)?.hasil ?? null
      const k = keputusan.find((x) => x.npm === d.npm && x.prasidang_id === d.id)
      return {
        defenseId: d.id,
        tanggal: d.tanggal,
        npm: d.npm,
        nama: d.nama_mahasiswa,
        judul: d.judul_skripsi,
        pendamping: { nama: d.pembimbing_kode ? namaDosen(d.pembimbing_kode) : '—', hasil: h('pendamping') },
        pembahas: { nama: d.penguji_kode ? namaDosen(d.penguji_kode) : '—', hasil: h('pembahas') },
        gabungan: gabungHasil(h('pendamping'), h('pembahas')),
        keputusan: k ? { hasil: k.hasil, alasan: k.alasan } : null,
        adaSidang: npmSidang.has(d.npm),
      }
    })
}
