import type { ReactNode } from 'react'

export function EmptyState({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="surface-soft flex flex-col items-center gap-4 px-6 py-10 text-center">
      <p className="eyebrow">{eyebrow}</p>
      <div className="space-y-2">
        <h3 className="text-3xl text-[#171412]">{title}</h3>
        <p className="mx-auto max-w-xl text-sm leading-6 text-[#6b665f]">{description}</p>
      </div>
      {action}
    </div>
  )
}
