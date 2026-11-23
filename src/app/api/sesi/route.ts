import { createClient } from '@/lib/supabase/server'

/**
 * Activity heartbeat from SesiAktif (at most once a minute): keeps this browser's session holding its account,
 * so a second login elsewhere is refused while it is active (sentuh_sesi, migration 20261124000001).
 */
export async function POST() {
  const supabase = await createClient()
  const { error } = await supabase.rpc('sentuh_sesi')
  if (error) console.error('sentuh_sesi failed:', error.message)
  return new Response(null, { status: 204 })
}
