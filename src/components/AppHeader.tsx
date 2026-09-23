import { createClient } from '@/lib/supabase/server'
import { signOutAction } from '@/app/actions/auth'
import { TextSizeController } from './TextSizeController'
import { HeaderNav } from './HeaderNav'

export async function AppHeader({ active }: { active: string }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <header className="min-h-[3.4rem] flex items-center gap-[1rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)] flex-wrap">
      <div className="flex items-center gap-x-[1.5rem] gap-y-[0.4rem]">
        <span className="text-[1.07rem] font-semibold tracking-[-0.01em]">Penjadwalan Perkuliahan</span>
        <HeaderNav active={active} />
      </div>

      {/* ml-auto (not the parent's justify-between) so this group stays flush right even
          when it wraps onto its own line — an auto margin still applies on a lone wrapped
          flex item, unlike justify-content, which needs 2+ items on the line to do anything. */}
      <div className="flex items-center gap-[1.2rem] ml-auto">
        <TextSizeController />
        <div className="flex items-center gap-[0.8rem] pl-[0.8rem] border-l border-[var(--garis)] text-[0.87rem]">
          <span className="text-[var(--tinta-3)] truncate max-w-[12rem]">{user?.email || 'Admin'}</span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="px-[0.6rem] py-[0.3rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[var(--tinta-2)] hover:bg-[var(--cekung)] cursor-pointer text-[0.87rem]"
            >
              Keluar
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
