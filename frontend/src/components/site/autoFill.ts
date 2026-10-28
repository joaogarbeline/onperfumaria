import {
  isOrganizerNodeAvailable,
  normalizeOrganizerSearch,
  type OrganizerAutoFill,
  type OrganizerNode,
  type OrganizerTag,
} from '../../types/organizer'

export const AUTO_FILL_SORT_LABELS: Record<OrganizerAutoFill['sort'], string> = {
  newest: 'Mais novos primeiro',
  'price-asc': 'Menor preço primeiro',
  'price-desc': 'Maior preço primeiro',
  discount: 'Maior desconto primeiro',
  name: 'Ordem alfabética',
}

export const AUTO_FILL_FILTER_LABELS: Record<OrganizerAutoFill['filter'], string> = {
  all: 'Todos',
  discounted: 'Só com desconto',
  'low-stock': 'Só pouco estoque',
}

export function bestDiscountPercent(node: OrganizerNode, tags: OrganizerTag[]) {
  return node.tagIds.reduce((best, tagId) => {
    const percent = tags.find((tag) => tag.id === tagId)?.discountPercent ?? 0
    return percent > best ? percent : best
  }, 0)
}

// Nomes de pagina que nao batem letra a letra com o nome da tag.
const PAGE_TAG_ALIASES: Record<string, string[]> = {
  unisex: ['unissex', 'unisex'],
  arabes: ['arabes', 'arabe'],
  importados: ['importados', 'importado'],
}

/**
 * Regra padrao dos catalogos das paginas de categoria (Arabes, Feminino...):
 * sem nenhuma configuracao, o catalogo ja mostra os produtos que tem a tag com
 * o mesmo nome da pagina. Basta etiquetar o produto para ele aparecer la.
 */
function defaultCategoryAutoFill(module: OrganizerNode, tags: OrganizerTag[]): OrganizerAutoFill | undefined {
  if (module.type !== 'catalog' || !module.parentId || module.id !== `${module.parentId}-products`)
    return undefined
  const names = PAGE_TAG_ALIASES[module.parentId] ?? [normalizeOrganizerSearch(module.parentId)]
  const tagIds = tags.filter((tag) => names.includes(normalizeOrganizerSearch(tag.name))).map((tag) => tag.id)
  if (tagIds.length === 0) return undefined
  return { enabled: true, tagIds, filter: 'all', sort: 'newest', limit: 0 }
}

/** Regras padrao dos carrosseis fixos da home (antes ficavam escondidas no
 * codigo; agora aparecem e podem ser trocadas na aba Vitrines do painel). */
const HOME_DEFAULTS: Record<string, OrganizerAutoFill> = {
  'home-products-2': { enabled: true, tagIds: [], filter: 'all', sort: 'newest', limit: 6 },
  'home-products-4': { enabled: true, tagIds: [], filter: 'discounted', sort: 'discount', limit: 6 },
  'home-products-6': { enabled: true, tagIds: [], filter: 'low-stock', sort: 'newest', limit: 6 },
}

/** Regra em uso no bloco: a configurada nele ou a padrao (home/categoria). */
export function effectiveAutoFill(
  module: OrganizerNode,
  tags: OrganizerTag[],
): OrganizerAutoFill | undefined {
  if (module.autoFill) return module.autoFill.enabled ? module.autoFill : undefined
  return HOME_DEFAULTS[module.id] ?? defaultCategoryAutoFill(module, tags)
}

export function autoFillItems(
  rule: OrganizerAutoFill,
  nodes: OrganizerNode[],
  tags: OrganizerTag[],
  previewMode: boolean,
) {
  let items = nodes.filter(
    (node) =>
      node.type === 'item' &&
      isOrganizerNodeAvailable(node, previewMode) &&
      (rule.tagIds.length === 0 || node.tagIds.some((tagId) => rule.tagIds.includes(tagId))),
  )
  if (rule.filter === 'discounted') items = items.filter((node) => bestDiscountPercent(node, tags) > 0)
  if (rule.filter === 'low-stock') items = items.filter((node) => node.status === 'low-stock')

  const sorted = [...items]
  switch (rule.sort) {
    case 'price-asc':
      sorted.sort((a, b) => a.price - b.price)
      break
    case 'price-desc':
      sorted.sort((a, b) => b.price - a.price)
      break
    case 'discount':
      sorted.sort((a, b) => bestDiscountPercent(b, tags) - bestDiscountPercent(a, tags))
      break
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      break
    default:
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  return rule.limit > 0 ? sorted.slice(0, rule.limit) : sorted
}
