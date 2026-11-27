import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { createClient } from '@/lib/supabase/server'
import { canManage, getCurrentRole } from '@/lib/roles'
import { DosenClient, type Lecturer } from './DosenClient'

export default async function DosenPage() {
  const supabase = await createClient()
  // Dosen eksternal are kept on the Akun Penguji Eksternal page (kiprat 2026-11-27), apart from internal dosen.
  const { data } = await supabase.from('lecturers').select('*').eq('eksternal', false).order('nama')

  return (
    <AppShell active="/dosen">
      <main className="flex-1 p-[1.3rem] max-w-[1400px] w-full mx-auto">
        <DosenClient lecturers={(data as Lecturer[]) ?? []} canEdit={canManage(await getCurrentRole())} />
        <p className="mt-[0.8rem] text-[0.87rem] text-[var(--tinta-3)]">
          Dosen eksternal dikelola di <Link href="/s1/sidang/akun-eksternal" className="text-[var(--biru)] hover:underline">Akun Penguji Eksternal</Link>.
        </p>
      </main>
    </AppShell>
  )
}
