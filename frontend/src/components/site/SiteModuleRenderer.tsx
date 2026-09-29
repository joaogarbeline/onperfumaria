import { ChevronLeft, ChevronRight, Image as ImageIcon, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import bottleIcon from '../../assets/icons/frasco_d_p.png'
import type { OrganizerNode, OrganizerTag } from '../../types/organizer'
import { BrandMarquee } from '../BrandMarquee'
import { Carousel } from '../Carousel'
import { ItemCard, type ItemCardContent } from '../item/ItemCard'

const ITEMS_PER_PAGE = 8

type SiteModuleRendererProps = {
  module: OrganizerNode
  nodes: OrganizerNode[]
  tags: OrganizerTag[]
  brands?: string[]
  onOpenFilters?: () => void
}

function toItemContent(node: OrganizerNode, tags: OrganizerTag[]): ItemCardContent {
  const firstTag = tags.find((tag) => node.tagIds.includes(tag.id))
  return {
    id: node.id,
    name: node.name,
    description: node.description,
    imageUrl: node.imageUrl,
    price: node.price,
    tagLabel: firstTag?.name,
  }
}

export function SiteModuleRenderer({
  module,
  nodes,
  tags,
  brands = [],
  onOpenFilters,
}: SiteModuleRendererProps) {
  const selectedItems = module.itemIds
    .map((id) => nodes.find((node) => node.id === id && node.type === 'item'))
    .filter((node): node is OrganizerNode => Boolean(node))
  const itemCards = selectedItems.map((node) => toItemContent(node, tags))

  if (module.variant === 'brand-marquee') {
    return <BrandMarquee brands={brands} />
  }

  if (module.variant === 'banner-carousel') {
    const banners: Array<ItemCardContent | null> =
      itemCards.length > 0 ? itemCards : Array.from({ length: 4 }, () => null)
    return (
      <section className="space-y-4" aria-label={module.name}>
        <Carousel
          ariaLabel={module.name}
          items={banners}
          getItemKey={(banner, index) => banner?.id ?? index}
          fullBleed
          itemClassName="shrink-0"
          className="gap-4 px-4 pb-2 sm:px-0 lg:gap-6"
          renderItem={(banner) => (
            <div className="relative flex aspect-[2/1] w-[calc(100dvw-2rem)] items-center justify-center overflow-hidden rounded-[24px] border border-stone-200 bg-[#f4efe8] text-[#d89a28] sm:w-[520px] lg:w-[680px] xl:w-[800px]">
              {banner?.imageUrl || module.imageUrl ? (
                <img
                  src={banner?.imageUrl || module.imageUrl}
                  alt={banner?.name || module.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon size={40} strokeWidth={1.5} />
              )}
              {banner?.name ? (
                <span className="absolute inset-x-0 bottom-0 bg-[#0a1a33]/75 px-4 py-3 text-sm font-semibold text-white">
                  {banner.name}
                </span>
              ) : null}
            </div>
          )}
        />
      </section>
    )
  }

  if (module.variant === 'banner' || module.type === 'highlight') {
    return (
      <section
        className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[24px] border border-stone-200 bg-[#f4efe8] text-[#d89a28] sm:aspect-[16/7] sm:rounded-[28px] lg:aspect-[16/5]"
        aria-label={module.name}
      >
        {module.imageUrl ? (
          <img src={module.imageUrl} alt={module.name} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon size={40} strokeWidth={1.5} />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0a1a33]/80 to-transparent px-5 pb-5 pt-16 text-white sm:px-7 sm:pb-7 lg:px-9 lg:pb-8">
          <h2 className="font-serif text-xl font-semibold sm:text-2xl lg:text-3xl">{module.name}</h2>
          {module.description ? (
            <p className="mt-1 max-w-3xl text-xs text-white/80 sm:text-sm">{module.description}</p>
          ) : null}
        </div>
      </section>
    )
  }

  if (module.variant === 'product-grid') {
    return <ProductGridModule module={module} items={itemCards} onOpenFilters={onOpenFilters} />
  }

  if (module.type === 'item') {
    return <ItemCard item={toItemContent(module, tags)} className="w-full max-w-[240px]" />
  }

  const carouselItems: Array<ItemCardContent | null> =
    itemCards.length > 0 ? itemCards : Array.from({ length: 8 }, () => null)
  return (
    <section className="space-y-4" aria-label={module.name}>
      <div className="flex items-center gap-2">
        <img src={bottleIcon} alt="" aria-hidden="true" className="h-8 w-8 shrink-0 object-contain" />
        <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[#d89a28] sm:text-base sm:tracking-[0.22em] lg:text-lg">
          {module.name}
        </h2>
      </div>
      <Carousel
        ariaLabel={module.name}
        items={carouselItems}
        getItemKey={(item, index) => item?.id ?? index}
        fullBleed
        itemClassName="shrink-0"
        className="gap-4 px-4 pb-2 sm:px-0 lg:gap-5"
        renderItem={(item) => (
          <ItemCard className="w-[200px] sm:w-[220px] lg:w-[240px]" item={item ?? undefined} />
        )}
      />
    </section>
  )
}

function ProductGridModule({
  module,
  items,
  onOpenFilters,
}: {
  module: OrganizerNode
  items: ItemCardContent[]
  onOpenFilters?: () => void
}) {
  const [page, setPage] = useState(0)
  const displayItems: Array<ItemCardContent | null> =
    items.length > 0 ? items : Array.from({ length: 24 }, () => null)
  const pageCount = Math.max(1, Math.ceil(displayItems.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, pageCount - 1)
  const visibleItems = displayItems.slice(
    safePage * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE + ITEMS_PER_PAGE,
  )

  return (
    <section className="space-y-4" aria-label={module.name}>
      {onOpenFilters ? (
        <button
          type="button"
          onClick={onOpenFilters}
          className="flex items-center gap-2 rounded-[16px] border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-[#171412]"
        >
          <SlidersHorizontal size={16} className="text-[#b77717]" />
          Filtro
        </button>
      ) : null}

      <div className="space-y-[10px]">
        <div className="field-base flex items-center border-none bg-transparent">
          {displayItems.length} {displayItems.length === 1 ? 'item encontrado' : 'itens encontrados'}
        </div>
        <div className="field-base flex items-center gap-2 border-none bg-transparent">
          <img src={bottleIcon} alt="" className="h-5 w-5 shrink-0 object-contain" />
          <span className="font-semibold">{module.name}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
        {visibleItems.map((item, index) => (
          <ItemCard key={item?.id ?? `${safePage}-${index}`} item={item ?? undefined} />
        ))}
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={safePage === 0}
            aria-label="Página anterior"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-[#171412] disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-[#6b665f]">
            Página {safePage + 1} de {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            disabled={safePage === pageCount - 1}
            aria-label="Próxima página"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-[#171412] disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      ) : null}
    </section>
  )
}
