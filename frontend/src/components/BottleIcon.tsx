import { useId } from 'react'

export function BottleIcon({ size = 24, className }: { size?: number; className?: string }) {
  const maskId = useId()

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <mask id={maskId}>
        <rect x="0" y="0" width="24" height="24" fill="white" />
        <rect x="9.5" y="13" width="5" height="6" rx="1" fill="black" />
      </mask>
      <g fill="currentColor" mask={`url(#${maskId})`}>
        <rect x="9" y="2" width="6" height="4" rx="1.5" />
        <rect x="5" y="5" width="14" height="17" rx="4" />
      </g>
    </svg>
  )
}
