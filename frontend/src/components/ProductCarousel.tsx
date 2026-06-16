import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef } from 'react'
import { ProductCard } from './ProductCard'
import type { Product } from '../types'

export function ProductCarousel({
  title,
  description,
  products,
}: {
  title: string
  description: string
  products: Product[]
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  if (products.length === 0) {
    return null
  }

  function scrollByAmount(direction: 'left' | 'right') {
    ref.current?.scrollBy({
      left: direction === 'right' ? 340 : -340,
      behavior: 'smooth',
    })
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Curadoria</p>
          <h2 className="text-4xl text-[#171412]">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b665f]">{description}</p>
        </div>
        <div className="hidden gap-3 lg:flex">
          <button
            aria-label="Voltar produtos"
            className="rounded-full border border-stone-200 bg-white p-3 text-stone-700"
            onClick={() => scrollByAmount('left')}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label="Avancar produtos"
            className="rounded-full border border-stone-200 bg-white p-3 text-stone-700"
            onClick={() => scrollByAmount('right')}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product) => (
          <div key={product.id} className="min-w-[290px] snap-start sm:min-w-[340px]">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  )
}
