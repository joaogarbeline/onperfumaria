import { useEffect, useState } from 'react'

/**
 * O cabecalho recolhe a parte de baixo (busca/categorias) ao rolar. Se ele
 * ficasse no fluxo da pagina, cada recolher/abrir empurraria o conteudo
 * ~100px para cima e para baixo; o Safari do iPhone nao compensa isso na
 * rolagem e o conteudo acabava escondido atras do menu ao voltar ao topo.
 * Por isso o cabecalho fica fixo por cima e a pagina reserva sempre a altura
 * dele ABERTO (parte recolhivel medida pelo scrollHeight, que nao muda quando
 * ela esta fechada). Devolve as refs (callback) e a altura a reservar.
 */
export function useStableHeaderSpace() {
  const [header, setHeader] = useState<HTMLElement | null>(null)
  const [collapsible, setCollapsible] = useState<HTMLElement | null>(null)
  const [space, setSpace] = useState(0)

  useEffect(() => {
    if (!header) return
    const measure = () => {
      const open = collapsible ? collapsible.scrollHeight - collapsible.offsetHeight : 0
      setSpace(header.offsetHeight + Math.max(0, open))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    if (collapsible?.firstElementChild) observer.observe(collapsible.firstElementChild)
    return () => observer.disconnect()
  }, [header, collapsible])

  return { headerRef: setHeader, collapsibleRef: setCollapsible, space }
}
