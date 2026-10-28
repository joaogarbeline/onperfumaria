import { isOrganizerNodeAvailable } from '../../types/organizer'
import type { OrganizerNode, OrganizerTag } from '../../types/organizer'
import type { ItemCardContent } from '../item/ItemCard'
import { autoFillItems, effectiveAutoFill } from './autoFill'
import { emptySignals, type CustomerSignals } from './customerSignals'

export function toItemContent(node: OrganizerNode, tags: OrganizerTag[]): ItemCardContent {
  const firstTag = tags.find((tag) => node.tagIds.includes(tag.id))
  return {
    id: node.id,
    name: node.name,
    description: node.description,
    imageUrl: node.imageUrl,
    images: node.images,
    price: node.price,
    tagLabel: firstTag?.name,
    createdAt: node.createdAt,
    sku: node.sku,
    brand: node.brand,
    volumeMl: node.volumeMl,
    stock: node.stock,
    pixDiscountPercent: node.pixDiscountPercent,
    status: node.status,
  }
}

/**
 * Produtos do carrossel/catalogo: primeiro os escolhidos a mao (itemIds), na
 * ordem do Organizador, depois os que entram sozinhos pela regra de tags.
 */
export function getRenderableOrganizerItems(
  module: OrganizerNode,
  nodes: OrganizerNode[],
  previewMode: boolean,
  tags: OrganizerTag[] = [],
  signals: CustomerSignals = emptySignals,
) {
  const manual = module.itemIds
    .map((id) =>
      nodes.find(
        (node) => node.id === id && node.type === 'item' && isOrganizerNodeAvailable(node, previewMode),
      ),
    )
    .filter((node): node is OrganizerNode => Boolean(node))

  const rule = effectiveAutoFill(module, tags)
  if (!rule) return manual
  const manualIds = new Set(manual.map((node) => node.id))
  return [
    ...manual,
    ...autoFillItems(rule, nodes, tags, previewMode, signals).filter((node) => !manualIds.has(node.id)),
  ]
}

export function isSiteModuleRenderable(
  module: OrganizerNode,
  nodes: OrganizerNode[],
  brands: string[] = [],
  previewMode = false,
  tags: OrganizerTag[] = [],
  signals: CustomerSignals = emptySignals,
) {
  // Um item só aparece na página quando está vinculado a um Carrossel ou
  // Catálogo (via itemIds) - um item solto na página, sem estar dentro de
  // um desses, não deve ser exibido por conta própria.
  if (module.type === 'item') return false
  if (module.variant === 'brand-marquee') return brands.length > 0
  if (module.type === 'highlight' || module.variant === 'banner') {
    return Boolean(module.imageUrl.trim())
  }

  const hasSelectedItems = getRenderableOrganizerItems(module, nodes, previewMode, tags, signals).length > 0
  if (module.variant === 'banner-carousel') {
    return hasSelectedItems || Boolean(module.imageUrl.trim())
  }

  if (module.type === 'carousel' || module.type === 'catalog') return hasSelectedItems
  return false
}
