import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { ItemCardContent } from '../components/item/ItemCard'
import { Reveal } from '../components/Reveal'
import { isSiteModuleRenderable } from '../components/site/moduleContent'
import { SiteModuleRenderer } from '../components/site/SiteModuleRenderer'
import { useAuth } from '../contexts/AuthContext'
import { useOrganizerStore } from '../hooks/useOrganizerStore'
import { api } from '../services/api'
import type { Product } from '../types'
import { getOrganizerPageModules, isOrganizerNodeAvailable, isOrganizerPreviewMode } from '../types/organizer'
import { productToItemCardContent } from '../utils/productModel'
import { getSessionId } from '../utils/sessionId'

type HomeData = {
  hero: { title: string; subtitle: string; imageUrl?: string; ctaLabel?: string; ctaLink?: string }
  featured: Product[]
  categories: Record<string, number>
  benefits: string[]
}

type HomeCarousels = {
  onSale: Product[]
  lowStock: Product[]
  newArrivals: Product[]
}

// Ids fixos dos carrosseis "builtin" da home (ver homeModuleNames em
// types/organizer.ts) que ganham complemento automatico por regra. Os
// outros (Visto recentemente, Recomendado, Mais procurados) ainda dependem
// so de curadoria manual ate a personalizacao entrar numa proxima etapa.
const AUTO_CAROUSEL_MODULE_IDS: Record<string, keyof HomeCarousels> = {
  'home-products-2': 'newArrivals',
  'home-products-4': 'onSale',
  'home-products-6': 'lowStock',
}

export function HomePage() {
  const [data, setData] = useState<HomeData | null>(null)
  const [autoCarousels, setAutoCarousels] = useState<HomeCarousels | null>(null)
  const { store } = useOrganizerStore()
  const { token } = useAuth()
  const location = useLocation()
  const previewMode = isOrganizerPreviewMode(location.search)

  useEffect(() => {
    api
      .get<HomeData>('/store/home')
      .then(setData)
      .catch(() => setData(null))
  }, [])

  useEffect(() => {
    api
      .get<HomeCarousels>(`/store/home-carousels?sessionId=${getSessionId()}`, token ?? undefined)
      .then(setAutoCarousels)
      .catch(() => setAutoCarousels(null))
  }, [token])

  const dynamicBrands = Array.from(new Set((data?.featured ?? []).map((product) => product.brand)))
  const brands = dynamicBrands
  const autoItemsByModuleId: Record<string, ItemCardContent[]> = {}
  for (const [moduleId, ruleKey] of Object.entries(AUTO_CAROUSEL_MODULE_IDS)) {
    const products = autoCarousels?.[ruleKey]
    if (products?.length) {
      autoItemsByModuleId[moduleId] = products.map(productToItemCardContent)
    }
  }

  const modules = getOrganizerPageModules(store.nodes, 'home').filter(
    (node) =>
      isOrganizerNodeAvailable(node, previewMode) &&
      (isSiteModuleRenderable(node, store.nodes, brands, previewMode) ||
        Boolean(autoItemsByModuleId[node.id]?.length)),
  )

  return (
    <div className="space-y-10 sm:space-y-12 lg:space-y-16">
      {modules.map((module, index) => (
        <Reveal key={module.id} delay={40 + index * 35}>
          <SiteModuleRenderer
            module={module}
            nodes={store.nodes}
            tags={store.tags}
            brands={brands}
            previewMode={previewMode}
            autoItems={autoItemsByModuleId[module.id]}
            showRating
          />
        </Reveal>
      ))}
    </div>
  )
}
