import { useEffect, useRef, useState } from 'react'

/**
 * Numero que sobe ate o valor final quando entra na tela. Sinais quantificados
 * (clientes atendidos, avaliacao media, garantia) sao um gatilho classico de
 * prova social que reforca confianca e profissionalismo.
 */
export function StatCounter({
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
  label,
}: {
  value: number
  suffix?: string
  prefix?: string
  decimals?: number
  label: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    let frame = 0
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          observer.disconnect()

          const duration = 1400
          const start = performance.now()

          function tick(now: number) {
            const progress = Math.min(1, (now - start) / duration)
            const eased = 1 - Math.pow(1 - progress, 3)
            setDisplay(value * eased)
            if (progress < 1) {
              frame = requestAnimationFrame(tick)
            }
          }

          frame = requestAnimationFrame(tick)
        })
      },
      { threshold: 0.3 },
    )

    observer.observe(node)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value])

  return (
    <div ref={ref} className="space-y-1 text-center sm:text-left">
      <p className="text-4xl font-semibold text-white sm:text-5xl">
        {prefix}
        {display.toFixed(decimals)}
        {suffix}
      </p>
      <p className="text-sm leading-6 text-[#a9bedd]">{label}</p>
    </div>
  )
}
