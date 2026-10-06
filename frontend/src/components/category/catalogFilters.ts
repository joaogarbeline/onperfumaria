export type CatalogSort =
  | 'default'
  | 'price-asc'
  | 'price-desc'
  | 'rating-desc'
  | 'date-desc'
  | 'popularity-desc'
  | 'brand'
  | 'promotion'

export const catalogSortLabels: Record<CatalogSort, string> = {
  default: 'Ordem do catálogo',
  'price-asc': 'Preco crescente',
  'price-desc': 'Preco decrescente',
  'rating-desc': 'Mais avaliados',
  'date-desc': 'Mais recentes',
  'popularity-desc': 'Mais procurado',
  brand: 'Marca',
  promotion: 'Promocao',
}

export type CatalogFilters = {
  pickupOnly: boolean
  minPrice: number | null
  maxPrice: number | null
  brands: string[]
  volumes: string[]
  sort: CatalogSort
}

export const catalogVolumeOptions = ['30ml', '50ml', '75ml', '100ml', '150ml']

export const emptyCatalogFilters: CatalogFilters = {
  pickupOnly: false,
  minPrice: null,
  maxPrice: null,
  brands: [],
  volumes: [],
  sort: 'default',
}
