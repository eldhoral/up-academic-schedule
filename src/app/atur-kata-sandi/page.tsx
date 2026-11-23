import { AppShell } from '@/components/AppShell'
import { AturKataSandiForm } from './AturKataSandiForm'

export default function AturKataSandiPage() {
  return (
    <AppShell active="/atur-kata-sandi">
      <main className="flex-1 flex justify-center p-[1.3rem]">
        <AturKataSandiForm />
      </main>
    </AppShell>
  )
}
