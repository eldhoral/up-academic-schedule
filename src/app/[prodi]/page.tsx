import { redirect } from 'next/navigation'

/** Bare /s1 and /s2 have no page of their own; the [prodi] layout still guards access. */
export default function ProdiIndex() {
  redirect('/')
}
