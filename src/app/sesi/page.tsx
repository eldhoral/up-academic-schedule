import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { getSettings, settingInt, settingText } from '@/lib/settings'
import { SesiClient, type SessionRow } from './SesiClient'

export default async function SesiPage() {
  const supabase = await createClient()
  const [{ data: sessions }, settings] = await Promise.all([
    supabase.from('sessions').select('*').order('hari').order('sesi_ke'),
    getSettings(),
  ])

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/sesi" />
      <main className="flex-1 p-[1.3rem] max-w-[1400px] w-full mx-auto">
        <SesiClient
          sessions={(sessions as SessionRow[]) ?? []}
          jamMulaiReguler={settingText(settings, 'jam_mulai_reguler', '07:30')}
          jamMulaiRegsus={settingText(settings, 'jam_mulai_regsus', '18:00')}
          jedaMenit={settingInt(settings, 'jeda_menit', 10)}
        />
      </main>
    </div>
  )
}
