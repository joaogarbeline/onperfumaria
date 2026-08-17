import type { CSSProperties, ElementType, PointerEvent, ReactNode } from 'react'
import { useRef, useState } from 'react'

type TiltCardProps = {
  as?: ElementType
  children: ReactNode
  className?: string
  /** Graus maximos de rotacao aplicados ao passar o ponteiro. */
  intensity?: number
  /** Reflexo de luz que acompanha o ponteiro, reforcando a sensacao de profundidade. */
  glare?: boolean
  [key: string]: unknown
}

const RESET_TRANSFORM = 'perspective(1200px) rotateX(0deg) rotateY(0deg) translateZ(0)'

export function TiltCard({
  as,
  children,
  className = '',
  intensity = 8,
  glare = true,
  ...props
}: TiltCardProps) {
  const Component = (as || 'div') as ElementType
  const ref = useRef<HTMLElement | null>(null)
  const [transform, setTransform] = useState(RESET_TRANSFORM)
  const [glareStyle, setGlareStyle] = useState<CSSProperties>({ opacity: 0 })

  function handleMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch') return
    const node = ref.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    const rotateX = (0.5 - y) * intensity
    const rotateY = (x - 0.5) * intensity

    setTransform(`perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(0)`)

    if (glare) {
      setGlareStyle({
        opacity: 1,
        background: `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.45), transparent 60%)`,
      })
    }
  }

  function handleLeave() {
    setTransform(RESET_TRANSFORM)
    setGlareStyle({ opacity: 0 })
  }

  return (
    <Component
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={{ transform }}
      className={`tilt-card relative ${className}`}
      {...props}
    >
      {children}
      {glare ? <span aria-hidden="true" className="tilt-glare" style={glareStyle} /> : null}
    </Component>
  )
}
