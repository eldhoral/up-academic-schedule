import { signOutAction } from '@/app/actions/auth'

/**
 * Stands in for a 404 on a grading page the signed-in account can't open, e.g. a jadwal-dosen link
 * opened in a browser still signed in as another dosen. Same card whether or not the record exists, so it
 * reveals nothing. Keluar signs out and returns to /masuk with this page as redirectTo.
 */
export function AkunLain({ email, path }: { email: string; path: string }) {
  return (
    <div className="min-h-screen flex items-start justify-center bg-[var(--kertas)] text-[var(--tinta)] px-[1.3rem] py-[2.5rem]">
      <div className="w-full max-w-[28rem] flex flex-col items-center gap-[0.5rem] text-center bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.6rem]">
        <h1 className="m-0 text-[1.07rem] font-semibold text-balance">Halaman ini tidak tersedia untuk akun ini</h1>
        <p className="m-0 text-[0.93rem] text-[var(--tinta-2)] text-pretty">
          Anda masuk sebagai <strong className="text-[var(--tinta)] break-all">{email || 'akun tanpa email'}</strong>.
          Jika tautan ini untuk dosen lain, keluar lalu masuk dengan akun dosen tersebut.
        </p>
        <form action={signOutAction} className="mt-[0.8rem]">
          <input type="hidden" name="redirectTo" value={path} />
          <button
            type="submit"
            className="min-h-[2.5rem] px-[1rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] bg-[var(--cekung)] text-[var(--tinta)] text-[0.93rem] font-medium cursor-pointer hover:bg-[var(--lembar)] active:scale-[0.97] transition-colors"
          >
            Keluar
          </button>
        </form>
      </div>
    </div>
  )
}
