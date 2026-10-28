import type { OrganizerNode } from '../../types/organizer'
import { isOrganizerNodeAvailable } from '../../types/organizer'

/** Marcas da faixa "Marcas em destaque", tiradas dos proprios itens do
 * Organizador (antes vinham dos produtos em destaque do catalogo antigo). */
export function getOrganizerBrands(nodes: OrganizerNode[], previewMode = false) {
  const brands = nodes
    .filter((node) => node.type === 'item' && isOrganizerNodeAvailable(node, previewMode))
    .map((node) => node.brand?.trim())
    .filter((brand): brand is string => Boolean(brand))
  return Array.from(new Set(brands))
}
