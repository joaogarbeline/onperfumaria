import type { ReactNode } from 'react'
import { ChevronDown, Heart, Share2, ShieldCheck, ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Reveal } from '../components/Reveal'
import { Skeleton } from '../components/Skeleton'
import { toItemContent } from '../components/site/moduleContent'
import { useCart } from '../contexts/CartContext'
import { useCurrency } from '../hooks/useCurrency'
import { useOrganizerStore } from '../hooks/useOrganizerStore'
import { api } from '../services/api'
import type { Product } from '../types'
import { itemCardToProduct } from '../utils/productModel'

const DEFAULT_PIX_DISCOUNT = 0.05
const INSTALLMENTS = 12

// Modelo unico de pagina de produto: busca o produto real na API e, quando
// nao existe (ex.: item criado no Organizador, sem cadastro no catalogo),
// monta o mesmo modelo a partir do node do Organizador com o mesmo id.
export function ProductPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { addItem } = useCart()
  const format = useCurrency()
  const { store } = useOrganizerStore()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState('')
  const [favorited, setFavorited] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get<Product>(`/products/${slug}`)
      .then((result) => {
        if (!cancelled) setProduct(result)
      })
      .catch(() => {
        if (cancelled) return
        const node = store.nodes.find((candidate) => candidate.id === slug && candidate.type === 'item')
        setProduct(node ? itemCardToProduct(toItemContent(node, store.tags)) : null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug, store])

  const allImages = product
    ? product.images?.length
      ? product.images
      : [product.imageUrl].filter(Boolean)
    : []
  const displayedImage = allImages.includes(selectedImage)
    ? selectedImage
    : allImages[0] || product?.imageUrl || ''
  const total = product ? product.finalPrice * quantity : 0
  const pixDiscount =
    product?.pixDiscountPercent != null ? product.pixDiscountPercent / 100 : DEFAULT_PIX_DISCOUNT
  const pixPrice = product ? product.finalPrice * (1 - pixDiscount) : 0
  const installmentPrice = product ? product.finalPrice / INSTALLMENTS : 0

  const addToCart = () => {
    if (!product) return
    for (let index = 0; index < quantity; index += 1) addItem(product)
  }

  const handleShare = async () => {
    const shareData = { title: product?.name, url: window.location.href }
    if (navigator.share) {
      navigator.share(shareData).catch(() => {})
      return
    }
    try {
      await navigator.clipboard.writeText(window.location.href)
    } catch {
      // ambiente sem acesso a clipboard, ignora silenciosamente
    }
  }

  if (loading) {
    return <Skeleton className="h-[620px] w-full rounded-[36px]" />
  }

  if (!product) {
    return (
      <section className="surface-panel mx-auto max-w-2xl p-8 text-center">
        <ShieldCheck size={34} className="mx-auto text-[#d89a28]" />
        <h1 className="mt-4 font-serif text-3xl font-semibold">Produto não encontrado</h1>
        <p className="mt-2 text-sm text-[#6b665f]">Este produto foi removido ou não existe mais.</p>
      </section>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Reveal>
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="space-y-5">
            <div>
              {product.discountLabel ? (
                <Badge tone="amber" className="mb-4">
                  {product.discountLabel}
                </Badge>
              ) : null}
              <div className={`grid gap-3 ${allImages.length > 1 ? 'lg:grid-cols-[80px_1fr]' : ''}`}>
                {allImages.length > 1 ? (
                  <div className="hidden max-h-[420px] shrink-0 flex-col gap-3 overflow-y-auto pr-1 lg:flex">
                    {allImages.map((img: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImage(img)}
                        className={`shrink-0 overflow-hidden rounded-[16px] border-2 transition ${img === displayedImage ? 'border-[#b77717]' : 'border-transparent hover:border-[#ddc7ea]'}`}
                      >
                        <img
                          src={img}
                          alt={`${product.name} ${i + 1}`}
                          className="h-20 w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className={allImages.length > 1 ? 'lg:col-start-2' : ''}>
                  <div className="relative overflow-hidden rounded-[30px] bg-[#eadcf0] p-3">
                    <div className="absolute right-5 top-5 z-10 flex gap-2">
                      <button
                        type="button"
                        onClick={handleShare}
                        aria-label="Compartilhar produto"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#6b665f] shadow-sm transition hover:text-[#3a164f]"
                      >
                        <Share2 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFavorited((value) => !value)}
                        aria-label={favorited ? 'Remover dos favoritos' : 'Favoritar'}
                        aria-pressed={favorited}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#6b665f] shadow-sm transition hover:text-[#a0382f]"
                      >
                        <Heart size={18} className={favorited ? 'fill-[#a0382f] text-[#a0382f]' : ''} />
                      </button>
                    </div>
                    <img
                      src={displayedImage}
                      alt={product.name}
                      className="h-full min-h-[320px] w-full rounded-[24px] object-cover sm:min-h-[360px]"
                    />
                  </div>
                  {allImages.length > 1 ? (
                    <div className="mt-4 flex gap-3 overflow-x-auto pb-1 lg:hidden">
                      {allImages.map((img: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => setSelectedImage(img)}
                          className={`shrink-0 overflow-hidden rounded-[16px] border-2 transition ${img === displayedImage ? 'border-[#b77717]' : 'border-transparent hover:border-[#ddc7ea]'}`}
                        >
                          <img
                            src={img}
                            alt={`${product.name} ${i + 1}`}
                            className="h-16 w-16 object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {product.description ? (
              <Accordion title="Detalhes" defaultOpen>
                <p className="text-sm leading-7 text-[#6b665f]">{product.description}</p>
              </Accordion>
            ) : null}
          </div>

          <div className="surface-panel p-5 lg:sticky lg:top-6">
            <Badge tone="trust">{product.brand}</Badge>
            <h1 className="mt-2.5 font-serif text-2xl leading-tight text-[#2a0f3d] sm:text-3xl">
              {product.name}
            </h1>
            <p className="mt-2 text-sm text-[#6b665f]">
              Vendido e entregue por <b className="text-[#3a164f]">On Perfumaria</b>
            </p>

            <div className="mt-4 border-t border-[#ddc7ea] pt-4">
              <Badge tone={product.isAvailable ? 'success' : 'neutral'}>
                {product.isAvailable ? `${product.stockCurrent} unidades` : 'Indisponível'}
              </Badge>

              <div className="mt-3">
                {product.finalPrice < product.salePrice ? (
                  <p className="text-sm text-stone-400 line-through">{format(product.salePrice)}</p>
                ) : null}
                <p className="text-3xl leading-none text-[#2a0f3d]">{format(product.finalPrice)}</p>
                <p className="mt-2 text-sm text-[#0f8a5f]">
                  {format(pixPrice)} à vista no Pix (-{Math.round(pixDiscount * 100)}%)
                </p>
                <p className="mt-1 text-xs text-[#6b665f]">
                  ou {INSTALLMENTS}x de {format(installmentPrice)} sem juros
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between gap-4 border-t border-[#ddc7ea] pt-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-[#6b665f]">
                  Quantidade
                </span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(product.stockCurrent, 1)}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                  className="field-base w-24"
                />
              </label>
              <div className="text-right text-xs uppercase tracking-[0.2em] text-[#6b665f]">
                <p>Total</p>
                <p className="mt-1 text-base font-semibold tracking-normal text-[#2a0f3d]">{format(total)}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              <Button
                size="lg"
                fullWidth
                disabled={!product.isAvailable}
                onClick={() => {
                  addToCart()
                  navigate('/checkout')
                }}
              >
                Comprar agora
              </Button>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                disabled={!product.isAvailable}
                onClick={addToCart}
              >
                <ShoppingBag size={18} />
                {product.isAvailable ? 'Adicionar ao carrinho' : 'Produto indisponível'}
              </Button>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  )
}

function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="surface-panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-6 text-left"
      >
        <span className="font-serif text-xl text-[#2a0f3d]">{title}</span>
        <ChevronDown
          size={20}
          className={`shrink-0 text-[#6b665f] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <div className="px-6 pb-6">{children}</div> : null}
    </div>
  )
}
