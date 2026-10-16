import { AppHeader } from '@/components/AppHeader'
import { AturKataSandiForm } from './AturKataSandiForm'

export default function AturKataSandiPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/atur-kata-sandi" />
      <main className="flex-1 flex justify-center p-[1.3rem]">
        <AturKataSandiForm />
      </main>
    </div>
  )
}
