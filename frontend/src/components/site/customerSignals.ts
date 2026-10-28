import { useEffect, useState } from 'react'
import { api } from '../../services/api'

/** O que da para saber do cliente sem pedir nada: o que ele abriu neste
 * aparelho e o que a loja inteira mais procura. Alimenta os carrosseis
 * "Visto recentemente", "Recomendado para voce" e "Mais procurados". */
export type CustomerSignals = {
  recentIds: string[]
  popularIds: string[]
}

export const emptySignals: CustomerSignals = { recentIds: [], popularIds: [] }

const RECENT_KEY = 'onp:recently-viewed'
const RECENT_LIMIT = 20

function readRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function recordRecentlyViewed(productId: string) {
  if (!productId) return
  try {
    const next = [productId, ...readRecent().filter((id) => id !== productId)].slice(0, RECENT_LIMIT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Navegador sem armazenamento (aba anonima): o carrossel so nao aparece.
  }
}

let popularCache: Promise<string[]> | null = null

function loadPopular() {
  popularCache ??= api
    .get<{ ids: string[] }>('/store/popular')
    .then((data) => data.ids ?? [])
    .catch(() => {
      popularCache = null
      return []
    })
  return popularCache
}

export function useCustomerSignals(): CustomerSignals {
  const [recentIds] = useState(readRecent)
  const [popularIds, setPopularIds] = useState<string[]>([])

  useEffect(() => {
    let active = true
    void loadPopular().then((ids) => {
      if (active) setPopularIds(ids)
    })
    return () => {
      active = false
    }
  }, [])

  return { recentIds, popularIds }
}
