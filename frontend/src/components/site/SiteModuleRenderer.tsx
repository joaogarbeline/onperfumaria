import type { OrganizerNode, OrganizerTag } from '../../types/organizer'
import { BrandMarquee } from '../BrandMarquee'
import type { CustomerSignals } from './customerSignals'
import { getRenderableOrganizerItems, isSiteModuleRenderable, toItemContent } from './moduleContent'
import { CarouselModule } from '../../pages/modelos/CarouselModule'
import { CatalogModule } from '../../pages/modelos/CatalogModule'
import { HighlightModule } from '../../pages/modelos/HighlightModule'

type SiteModuleRendererProps = {
  module: OrganizerNode
  nodes: OrganizerNode[]
  tags: OrganizerTag[]
  brands?: string[]
  previewMode?: boolean
  signals?: CustomerSignals
}

export function SiteModuleRenderer({
  module,
  nodes,
  tags,
  brands = [],
  previewMode = false,
  signals,
}: SiteModuleRendererProps) {
  if (!isSiteModuleRenderable(module, nodes, brands, previewMode, tags, signals)) return null

  // Escolhidos a mao + os que entram sozinhos pela regra de tags do bloco.
  const itemCards = getRenderableOrganizerItems(module, nodes, previewMode, tags, signals).map((node) =>
    toItemContent(node, tags),
  )

  if (module.variant === 'brand-marquee') {
    return <BrandMarquee brands={brands} />
  }

  if (module.type === 'highlight' || module.variant === 'banner') {
    return <HighlightModule module={module} />
  }

  if (module.type === 'catalog' || module.variant === 'product-grid') {
    return <CatalogModule module={module} items={itemCards} />
  }

  return <CarouselModule module={module} items={itemCards} />
}
