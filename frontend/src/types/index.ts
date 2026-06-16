export type Product = {
  id: string
  sku: string
  name: string
  slug: string
  brandId?: string
  brand: string
  categoryId?: string
  category: string
  description: string
  salePrice: number
  promotionalPrice?: number | null
  finalPrice: number
  automaticDiscountAmount: number
  discountLabel: string
  costPrice: number
  profitMargin: number
  stockCurrent: number
  stockMinimum: number
  weightGrams: number
  volumeMl: number
  gender: string
  productType: string
  imageUrl: string
  images: string[]
  isActive: boolean
  isFeatured: boolean
  isAvailable: boolean
}

export type CartItem = Product & {
  quantity: number
}

export type SelectOption = {
  id: string
  name: string
}

export type CustomerAddress = {
  id?: string
  label?: string
  cep: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
  isDefault?: boolean
}

export type CustomerOrder = {
  id: string
  total: number
  paymentStatus: string
  orderStatus: string
  createdAt: string
}
