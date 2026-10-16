'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { updatePasswordAction } from '@/app/actions/auth'

const inputClass =
  'w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] p-[0.53rem_5rem_0.53rem_0.67rem] min-h-[2.8rem] text-[1rem] transition-colors focus:bg-[var(--lembar)]'

export function AturKataSandiForm() {
  const [state, formAction, isPending] = useActionState(updatePasswordAction, null)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="w-full max-w-[25.3rem] bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem] self-start">
      <h1 className="m-0 text-[1.07rem] font-semibold mb-[0.4rem]">Ganti kata sandi</h1>

      {state?.success ? (
        <>
          <div
            className="bg-[var(--biru-lembut)] border border-[var(--biru)]/20 rounded-[var(--r-kecil)] p-[0.67rem] text-[0.93rem] text-[var(--tinta)] my-[1rem]"
            role="status"
          >
            {state.message} Gunakan kata sandi baru ini saat masuk berikutnya.
          </div>
          <Link
            href="/"
            className="inline-block bg-[var(--biru)] text-white rounded-[var(--r-kecil)] px-[1rem] py-[0.6rem] text-[0.93rem] font-medium hover:bg-[var(--biru-hover)]"
          >
            Kembali ke menu
          </Link>
        </>
      ) : (
        <form action={formAction} noValidate>
          <p className="text-[0.87rem] text-[var(--tinta-3)] mb-[1.2rem] leading-[1.45]">
            Minimal 8 karakter. Kata sandi baru berlaku untuk masuk berikutnya.
          </p>

          {state?.error && (
            <div
              className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.67rem] text-[0.93rem] text-[var(--merah-teks)] mb-[1rem]"
              role="alert"
            >
              {state.error}
            </div>
          )}

          <label htmlFor="sandi-baru" className="block text-[0.93rem] font-medium mb-[0.33rem]">
            Kata sandi baru
          </label>
          <div className="relative flex mb-[1.07rem]">
            <input
              id="sandi-baru"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              className={inputClass}
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

          <label htmlFor="sandi-ulang" className="block text-[0.93rem] font-medium mb-[0.33rem]">
            Ulangi kata sandi baru
          </label>
          <input
            id="sandi-ulang"
            name="confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            className={`${inputClass} mb-[1.2rem]`}
          />

          <button
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            className="w-full bg-[var(--biru)] text-white border border-[var(--biru)] rounded-[var(--r-kecil)] p-[0.6rem_1rem] min-h-[2.93rem] text-[1rem] font-medium cursor-pointer transition-colors hover:bg-[var(--biru-hover)] disabled:bg-[var(--biru-disabled)] disabled:border-[var(--biru-disabled)] disabled:cursor-default"
          >
            {isPending ? 'Menyimpan…' : 'Simpan kata sandi'}
          </button>
        </form>
      )}
    </div>
  )
}
