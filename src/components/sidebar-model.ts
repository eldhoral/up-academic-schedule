import { sectionOf } from './nav-sections'
import { PRODI_CONFIG, accessibleProdi, canAccessProdi, type Prodi, type ProdiAccess } from '@/lib/prodi'
import { canManage, canWrite, type Role } from '@/lib/role-types'

export type IkonSidebar =
  | 'beranda'
  | 'kuliah'
  | 'ujian'
  | 'sidang'
  | 'penilaian'
  | 'master'
  | 'kalender'
  | 'bersama'
  | 'pengguna'
  | 'log'

export type ItemSidebar = {
  href: string
  label: string
  ikon: IkonSidebar
  aktif: boolean
  anak?: { href: string; label: string; aktif: boolean }[]
}

export type GrupSidebar = {
  judul: string | null
  items: ItemSidebar[]
}

export function sidebarModel({
  active,
  prodi,
  role,
  prodiAccess,
}: {
  active: string
  prodi?: Prodi
  role: Role
  prodiAccess: ProdiAccess
}): GrupSidebar[] {
  const groups: GrupSidebar[] = []

  // 1. Beranda
  groups.push({
    judul: null,
    items: [
      {
        href: '/',
        label: 'Beranda',
        ikon: 'beranda',
        aktif: active === '/',
      },
    ],
  })

  // 2. Per-prodi groups
  const prodis = accessibleProdi(prodiAccess)
  for (const p of prodis) {
    const c = PRODI_CONFIG[p]
    const isCurrentProdi = prodi === p
    const items: ItemSidebar[] = [
      {
        href: `/${p}/kuliah`,
        label: 'Jadwal Mata Kuliah & Dosen',
        ikon: 'kuliah',
        aktif: isCurrentProdi && active.startsWith('/kuliah'),
      },
      {
        href: `/${p}/ujian`,
        label: 'Jadwal ETS & EAS',
        ikon: 'ujian',
        aktif: isCurrentProdi && active.startsWith('/ujian'),
      },
    ]

    if (p === 's1') {
      const s1DefenseSection = sectionOf(
        '/sidang',
        's1',
        canManage(role),
        canWrite(role) && canAccessProdi(prodiAccess, 's1'),
      )
      const rawNilaiItems = s1DefenseSection?.group?.items ?? []
      const isPenilaianPath =
        active.startsWith('/nilai-sidang/') ||
        active.startsWith('/berita-acara-prasidang/') ||
        active.startsWith('/nilai-bimbingan/') ||
        (isCurrentProdi &&
          active.startsWith('/sidang/') &&
          rawNilaiItems.some((child) => child.href === `/${p}${active}` || child.href === active))

      items.push({
        href: `/${p}/sidang`,
        label: `Jadwal ${c.defense.section}`,
        ikon: 'sidang',
        aktif: isCurrentProdi && active.startsWith('/sidang') && !isPenilaianPath,
      })

      const anak = rawNilaiItems.map((child) => {
        let childAktif = false
        if (isCurrentProdi && (child.href === `/${p}${active}` || child.href === active)) {
          childAktif = true
        } else if (child.href.endsWith('/nilai-sidang') && active.startsWith('/nilai-sidang/')) {
          childAktif = true
        } else if (child.href.endsWith('/hasil-prasidang') && active.startsWith('/berita-acara-prasidang/')) {
          childAktif = true
        } else if (child.href.endsWith('/nilai-bimbingan') && active.startsWith('/nilai-bimbingan/')) {
          childAktif = true
        }
        return {
          href: child.href,
          label: child.label,
          aktif: childAktif,
        }
      })

      items.push({
        href: anak[0]?.href ?? '/s1/sidang/hasil-prasidang',
        label: 'Penilaian',
        ikon: 'penilaian',
        aktif: isPenilaianPath,
        anak,
      })
    } else {
      items.push({
        href: `/${p}/sidang`,
        label: `Jadwal ${c.defense.section}`,
        ikon: 'sidang',
        aktif: isCurrentProdi && active.startsWith('/sidang'),
      })
    }

    items.push({
      href: `/${p}/mata-kuliah`,
      label: 'Data Master',
      ikon: 'master',
      aktif:
        isCurrentProdi &&
        (active === '/mata-kuliah' ||
          active.startsWith('/mata-kuliah/') ||
          active === '/mahasiswa' ||
          active.startsWith('/mahasiswa/') ||
          active === '/sesi' ||
          active.startsWith('/sesi/') ||
          active.startsWith('/pengaturan')),
    })

    groups.push({
      judul: c.label,
      items,
    })
  }

  // 3. Shared group
  groups.push({
    judul: null,
    items: [
      {
        href: '/kalender',
        label: 'Kalender Gabungan',
        ikon: 'kalender',
        aktif: !prodi && (active === '/kalender' || active.startsWith('/kalender/')),
      },
      {
        href: '/dosen',
        label: 'Data Bersama',
        ikon: 'bersama',
        aktif:
          !prodi &&
          (active === '/dosen' ||
            active.startsWith('/dosen/') ||
            active === '/ruangan' ||
            active.startsWith('/ruangan/') ||
            active === '/tahun-akademik' ||
            active.startsWith('/tahun-akademik/')),
      },
    ],
  })

  // 4. Admin & Logs group
  const adminItems: ItemSidebar[] = []
  if (canManage(role)) {
    adminItems.push({
      href: '/pengguna',
      label: 'Pengguna',
      ikon: 'pengguna',
      aktif: !prodi && (active === '/pengguna' || active.startsWith('/pengguna/')),
    })
  }
  adminItems.push({
    href: '/log-aktivitas',
    label: 'Log Aktivitas',
    ikon: 'log',
    aktif: !prodi && (active === '/log-aktivitas' || active.startsWith('/log-aktivitas/')),
  })

  groups.push({
    judul: null,
    items: adminItems,
  })

  return groups
}
