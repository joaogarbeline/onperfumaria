import { ArrowLeft, Search, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

const PRICE_RANGE = { min: 40, max: 600 }

const BRANDS = ['Dior', 'Carolina Herrera', 'Lattafa', 'Armaf', 'Paco Rabanne', 'Jean Paul Gaultier']
const VOLUMES = ['30ml', '50ml', '75ml', '100ml', '150ml']
const SORT_OPTIONS = [
  'Preco crescente',
  'Preco decrescente',
  'Mais avaliados',
  'Mais recentes',
  'Mais procurado',
  'Marca',
  'Promocao',
]

const rangeThumbClassName =
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#d89a28] [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[#d89a28]'

type CategoryFilterDrawerProps = {
  open: boolean
  onClose: () => void
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[#d89a28]">{children}</h3>
}

function Divider() {
  return <div className="h-px bg-stone-300" />
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 text-sm text-[#171412]">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 accent-[#d89a28]"
      />
    </label>
  )
}

function toggleItem(items: string[], item: string) {
  return items.includes(item) ? items.filter((current) => current !== item) : [...items, item]
}

function toPercent(value: number) {
  const { min, max } = PRICE_RANGE
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

export function CategoryFilterDrawer({ open, onClose }: CategoryFilterDrawerProps) {
  const [pickupOnly, setPickupOnly] = useState(false)
  const [minPrice, setMinPrice] = useState(PRICE_RANGE.min)
  const [maxPrice, setMaxPrice] = useState(PRICE_RANGE.max)
  const [minPriceInput, setMinPriceInput] = useState(String(PRICE_RANGE.min))
  const [maxPriceInput, setMaxPriceInput] = useState(String(PRICE_RANGE.max))
  const [brandSearch, setBrandSearch] = useState('')
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [selectedVolumes, setSelectedVolumes] = useState<string[]>([])
  const [selectedSort, setSelectedSort] = useState<string | null>(null)

  useEffect(() => {
    document.body.classList.toggle('drawer-open', open)
    return () => document.body.classList.remove('drawer-open')
  }, [open])

  function clearFilters() {
    setPickupOnly(false)
    setMinPrice(PRICE_RANGE.min)
    setMaxPrice(PRICE_RANGE.max)
    setMinPriceInput(String(PRICE_RANGE.min))
    setMaxPriceInput(String(PRICE_RANGE.max))
    setBrandSearch('')
    setSelectedBrands([])
    setSelectedVolumes([])
    setSelectedSort(null)
  }

  function changeMinPrice(value: number) {
    const next = Math.min(Math.max(value, PRICE_RANGE.min), maxPrice)
    setMinPrice(next)
    setMinPriceInput(String(next))
  }

  function changeMaxPrice(value: number) {
    const next = Math.max(Math.min(value, PRICE_RANGE.max), minPrice)
    setMaxPrice(next)
    setMaxPriceInput(String(next))
  }

  function commitMinPrice(value: string) {
    changeMinPrice(Number.isFinite(Number(value)) ? Number(value) : PRICE_RANGE.min)
  }

  function commitMaxPrice(value: string) {
    changeMaxPrice(Number.isFinite(Number(value)) ? Number(value) : PRICE_RANGE.max)
  }

  const visibleBrands = BRANDS.filter((brand) =>
    brand.toLowerCase().includes(brandSearch.trim().toLowerCase()),
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Filtros de produtos"
      aria-hidden={!open}
      className={[
        'fixed inset-0 z-50 flex flex-col transition-transform duration-300 ease-in-out',
        open ? 'translate-x-0' : 'pointer-events-none -translate-x-full',
      ].join(' ')}
    >
      <div className="flex items-center gap-3 bg-[#142d52] px-4 py-4 shadow-[0_8px_14px_-6px_rgba(10,26,51,0.55)]">
        <button type="button" onClick={onClose} aria-label="Fechar filtro" className="text-[#fafaf8]">
          <ArrowLeft size={22} />
        </button>
        <h2 className="text-lg font-semibold text-[#fafaf8]">Filtro</h2>
      </div>

      <div className="flex items-center justify-between bg-[#2a4d82] px-4 py-3">
        <button type="button" onClick={onClose} className="text-sm font-semibold text-[#fafaf8]">
          Filtrar
        </button>
        <button
          type="button"
          onClick={clearFilters}
          className="flex items-center gap-1 text-sm font-semibold text-[#fafaf8]"
        >
          <X size={14} />
          Limpar filtro
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto bg-[#FAF6EF] px-4 py-5 text-[#171412]">
        <section className="space-y-3">
          <SectionTitle>Opções de entrega</SectionTitle>
          <CheckboxRow
            label="Retirada na loja"
            checked={pickupOnly}
            onChange={() => setPickupOnly((current) => !current)}
          />
        </section>

        <Divider />

        <section className="space-y-4">
          <SectionTitle>Preço</SectionTitle>

          <div className="relative h-8">
            <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-stone-300" />
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#d89a28]"
              style={{ left: `${toPercent(minPrice)}%`, right: `${100 - toPercent(maxPrice)}%` }}
            />
            <input
              type="range"
              aria-label="Preço mínimo"
              min={PRICE_RANGE.min}
              max={PRICE_RANGE.max}
              value={minPrice}
              onChange={(event) => changeMinPrice(Number(event.target.value))}
              className={`pointer-events-none absolute top-1/2 h-1 w-full -translate-y-1/2 appearance-none bg-transparent ${rangeThumbClassName}`}
            />
            <input
              type="range"
              aria-label="Preço máximo"
              min={PRICE_RANGE.min}
              max={PRICE_RANGE.max}
              value={maxPrice}
              onChange={(event) => changeMaxPrice(Number(event.target.value))}
              className={`pointer-events-none absolute top-1/2 h-1 w-full -translate-y-1/2 appearance-none bg-transparent ${rangeThumbClassName}`}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex-1 text-xs font-medium text-[#171412]">
              Preço mín.
              <input
                type="number"
                value={minPriceInput}
                onChange={(event) => setMinPriceInput(event.target.value)}
                onBlur={(event) => commitMinPrice(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
                className="mt-1 w-full rounded-[14px] border border-stone-300 bg-white px-3 py-2 text-sm text-[#171412] focus:border-[#d89a28] focus:outline-none"
              />
            </label>
            <label className="flex-1 text-xs font-medium text-[#171412]">
              Preço máx.
              <input
                type="number"
                value={maxPriceInput}
                onChange={(event) => setMaxPriceInput(event.target.value)}
                onBlur={(event) => commitMaxPrice(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
                className="mt-1 w-full rounded-[14px] border border-stone-300 bg-white px-3 py-2 text-sm text-[#171412] focus:border-[#d89a28] focus:outline-none"
              />
            </label>
          </div>
        </section>

        <Divider />

        <section className="space-y-3">
          <SectionTitle>Marcas</SectionTitle>
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6b665f]"
            />
            <input
              value={brandSearch}
              onChange={(event) => setBrandSearch(event.target.value)}
              placeholder="Buscar marca"
              className="w-full rounded-[16px] border border-stone-300 bg-white py-2.5 pl-9 pr-3 text-sm text-[#171412] placeholder:text-stone-400 focus:border-[#d89a28] focus:outline-none"
            />
          </div>
          <div>
            {visibleBrands.map((brand) => (
              <CheckboxRow
                key={brand}
                label={brand}
                checked={selectedBrands.includes(brand)}
                onChange={() => setSelectedBrands((current) => toggleItem(current, brand))}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle>Volume</SectionTitle>
          <div>
            {VOLUMES.map((volume) => (
              <CheckboxRow
                key={volume}
                label={volume}
                checked={selectedVolumes.includes(volume)}
                onChange={() => setSelectedVolumes((current) => toggleItem(current, volume))}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle>Ordenar</SectionTitle>
          <div>
            {SORT_OPTIONS.map((option) => (
              <CheckboxRow
                key={option}
                label={option}
                checked={selectedSort === option}
                onChange={() => setSelectedSort((current) => (current === option ? null : option))}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
