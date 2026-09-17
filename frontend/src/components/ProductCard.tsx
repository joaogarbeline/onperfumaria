import { ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import { useCurrency } from '../hooks/useCurrency'
import type { Product } from '../types'
import { Badge } from './Badge'
import { Button, buttonClassName } from './Button'
import { TiltCard } from './TiltCard'

export function ProductCard({ product }: { product: Product }) {
  const format = useCurrency()
  const { addItem } = useCart()
  const [adding, setAdding] = useState(false)

  const hasDiscount = product.finalPrice < product.salePrice
  const discountPercent = hasDiscount ? Math.round((1 - product.finalPrice / product.salePrice) * 100) : 0
  const isLowStock = product.isAvailable && product.stockCurrent > 0 && product.stockCurrent <= 3

  function handleAdd() {
    setAdding(true)
    addItem(product)
    window.setTimeout(() => setAdding(false), 700)
  }

  return (
    <TiltCard
      as="article"
      intensity={6}
      className="surface-soft group flex h-full flex-col overflow-hidden transition-shadow duration-300 hover:shadow-[var(--shadow-3d)]"
    >
      <div className="relative overflow-hidden">
        <img
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          className="aspect-[3/4] w-full object-cover transition duration-500 group-hover:scale-[1.05]"
        />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {hasDiscount ? <Badge tone="amber">-{discountPercent}%</Badge> : null}
          {!product.isAvailable ? <Badge tone="neutral">Esgotado</Badge> : null}
          {isLowStock ? <Badge tone="danger">Ultimas {product.stockCurrent} unidades</Badge> : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col space-y-4 p-5">
        <div className="space-y-2">
          <span className="inline-block rounded-[18px] bg-[#fff1d6] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#b77717]">
            {product.brand}
          </span>
          <h3 className="text-[2rem] leading-none text-[#171412]">{product.name}</h3>
          <p className="line-clamp-2 text-sm leading-6 text-[#6b665f]">{product.description}</p>
        </div>

        <div className="mt-auto">
          {hasDiscount ? <p className="text-sm text-stone-400 line-through">{format(product.salePrice)}</p> : null}
          <p className="text-3xl font-semibold text-[#171412]">{format(product.finalPrice)}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            to={`/produto/${product.slug}`}
            className={buttonClassName({ variant: 'secondary', fullWidth: true, className: 'flex-1 text-center' })}
          >
            Ver detalhes
          </Link>
          <Button
            onClick={handleAdd}
            disabled={!product.isAvailable}
            variant="primary"
            fullWidth
            className="flex-1 bg-[#d89a28] text-[#171412] hover:bg-[#ebac37] disabled:bg-stone-200 disabled:text-stone-500"
          >
            <ShoppingBag size={16} />
            {product.isAvailable ? (adding ? 'Adicionado' : 'Adicionar') : 'Sem estoque'}
          </Button>
        </div>
      </div>
    </TiltCard>
  )
}
