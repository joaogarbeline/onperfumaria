import type { ReactNode } from 'react'

export function AdminTable({
  columns,
  children,
}: {
  columns: string[]
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white">
      <div className="hidden grid-cols-[1.2fr_1fr_1fr_0.9fr] gap-4 border-b border-stone-200 bg-[#f7f2eb] px-5 py-4 text-xs font-bold uppercase tracking-[0.22em] text-[#6b665f] md:grid">
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <div className="divide-y divide-stone-200">{children}</div>
    </div>
  )
}
