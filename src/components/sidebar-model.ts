import { PRODI_CONFIG, accessibleProdi, canAccessProdi, type Prodi, type ProdiAccess } from '@/lib/prodi'
import { canManage, canWrite, type Role } from '@/lib/role-types'
import { sectionOf } from './nav-sections'

export type IkonSidebar = 'beranda' | 'kuliah' | 'ujian' | 'sidang' | 'penilaian' | 'master' | 'kalender' | 'bersama' | 'pengguna' | 'log'

export type ItemSidebar = {
  href: string
  label: string
  ikon: IkonSidebar
  aktif: boolean
  anak?: { href: string; label: string; aktif: boolean }[]
}

export type GrupSidebar = { judul: string | null; items: ItemSidebar[] }

/**
 * The sidebar as data: one Beranda group, one group per accessible prodi, the
 * shared-data group and the admin group. `active`/`prodi` are what pages pass to
 * AppHeader today (a prodi page sends a prodi-less path plus its prodi).
 */
export function sidebarModel({ active, prodi, role, prodiAccess }: { active: string; prodi?: Prodi; role: Role; prodiAccess: ProdiAccess }): GrupSidebar[] {
  const current = prodi ? `/${prodi}${active}` : active
  const groups: GrupSidebar[] = [
    { judul: null, items: [{ href: '/', label: 'Beranda', ikon: 'beranda', aktif: active === '/' }] },
  ]

  for (const p of accessibleProdi(prodiAccess)) {
    const c = PRODI_CONFIG[p]
    const diProdi = (path: string) => current.startsWith(`/${p}${path}`)

    // The Penilaian dropdown owns the grading paths; everything else under
    // /sidang/ (Kalender, Cetak) belongs to the Jadwal item.
    let anak: ItemSidebar['anak']
    if (p === 's1') {
      // Same rule the old header used for the Penilaian dropdown's Akun Penguji Eksternal.
      const children = sectionOf('/sidang', 's1', canManage(role), canWrite(role) && canAccessProdi(prodiAccess, 's1'))!.group!.items
      anak = children.map((child) => ({ ...child, aktif: current === child.href }))
    }
    const penilaianAktif = !!anak?.some((a) => a.aktif) || (!prodi && /^\/(nilai-sidang|berita-acara-prasidang|nilai-bimbingan)\//.test(active))

    const items: ItemSidebar[] = [
      { href: `/${p}/kuliah`, label: 'Jadwal Mata Kuliah & Dosen', ikon: 'kuliah', aktif: diProdi('/kuliah') },
      { href: `/${p}/ujian`, label: 'Jadwal UTS & UAS', ikon: 'ujian', aktif: diProdi('/ujian') },
      { href: `/${p}/sidang`, label: `Jadwal ${c.defense.section}`, ikon: 'sidang', aktif: diProdi('/sidang') && !penilaianAktif },
    ]
    if (anak) items.push({ href: anak[0].href, label: 'Penilaian', ikon: 'penilaian', aktif: penilaianAktif, anak })

    items.push({
      href: `/${p}/mata-kuliah`,
      label: 'Data Master',
      ikon: 'master',
      aktif: ['/mata-kuliah', '/mahasiswa', '/sesi', '/pengaturan'].some((path) => diProdi(path)),
    })
    groups.push({ judul: c.label, items })
  }

  groups.push({
    judul: null,
    items: [
      { href: '/kalender', label: 'Kalender Gabungan', ikon: 'kalender', aktif: active === '/kalender' },
      { href: '/dosen', label: 'Data Bersama', ikon: 'bersama', aktif: ['/dosen', '/ruangan', '/tahun-akademik'].some((path) => active.startsWith(path)) },
    ],
  })
  groups.push({
    judul: null,
    items: [
      ...(role === 'SUPERADMIN' ? [{ href: '/pengguna', label: 'Pengguna', ikon: 'pengguna' as const, aktif: active.startsWith('/pengguna') }] : []),
      { href: '/log-aktivitas', label: 'Log Aktivitas', ikon: 'log', aktif: active.startsWith('/log-aktivitas') },
    ],
  })

  return groups
}
