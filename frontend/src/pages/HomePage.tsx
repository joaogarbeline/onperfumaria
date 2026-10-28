import { useLocation } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { getOrganizerBrands } from '../components/site/homeAutoCarousels'
import { isSiteModuleRenderable } from '../components/site/moduleContent'
import { SiteModuleRenderer } from '../components/site/SiteModuleRenderer'
import { useCustomerSignals } from '../components/site/customerSignals'
import { useOrganizerStore } from '../hooks/useOrganizerStore'
import {
  getOrganizerPageModules,
  isOrganizerNodeAvailable,
  isOrganizerPreviewMode,
  type OrganizerNode,
} from '../types/organizer'

// Carrossel do topo com os produtos marcados como "Destaque" no cadastro.
const featuredCarousel: OrganizerNode = {
  id: 'home-featured',
  name: 'Destaques',
  type: 'carousel',
  parentId: 'home',
  description: '',
  status: 'published',
  imageUrl: '',
  price: 0,
  size: 'medium',
  tagIds: [],
  itemIds: [],
  variant: 'product-carousel',
  builtin: true,
  createdAt: '',
  updatedAt: '',
}

export function HomePage() {
  const { store } = useOrganizerStore()
  const location = useLocation()
  const previewMode = isOrganizerPreviewMode(location.search)

  const brands = getOrganizerBrands(store.nodes, previewMode)

  const signals = useCustomerSignals()

  // Por enquanto a home e so de carrosseis de produto: banners e a faixa de
  // marcas ficam guardados, mas fora da pagina.
  const modules = [featuredCarousel, ...getOrganizerPageModules(store.nodes, 'home')].filter(
    (node) =>
      node.variant === 'product-carousel' &&
      isOrganizerNodeAvailable(node, previewMode) &&
      isSiteModuleRenderable(node, store.nodes, brands, previewMode, store.tags, signals),
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
            signals={signals}
          />
        </Reveal>
      ))}
    </div>
  )
}
