import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { MahasiswaClient, type Student } from './MahasiswaClient'

export default async function MahasiswaPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('students').select('id, npm, nama, judul_skripsi').order('npm')

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/mahasiswa" />
      <main className="flex-1 p-[1.3rem] max-w-[1400px] w-full mx-auto">
        <MahasiswaClient students={(data as Student[]) ?? []} />
      </main>
    </div>
  )
}
