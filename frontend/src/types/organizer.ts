export type OrganizerContentType = 'page' | 'folder' | 'carousel' | 'highlight' | 'catalog' | 'item'
export type OrganizerStatus =
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'coming-soon'
  | 'out-of-stock'
  | 'low-stock'
export type OrganizerSize = 'small' | 'medium' | 'large'
export type OrganizerVariant =
  | 'standard'
  | 'banner'
  | 'banner-carousel'
  | 'product-carousel'
  | 'product-grid'
  | 'brand-marquee'

export type OrganizerNode = {
  id: string
  name: string
  type: OrganizerContentType
  parentId: string | null
  description: string
  status: OrganizerStatus
  scheduledAt: string
  imageUrl: string
  /** Galeria completa do item (imageUrl e sempre a primeira). So "item" usa mais de uma. */
  images?: string[]
  price: number
  size: OrganizerSize
  tagIds: string[]
  itemIds: string[]
  /** Codigo interno do item (so visivel no Organizador, nunca na pagina publica). */
  sku?: string
  /** Marca do item, usada tambem para alimentar o filtro de marcas do catalogo. */
  brand?: string
  /** Volume em ml, usado tambem para alimentar o filtro de volume do catalogo. */
  volumeMl?: number
  /** Quantidade em estoque. Ao chegar a 0, o status vira "coming-soon" automaticamente. */
  stock?: number
  /** Desconto no Pix em %, especifico do item. Sem valor, a pagina usa o padrao do site. */
  pixDiscountPercent?: number
  route?: string
  variant?: OrganizerVariant
  builtin?: boolean
  immutable?: boolean
  createdAt: string
  updatedAt: string
}

export type OrganizerTag = {
  id: string
  name: string
  color: string
  discountPercent?: number
  createdAt: string
  updatedAt: string
}

export type OrganizerActivity = {
  id: string
  label: string
  detail: string
  targetId: string | null
  createdAt: string
}

export type OrganizerTrashEntry = {
  id: string
  kind: 'node' | 'tag'
  label: string
  deletedAt: string
  payload: OrganizerNode | OrganizerTag
}

export type OrganizerStore = {
  nodes: OrganizerNode[]
  tags: OrganizerTag[]
  activities: OrganizerActivity[]
  trash: OrganizerTrashEntry[]
}

export const organizerTypeLabels: Record<OrganizerContentType, string> = {
  page: 'Página',
  folder: 'Subpasta',
  carousel: 'Carrossel',
  highlight: 'Destaque',
  catalog: 'Catálogo',
  item: 'Item',
}

export const organizerStatusLabels: Record<OrganizerStatus, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendado',
  published: 'Publicado',
  'coming-soon': 'Em breve',
  'out-of-stock': 'Esgotado',
  'low-stock': 'Pouco no estoque',
}

export const organizerItemStatusOptions: OrganizerStatus[] = [
  'published',
  'coming-soon',
  'out-of-stock',
  'low-stock',
]

export const organizerSizeLabels: Record<OrganizerSize, string> = {
  small: 'Pequeno',
  medium: 'Médio',
  large: 'Grande',
}

export const organizerDiscountOptions = [10, 20, 30, 40, 50, 60] as const

export function getOrganizerDiscountedPrice(price: number, percent?: number) {
  if (!percent) return price
  return price - (price * percent) / 100
}

export type ItemWizardStep = 1 | 2 | 3

export type ItemWizardDraft = {
  name: string
  photos: string[]
  description: string
  status: OrganizerStatus
  parentId: string
  price: string
  tagId: string
  stock: string
  pixDiscountPercent: string
  brand: string
  volumeMl: string
  sku: string
}

export function emptyItemWizardDraft(parentId: string): ItemWizardDraft {
  return {
    name: '',
    photos: [],
    description: '',
    status: 'published',
    parentId,
    price: '',
    tagId: '',
    stock: '',
    pixDiscountPercent: '',
    brand: '',
    volumeMl: '',
    sku: '',
  }
}

const now = new Date().toISOString()

const sitePages: OrganizerNode[] = [
  ['home', 'Home', '/'],
  ['comercial', 'Comercial', '/comercial'],
  ['arabes', 'Árabes', '/arabes'],
  ['feminino', 'Feminino', '/feminino'],
  ['masculino', 'Masculino', '/masculino'],
  ['importados', 'Importados', '/importados'],
  ['unisex', 'Unissex', '/unisex'],
].map(([id, name, route]) => ({
  id,
  name,
  type: 'page',
  parentId: null,
  description: `Página ${name} existente no site.`,
  status: 'published',
  scheduledAt: '',
  imageUrl: '',
  price: 0,
  size: 'large',
  tagIds: [],
  itemIds: [],
  route,
  variant: 'standard',
  builtin: true,
  immutable: id === 'home',
  createdAt: now,
  updatedAt: now,
}))

const homeModuleNames = [
  'Visto recentemente',
  'Acabaram de chegar',
  'Recomendado para você',
  'Produtos em oferta',
  'Mais procurados',
  'Pouco no estoque',
  'Produtos a partir de X preço',
]

