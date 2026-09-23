'use client'

import { Suspense, useActionState, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { TextSizeController } from '@/components/TextSizeController'
import { signInAction, resetPasswordAction, type AuthState } from '@/app/actions/auth'

function MasukForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/'
  const queryError = searchParams.get('error')

  const [state, formAction, isPending] = useActionState(signInAction, null)
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotState, setForgotState] = useState<AuthState | null>(null)
  const [isForgotPending, startForgotTransition] = useTransition()

  const errorMessage =
    state?.error ||
    (queryError === 'auth_callback_failed'
      ? 'Tautan autentikasi kedaluwarsa atau tidak valid. Silakan coba masuk kembali.'
      : null)

  function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault()
    startForgotTransition(async () => {
      const res = await resetPasswordAction(forgotEmail)
      setForgotState(res)
    })
  }

  return (
    <div className="w-full max-w-[25.3rem]">
      {/* Institution header */}
      <div className="mb-[1.6rem]">
        <p className="text-[0.93rem] font-medium text-[var(--tinta-2)] mb-[0.27rem]">
          Universitas Pancasila &middot; Jakarta
        </p>
        <h1 className="m-0 text-[1.6rem] font-semibold tracking-[-0.015em]">
          Penjadwalan Perkuliahan
        </h1>
        <p className="mt-[0.27rem] text-[0.93rem] text-[var(--tinta-3)]">
          Fakultas Psikologi &middot; Program Sarjana
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem]">
        <h2 className="m-0 text-[1.07rem] font-semibold mb-[1.2rem]">Masuk</h2>

        {/* Error Banner */}
        {errorMessage && (
          <div
            className="flex gap-[0.6rem] items-start bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.67rem_0.8rem] mb-[1.2rem]"
            role="alert"
            aria-live="polite"
          >
            <svg
              className="shrink-0 mt-[0.13rem]"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="7" stroke="var(--merah)" strokeWidth="1.5" />
              <path d="M8 4.5v4" stroke="var(--merah)" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="11.2" r=".9" fill="var(--merah)" />
            </svg>
            <div className="text-[0.93rem] text-[var(--merah-teks)] leading-[1.45]">
              <b className="block font-semibold text-[var(--merah)] mb-[0.13rem]">
                {errorMessage.includes('paused') || errorMessage.includes('rate limit')
                  ? 'Proses masuk sementara ditunda'
                  : errorMessage.includes('Supabase is not configured')
                  ? 'Catatan Konfigurasi'
                  : 'Email dan kata sandi tidak cocok'}
              </b>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form action={formAction} noValidate>
          <input type="hidden" name="redirectTo" value={redirectTo} />

          <div className="mb-[1.07rem]">
            <label
              htmlFor="email"
              className="block text-[0.93rem] font-medium mb-[0.33rem]"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              spellCheck="false"
              required
              placeholder="admin@univpancasila.ac.id"
              className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] p-[0.53rem_0.67rem] min-h-[2.8rem] text-[1rem] transition-colors focus:bg-[var(--lembar)]"
              aria-describedby="bantu-email"
            />
            <p className="mt-[0.33rem] text-[0.87rem] text-[var(--tinta-3)]" id="bantu-email">
              Alamat yang telah didaftarkan oleh administrator Anda.
            </p>
          </div>

          <div className="mb-[1.07rem]">
            <div className="flex items-baseline justify-between gap-[0.8rem] mb-[0.33rem]">
              <label htmlFor="sandi" className="text-[0.93rem] font-medium">
                Kata Sandi
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(true)
                  setForgotState(null)
                }}
                className="text-[0.87rem] text-[var(--biru)] hover:underline cursor-pointer bg-transparent border-0 p-0"
              >
                Lupa kata sandi?
              </button>
            </div>
            <div className="relative flex">
              <input
                id="sandi"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] p-[0.53rem_5rem_0.53rem_0.67rem] min-h-[2.8rem] text-[1rem] transition-colors focus:bg-[var(--lembar)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-[0.27rem] top-1/2 -translate-y-1/2 bg-transparent border-0 text-[var(--biru)] text-[0.87rem] cursor-pointer p-[0.53rem] min-h-[2.4rem] underline"
                aria-pressed={showPassword}
              >
                {showPassword ? 'Sembunyikan' : 'Tampilkan'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            className="w-full bg-[var(--biru)] text-white border border-[var(--biru)] rounded-[var(--r-kecil)] p-[0.6rem_1rem] min-h-[2.93rem] text-[1rem] font-medium cursor-pointer transition-colors hover:bg-[var(--biru-hover)] active:scale-[0.985] disabled:bg-[var(--biru-disabled)] disabled:border-[var(--biru-disabled)] disabled:cursor-default"
          >
            {isPending ? 'Sedang masuk...' : 'Masuk'}
          </button>
        </form>

        <div className="mt-[1.2rem] pt-[1.07rem] border-t border-[var(--garis)] text-[0.87rem] text-[var(--tinta-3)] leading-[1.5]">
          Akun dibuat oleh administrator Fakultas Psikologi. Jika Anda memerlukan akses,
          atau akun Anda terkunci, hubungi administrator untuk didaftarkan.
        </div>
      </div>

      <p className="mt-[1.07rem] text-[0.8rem] text-[var(--tinta-3)] text-center">
        Sesi masuk Anda akan tersimpan di perangkat ini selama 7 hari.
      </p>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-title"
        >
          <div className="w-full max-w-[22rem] bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.4rem]">
            <h3 id="forgot-title" className="m-0 text-[1.1rem] font-semibold mb-[0.6rem]">
              Atur ulang kata sandi
            </h3>
            <p className="text-[0.87rem] text-[var(--tinta-3)] mb-[1rem] leading-[1.4]">
              Masukkan alamat email yang telah terdaftar. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi Anda.
            </p>

            {forgotState?.message && (
              <div className="bg-[var(--biru-lembut)] border border-[var(--biru)]/20 rounded-[var(--r-kecil)] p-[0.67rem] text-[0.87rem] text-[var(--tinta)] mb-[1rem]">
                {forgotState.message}
              </div>
            )}
            {forgotState?.error && (
              <div className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.67rem] text-[0.87rem] text-[var(--merah-teks)] mb-[1rem]">
                {forgotState.error}
              </div>
            )}

            {!forgotState?.success ? (
              <form onSubmit={handleForgotSubmit}>
                <div className="mb-[1rem]">
                  <label htmlFor="forgot-email" className="block text-[0.87rem] font-medium mb-[0.3rem]">
                    Email terdaftar
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="admin@univpancasila.ac.id"
                    className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] p-[0.4rem_0.6rem] text-[0.93rem]"
                  />
                </div>
                <div className="flex gap-[0.5rem] justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-3 py-1.5 border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] text-[0.87rem] bg-[var(--lembar)] hover:bg-[var(--cekung)] cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isForgotPending}
                    className="px-4 py-1.5 bg-[var(--biru)] text-white border border-[var(--biru)] rounded-[var(--r-kecil)] text-[0.87rem] font-medium hover:bg-[var(--biru-hover)] cursor-pointer disabled:opacity-60"
                  >
                    {isForgotPending ? 'Mengirim...' : 'Kirim tautan'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex justify-end mt-[1rem]">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="px-4 py-1.5 bg-[var(--biru)] text-white rounded-[var(--r-kecil)] text-[0.87rem] font-medium"
                >
                  Tutup
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MasukPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      {/* Top bar with text scaler */}
      <div className="flex justify-end p-[0.8rem_1.3rem_0]">
        <TextSizeController />
      </div>

      {/* Centered login column wrapped in Suspense for useSearchParams */}
      <main className="flex-1 flex items-center justify-center p-[1.3rem]">
        <Suspense
          fallback={
            <div className="w-full max-w-[25.3rem] text-center p-8 text-[var(--tinta-3)]">
              Memuat halaman masuk...
            </div>
          }
        >
          <MasukForm />
        </Suspense>
      </main>
    </div>
  )
}
