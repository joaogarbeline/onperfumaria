import type { OrganizerNode, OrganizerTag } from '../../types/organizer'
import { BrandMarquee } from '../BrandMarquee'
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
}

export function SiteModuleRenderer({
  module,
  nodes,
  tags,
  brands = [],
  previewMode = false,
}: SiteModuleRendererProps) {
  if (!isSiteModuleRenderable(module, nodes, brands, previewMode)) return null

  const selectedItems = getRenderableOrganizerItems(module, nodes, previewMode)
  const itemCards = selectedItems.map((node) => toItemContent(node, tags))

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
