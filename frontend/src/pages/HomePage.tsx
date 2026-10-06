import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { isSiteModuleRenderable } from '../components/site/moduleContent'
import { SiteModuleRenderer } from '../components/site/SiteModuleRenderer'
import { useOrganizerStore } from '../hooks/useOrganizerStore'
import { api } from '../services/api'
import type { Product } from '../types'
import { getOrganizerPageModules, isOrganizerNodeAvailable, isOrganizerPreviewMode } from '../types/organizer'

type HomeData = {
  hero: { title: string; subtitle: string; imageUrl?: string; ctaLabel?: string; ctaLink?: string }
  featured: Product[]
  categories: Record<string, number>
  benefits: string[]
}

export function HomePage() {
  const [data, setData] = useState<HomeData | null>(null)
  const { store } = useOrganizerStore()
  const location = useLocation()
  const previewMode = isOrganizerPreviewMode(location.search)

  useEffect(() => {
    api
      .get<HomeData>('/store/home')
      .then(setData)
      .catch(() => setData(null))
  }, [])

  const dynamicBrands = Array.from(new Set((data?.featured ?? []).map((product) => product.brand)))
  const brands = dynamicBrands
  const modules = getOrganizerPageModules(store.nodes, 'home').filter(
    (node) =>
      isOrganizerNodeAvailable(node, previewMode) &&
      isSiteModuleRenderable(node, store.nodes, brands, previewMode),
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
          />
        </Reveal>
      ))}
    </div>
  )
}
