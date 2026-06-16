import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    document.body.classList.toggle('drawer-open', open)
    return () => document.body.classList.remove('drawer-open')
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Fechar menu lateral"
        className="absolute inset-0 bg-[#171412]/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-sm flex-col gap-5 border-l border-stone-200 bg-[#fafaf8] px-5 py-5 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl text-[#171412]">{title}</h2>
          <button
            aria-label="Fechar"
            className="rounded-full border border-stone-200 p-2 text-stone-600"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  )
}
