import { useEffect, useState } from 'react'
import { Reveal } from '../components/Reveal'
import { SiteModuleRenderer } from '../components/site/SiteModuleRenderer'
import { useOrganizerStore } from '../hooks/useOrganizerStore'
import { api } from '../services/api'
import type { Product } from '../types'
import { getOrganizerPageModules, isOrganizerNodeVisible } from '../types/organizer'

type HomeData = {
  hero: { title: string; subtitle: string; imageUrl?: string; ctaLabel?: string; ctaLink?: string }
  featured: Product[]
  categories: Record<string, number>
  benefits: string[]
}

const marqueeFallback = ['Dior', 'Carolina Herrera', 'Lattafa', 'Armaf', 'Paco Rabanne', 'Jean Paul Gaultier']

export function HomePage() {
  const [data, setData] = useState<HomeData | null>(null)
  const { store } = useOrganizerStore()

  useEffect(() => {
    api
      .get<HomeData>('/store/home')
      .then(setData)
      .catch(() => setData(null))
  }, [])

  const dynamicBrands = Array.from(new Set((data?.featured ?? []).map((product) => product.brand)))
  const brands =
    dynamicBrands.length > 0
      ? [...dynamicBrands, ...marqueeFallback.filter((brand) => !dynamicBrands.includes(brand))]
      : marqueeFallback
  const modules = getOrganizerPageModules(store.nodes, 'home').filter((node) => isOrganizerNodeVisible(node))

  return (
    <div className="space-y-10 sm:space-y-12 lg:space-y-16">
      {modules.map((module, index) => (
        <Reveal key={module.id} delay={40 + index * 35}>
          <SiteModuleRenderer module={module} nodes={store.nodes} tags={store.tags} brands={brands} />
        </Reveal>
      ))}
    </div>
  )
}
