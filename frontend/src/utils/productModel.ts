import type { ItemCardContent } from '../components/item/ItemCard'
import type { Product } from '../types'

export function itemCardToProduct(item: ItemCardContent): Product {
  const price = item.price || 0
  return {
    id: item.id,
    sku: item.sku || item.id,
    name: item.name,
    slug: item.id,
    brand: item.tagLabel || '',
    category: '',
    description: item.description || '',
    salePrice: price,
    promotionalPrice: null,
    finalPrice: price,
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
    imageUrl: item.imageUrl || '',
    images: item.imageUrl ? [item.imageUrl] : [],
    isActive: true,
    isFeatured: false,
    isAvailable: true,
  }
}
