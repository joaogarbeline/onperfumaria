import { Filter, Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { Drawer } from '../components/Drawer'
import { EmptyState } from '../components/EmptyState'
import { InputField, SelectField } from '../components/Field'
import { ProductCard } from '../components/ProductCard'
import { Reveal } from '../components/Reveal'
import { SectionTitle } from '../components/SectionTitle'
import { Skeleton } from '../components/Skeleton'
import { api } from '../services/api'
import type { Product } from '../types'

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'name-asc' | 'latest'

export function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loaded, setLoaded] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('busca') ?? '')
  const [category, setCategory] = useState(searchParams.get('categoria') ?? '')
  const [brand, setBrand] = useState(searchParams.get('marca') ?? '')
  const [discountOnly, setDiscountOnly] = useState(searchParams.get('desconto') === '1')
  const [availableOnly, setAvailableOnly] = useState(searchParams.get('estoque') === '1')
  const [sort, setSort] = useState<SortOption>((searchParams.get('ordem') as SortOption) || 'featured')

  useEffect(() => {
    api
      .get<Product[]>('/products')
      .then(setProducts)
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    const next = new URLSearchParams()
    if (query) next.set('busca', query)
    if (category) next.set('categoria', category)
    if (brand) next.set('marca', brand)
    if (discountOnly) next.set('desconto', '1')
    if (availableOnly) next.set('estoque', '1')
    if (sort !== 'featured') next.set('ordem', sort)
    setSearchParams(next, { replace: true })
  }, [availableOnly, brand, category, discountOnly, query, setSearchParams, sort])

  const categories = Array.from(new Set(products.map((product) => product.category))).sort()
  const brands = Array.from(new Set(products.map((product) => product.brand))).sort()

  const normalized = query.trim().toLowerCase()
  const filtered = [...products]
    .filter((product) => {
      if (normalized) {
        const haystack = [product.name, product.brand, product.category, product.sku].join(' ').toLowerCase()
        if (!haystack.includes(normalized)) {
          return false
        }
      }
      if (category && product.category !== category) {
        return false
      }
      if (brand && product.brand !== brand) {
        return false
      }
      if (discountOnly && product.finalPrice >= product.salePrice) {
        return false
      }
      if (availableOnly && !product.isAvailable) {
        return false
      }
      return true
    })
    .sort((left, right) => {
      switch (sort) {
        case 'price-asc':
          return left.finalPrice - right.finalPrice
        case 'price-desc':
          return right.finalPrice - left.finalPrice
        case 'name-asc':
          return left.name.localeCompare(right.name)
        case 'latest':
          return 0
        default:
          return Number(right.isFeatured) - Number(left.isFeatured)
      }
    })

  const filters = (
    <div className="space-y-4">
      <InputField
        label="Busca"
        placeholder="Buscar perfume, marca ou codigo"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <SelectField label="Categoria" value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="">Todas</option>
        {categories.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
      <SelectField label="Marca" value={brand} onChange={(event) => setBrand(event.target.value)}>
        <option value="">Todas</option>
        {brands.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
      <SelectField label="Ordenacao" value={sort} onChange={(event) => setSort(event.target.value as SortOption)}>
        <option value="featured">Destaques primeiro</option>
        <option value="price-asc">Menor preco</option>
        <option value="price-desc">Maior preco</option>
        <option value="name-asc">Nome A-Z</option>
        <option value="latest">Ultimos cadastrados</option>
      </SelectField>
      <label className="surface-soft flex items-center gap-3 px-4 py-4 text-sm text-[#171412]">
        <input type="checkbox" checked={discountOnly} onChange={(event) => setDiscountOnly(event.target.checked)} />
        Somente com desconto
      </label>
      <label className="surface-soft flex items-center gap-3 px-4 py-4 text-sm text-[#171412]">
        <input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} />
        Somente disponiveis
      </label>
      <Button
        variant="secondary"
        fullWidth
        onClick={() => {
          setQuery('')
          setCategory('')
          setBrand('')
          setDiscountOnly(false)
          setAvailableOnly(false)
          setSort('featured')
        }}
      >
        Limpar filtros
      </Button>
    </div>
  )

  return (
    <div className="space-y-8">
      <Reveal>
        <section className="surface-panel p-6 sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <SectionTitle
              eyebrow="Catalogo"
              title="Importados e arabes com visual de loja real"
              description="Busca, filtros e ordenacao organizados para uma navegacao premium em qualquer tela, sempre usando os produtos reais da base."
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
              <label className="surface-soft flex items-center gap-3 px-4 py-4">
                <Search size={18} className="text-[#6b665f]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nome, marca ou SKU"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-stone-400"
                />
              </label>
              <Button variant="secondary" className="xl:hidden" onClick={() => setMobileFiltersOpen(true)}>
                <Filter size={16} />
                Filtros
              </Button>
            </div>
          </div>
        </section>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <div className="surface-panel sticky top-24 p-5">
            <div className="mb-5 flex items-center gap-3">
              <SlidersHorizontal size={18} className="text-[#b77717]" />
              <p className="eyebrow">Filtros</p>
            </div>
            {filters}
          </div>
        </aside>

        <section className="space-y-6">
          <div className="flex items-center justify-between gap-4 rounded-[28px] border border-stone-200 bg-white/70 px-4 py-4 text-sm text-[#6b665f]">
            <span>{filtered.length} fragrancias encontradas</span>
            <span className="hidden items-center gap-2 sm:inline-flex">
              <Sparkles size={16} className="text-[#d89a28]" />
              Estoque e desconto atualizados em tempo real
            </span>
          </div>

          {!loaded ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-[470px] w-full rounded-[32px]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              eyebrow="Sem resultados"
              title="Nenhum perfume encontrado"
              description="Tente ajustar marca, categoria ou busca para descobrir outras opcoes do catalogo."
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((product, index) => (
                <Reveal key={product.id} delay={(index % 6) * 55}>
                  <ProductCard product={product} />
                </Reveal>
              ))}
            </div>
          )}
        </section>
      </div>

      <Drawer open={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)} title="Filtros do catalogo">
        {filters}
      </Drawer>
    </div>
  )
}
