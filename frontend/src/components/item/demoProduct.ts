import type { Product } from '../../types'

export const DEMO_PRICE = 0
export const DEMO_INSTALLMENTS = 12

export const DEMO_PRODUCT: Product = {
  id: 'demo-item',
  sku: 'DEMO-0001',
  name: 'Nome do produto',
  slug: 'produto-modelo',
  brand: 'Marca',
  category: 'Demonstracao',
  description: 'Item de demonstracao',
  salePrice: DEMO_PRICE,
  promotionalPrice: null,
  finalPrice: DEMO_PRICE,
  automaticDiscountAmount: 0,
  discountLabel: '',
  costPrice: 0,
  profitMargin: 0,
  stockCurrent: 999,
  stockMinimum: 0,
  weightGrams: 0,
  volumeMl: 0,
  gender: '',
  productType: '',
  imageUrl: '',
  images: [],
  isActive: true,
  isFeatured: false,
  isAvailable: true,
}

export const DEMO_MEDIA: Array<{ type: 'image' | 'video' }> = [
  { type: 'image' },
  { type: 'video' },
  { type: 'image' },
  { type: 'image' },
]
