import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/roles'
import { canAccessProdi, parseProdi } from '@/lib/prodi'

/** Every page under /s1/ and /s2/: an unknown prodi is a 404, a prodi the account can't use goes back to the menu. */
export default async function ProdiLayout({ children, params }: LayoutProps<'/[prodi]'>) {
  const prodi = parseProdi((await params).prodi)
  if (!prodi) notFound()
  const user = await getCurrentUser()
  if (!user) redirect('/masuk')
  if (!canAccessProdi(user.prodiAccess, prodi)) redirect('/')
  return children
}
