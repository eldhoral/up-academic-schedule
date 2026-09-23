'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImportPanel } from '@/components/import/ImportPanel'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { createRoomAction, deleteRoomAction, updateRoomAction, type FormState } from './actions'

export type Room = {
  id: string
  nama: string
  kapasitas: number
  keterangan: string
  active: boolean
}

export function RuanganClient({ rooms }: { rooms: Room[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Room | 'new' | null>(null)

  return (
    <div className="space-y-[1.2rem]">
      <div className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem]">
        <div className="flex items-center justify-between pb-[1rem] border-b border-[var(--garis)] mb-[1.2rem] gap-[1rem] flex-wrap">
          <div>
            <h1 className="text-[1.3rem] font-semibold">Ruangan</h1>
            <p className="text-[0.93rem] text-[var(--tinta-3)] mt-[0.2rem]">
              {rooms.length} ruangan
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="px-[0.8rem] py-[0.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.98] transition-colors"
          >
            Tambah Ruangan
          </button>
        </div>

        <div className="overflow-x-auto border border-[var(--garis)] rounded-[var(--r-kecil)]">
          <table className="w-full text-[0.87rem] border-collapse">
            <thead className="bg-[var(--cekung)]">
              <tr>
                <Th>Nama</Th>
                <Th className="text-right">Kapasitas</Th>
                <Th>Keterangan</Th>
                <Th>Status</Th>
                <Th className="text-right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id} className="border-t border-[var(--garis)] h-[2.4rem]">
                  <Td className="mono">{r.nama}</Td>
                  <Td className="text-right mono">{r.kapasitas || '—'}</Td>
                  <Td>{r.keterangan || '—'}</Td>
                  <Td>
                    <span
                      className={`inline-block px-[0.4rem] py-[0.1rem] rounded-[var(--r-kecil)] text-[0.8rem] font-medium ${
                        r.active ? 'bg-[var(--hijau-lembut)] text-[var(--hijau)]' : 'bg-[var(--cekung)] text-[var(--tinta-3)]'
                      }`}
                    >
                      {r.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      className="text-[var(--biru)] hover:underline cursor-pointer bg-transparent border-0 p-0 text-[0.87rem]"
                    >
                      Ubah
                    </button>
                  </Td>
                </tr>
              ))}
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-[1.6rem] text-[var(--tinta-3)]">
                    Belum ada ruangan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ImportPanel tableSlug="rooms" label="Ruangan" onCommitted={() => router.refresh()} />

      {editing && <RoomFormModal room={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function RoomFormModal({ room, onClose }: { room: Room | null; onClose: () => void }) {
  const action = room ? updateRoomAction.bind(null, room.id) : createRoomAction
  const [state, formAction, isPending] = useActionState<FormState, FormData>(action, null)
  const router = useRouter()

  useEffect(() => {
    if (state && 'success' in state) {
      router.refresh()
      onClose()
    }
  }, [state, router, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-[26rem] bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.4rem]">
        <h3 className="m-0 text-[1.1rem] font-semibold mb-[1rem]">{room ? `Ubah ${room.nama}` : 'Tambah Ruangan'}</h3>

        {state && 'error' in state && (
          <div className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.87rem] text-[var(--merah)] mb-[1rem]">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-[0.8rem]">
          <Field label="Nama">
            <input
              name="nama"
              required
              defaultValue={room?.nama}
              className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem]"
            />
          </Field>
          <Field label="Kapasitas">
            <input
              name="kapasitas"
              type="number"
              min={0}
              defaultValue={room?.kapasitas ?? 0}
              className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mono"
            />
          </Field>
          <Field label="Keterangan">
            <input
              name="keterangan"
              defaultValue={room?.keterangan}
              className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem]"
            />
          </Field>
          <label className="flex items-center gap-[0.5rem] text-[0.93rem]">
            <input
              type="checkbox"
              name="active"
              defaultChecked={room?.active ?? true}
              className="w-[1rem] h-[1rem]"
            />
            Aktif
          </label>

          <div className="flex gap-[0.6rem] justify-between pt-[0.4rem]">
            {room && (
              <ConfirmDeleteButton
                onConfirm={async () => {
                  await deleteRoomAction(room.id)
                  router.refresh()
                  onClose()
                }}
              />
            )}
            <div className="flex gap-[0.6rem] ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[0.87rem] cursor-pointer hover:bg-[var(--cekung)]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-[0.8rem] py-[0.4rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] disabled:opacity-60"
              >
                {isPending ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[0.8rem] font-medium text-[var(--tinta-2)] mb-[0.25rem]">{label}</span>
      {children}
    </label>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-[0.6rem] py-[0.4rem] font-medium text-[var(--tinta-3)] ${className}`}>{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-[0.6rem] py-[0.4rem] ${className}`}>{children}</td>
}