const homeModules: OrganizerNode[] = [
  {
    id: 'home-promotional-banners',
    name: 'Banners promocionais',
    type: 'carousel',
    parentId: 'home',
    description: 'Carrossel de destaques exibido no topo da página inicial.',
    status: 'published',
    scheduledAt: '',
    imageUrl: '',
    price: 0,
    size: 'large',
    tagIds: [],
    itemIds: [],
    variant: 'banner-carousel',
    builtin: true,
    createdAt: now,
    updatedAt: now,
  },
  ...homeModuleNames.slice(0, 4).map((name, index) => ({
    id: `home-products-${index + 1}`,
    name,
    type: 'carousel' as const,
    parentId: 'home',
    description: 'Carrossel de produtos da página inicial.',
    status: 'published' as const,
    scheduledAt: '',
    imageUrl: '',
    price: 0,
    size: 'medium' as const,
    tagIds: [],
    itemIds: [],
    variant: 'product-carousel' as const,
    builtin: true,
    createdAt: now,
    updatedAt: now,
  })),
  {
    id: 'home-brands',
    name: 'Marcas em destaque',
    type: 'highlight',
    parentId: 'home',
    description: 'Faixa de marcas exibida entre os carrosséis da página inicial.',
    status: 'published',
    scheduledAt: '',
    imageUrl: '',
    price: 0,
    size: 'medium',
    tagIds: [],
    itemIds: [],
    variant: 'brand-marquee',
    builtin: true,
    createdAt: now,
    updatedAt: now,
  },
  ...homeModuleNames.slice(4).map((name, index) => ({
    id: `home-products-${index + 5}`,
    name,
    type: 'carousel' as const,
    parentId: 'home',
    description: 'Carrossel de produtos da página inicial.',
    status: 'published' as const,
    scheduledAt: '',
    imageUrl: '',
    price: 0,
    size: 'medium' as const,
    tagIds: [],
    itemIds: [],
    variant: 'product-carousel' as const,
    builtin: true,
    createdAt: now,
    updatedAt: now,
  })),
]

const categoryModules: OrganizerNode[] = sitePages
  .filter((page) => page.id !== 'home')
  .flatMap((page) => [
    {
      id: `${page.id}-banner`,
      name: `Destaque ${page.name}`,
      type: 'highlight' as const,
      parentId: page.id,
      description: `Banner principal da página ${page.name}.`,
      status: 'published' as const,
      scheduledAt: '',
      imageUrl: '',
      price: 0,
      size: 'large' as const,
      tagIds: [],
      itemIds: [],
      variant: 'banner' as const,
      builtin: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${page.id}-products`,
      name: page.name,
      type: 'catalog' as const,
      parentId: page.id,
      description: `Grade de produtos da página ${page.name}.`,
      status: 'published' as const,
      scheduledAt: '',
      imageUrl: '',
      price: 0,
      size: 'medium' as const,
      tagIds: [],
      itemIds: [],
      variant: 'product-grid' as const,
      builtin: true,
      createdAt: now,
      updatedAt: now,
    },
  ])

export const initialOrganizerStore: OrganizerStore = {
  nodes: [...sitePages, ...homeModules, ...categoryModules],
  tags: [],
  activities: [],
  trash: [],
}

export function createOrganizerId(prefix: string) {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
  return `${prefix}-${id}`
}

export function normalizeOrganizerSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

export function isOrganizerNodeVisible(node: OrganizerNode, referenceDate = new Date()) {
  if (node.status === 'draft') return false
  if (node.status !== 'scheduled') return true
  return Boolean(node.scheduledAt) && new Date(node.scheduledAt).getTime() <= referenceDate.getTime()
}

export function isOrganizerPreviewMode(search: string) {
  return new URLSearchParams(search).get('preview') === 'organizer'
}

export function withOrganizerPreview(path: string, previewMode: boolean) {
  if (!previewMode) return path
  const url = new URL(path, 'https://organizer.local')
  url.searchParams.set('preview', 'organizer')
  return `${url.pathname}${url.search}${url.hash}`
}

export function isOrganizerNodeAvailable(node: OrganizerNode, previewMode: boolean) {
  return previewMode || isOrganizerNodeVisible(node)
}

export function findOrganizerPage(nodes: OrganizerNode[], nodeOrId: OrganizerNode | string) {
  let current = typeof nodeOrId === 'string' ? nodes.find((node) => node.id === nodeOrId) : nodeOrId
  const visited = new Set<string>()

  while (current && current.type !== 'page' && current.parentId && !visited.has(current.id)) {
    visited.add(current.id)
    current = nodes.find((node) => node.id === current?.parentId)
  }

  return current?.type === 'page' ? current : undefined
}

export function getOrganizerPageModules(nodes: OrganizerNode[], pageId: string) {
  const modules: OrganizerNode[] = []
  const visited = new Set<string>()

  const appendChildren = (parentId: string) => {
    if (visited.has(parentId)) return
    visited.add(parentId)
    nodes
      .filter((node) => node.parentId === parentId)
      .forEach((node) => {
        if (node.type === 'folder') appendChildren(node.id)
        else modules.push(node)
      })
  }

  appendChildren(pageId)
  return modules
}
