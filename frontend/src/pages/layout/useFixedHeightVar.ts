import { useEffect, useState } from 'react'

// Publica a altura de um elemento fixo numa variavel CSS do <html>, para o
// layout reservar espaco e outras barras se posicionarem em relacao a ele,
// mesmo quando a fonte do aparelho muda a altura. Devolve a ref para colocar
// no elemento (callback, para funcionar tambem quando ele aparece depois).
export function useFixedHeightVar(name: string) {
  const [element, setElement] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!element) return
    const root = document.documentElement
    const observer = new ResizeObserver(() => {
      root.style.setProperty(name, `${element.offsetHeight}px`)
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      root.style.removeProperty(name)
    }
  }, [element, name])

  return setElement
}
