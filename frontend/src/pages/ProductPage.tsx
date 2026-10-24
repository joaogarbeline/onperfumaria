import type { ReactNode } from 'react'
import { ChevronDown, FlaskConical, Heart, Share2, ShieldCheck, ShoppingBag } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Reveal } from '../components/Reveal'
import { toItemContent } from '../components/site/moduleContent'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { useCurrency } from '../hooks/useCurrency'
import { useOrganizerStore } from '../hooks/useOrganizerStore'
import { useFixedHeightVar } from './layout/useFixedHeightVar'
import { useIsMobile } from './layout/useIsMobile'
import { trackProductEvent } from '../services/productEvents'
import type { Product } from '../types'
import { getItemStatusPresentation } from '../utils/itemStatus'
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
  const { token } = useAuth()
  const tokenRef = useRef(token)
  useEffect(() => {
    tokenRef.current = token
  }, [token])
  const format = useCurrency()
  const isMobile = useIsMobile()
  const { store, remoteReady } = useOrganizerStore()
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState('')
  const [favorited, setFavorited] = useState(false)
  const mobileBarRef = useFixedHeightVar('--mobile-action-bar-height')

  const node = useMemo(
    () => store.nodes.find((candidate) => candidate.id === slug && candidate.type === 'item') ?? null,
    [slug, store.nodes],
  )
  const product: Product | null = useMemo(
    () => (node ? itemCardToProduct(toItemContent(node, store.tags)) : null),
    [node, store.tags],
  )
  // O Organizador local nasce com as paginas padrao, mas sem os itens: so da
  // para dizer que o produto nao existe depois da resposta do servidor (senao
  // o primeiro render pisca um "nao encontrado" falso).
  const loading = !node && !remoteReady

  useEffect(() => {
    if (node) trackProductEvent(node.id, 'view', tokenRef.current)
  }, [node])

  const allImages = product
    ? product.images?.length
      ? product.images
      : [product.imageUrl].filter(Boolean)
    : []
  const displayedImage = allImages.includes(selectedImage)
    ? selectedImage
    : allImages[0] || product?.imageUrl || ''
  const statusPresentation = getItemStatusPresentation(product?.status)
  const total = product ? product.finalPrice * quantity : 0
  const pixDiscount =
    product?.pixDiscountPercent != null ? product.pixDiscountPercent / 100 : DEFAULT_PIX_DISCOUNT
  const pixPrice = product ? product.finalPrice * (1 - pixDiscount) : 0
  const installmentPrice = product ? product.finalPrice / INSTALLMENTS : 0

  const purchaseDisabled = !product?.isAvailable || Boolean(statusPresentation.priceOverrideText)
  const addToCartLabel = statusPresentation.priceOverrideText
    ? statusPresentation.availableLabel
    : product?.isAvailable
      ? 'Adicionar ao carrinho'
      : 'Produto indisponível'

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

  // Em branco enquanto carrega: a rodinha da aba (ver preload em main.tsx) ja
  // indica o carregamento.
  if (loading) {
    return null
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
              <div className={`grid gap-3 ${allImages.length > 1 ? 'sm:grid-cols-[80px_1fr]' : ''}`}>
                {allImages.length > 1 ? (
                  <div className="hidden max-h-[420px] shrink-0 flex-col gap-3 overflow-y-auto pr-1 sm:flex">
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
                <div
                  className={`relative overflow-hidden rounded-[30px] ${displayedImage ? '' : 'bg-[#eadcf0] p-3'} ${statusPresentation.grayscale ? 'grayscale' : ''}`}
                >
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
                  {displayedImage ? (
                    <img
                      src={displayedImage}
                      alt={product.name}
                      className="h-full min-h-[260px] w-full object-cover sm:min-h-[300px]"
                    />
                  ) : (
                    <div className="flex h-full min-h-[260px] w-full items-center justify-center rounded-[24px] sm:min-h-[300px]">
                      <FlaskConical size={48} className="text-[#b77717]/50" />
                    </div>
                  )}
                </div>
              </div>
              {allImages.length > 1 ? (
                <div className="mt-3 flex gap-3 overflow-x-auto pb-1 sm:hidden">
                  {allImages.map((img: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(img)}
                      className={`shrink-0 overflow-hidden rounded-[16px] border-2 transition ${img === displayedImage ? 'border-[#b77717]' : 'border-transparent hover:border-[#ddc7ea]'}`}
                    >
                      <img src={img} alt={`${product.name} ${i + 1}`} className="h-16 w-16 object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
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
              <Badge
                tone={
                  statusPresentation.priceOverrideText
                    ? 'neutral'
                    : product.isAvailable
                      ? 'success'
                      : 'neutral'
                }
              >
                {statusPresentation.priceOverrideText
                  ? statusPresentation.availableLabel
                  : statusPresentation.showStockCount
                    ? `${product.stockCurrent} unidades`
                    : product.isAvailable
                      ? 'Disponível'
                      : 'Indisponível'}
              </Badge>

              <div className="mt-3">
                {statusPresentation.priceOverrideText ? (
                  <p className="text-3xl leading-none text-[#2a0f3d]">
                    {statusPresentation.priceOverrideText}
                  </p>
                ) : (
                  <>
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
                  </>
                )}
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
                disabled={purchaseDisabled}
                onClick={() => {
                  addToCart()
                  navigate('/checkout')
                }}
              >
                Comprar agora
              </Button>
              {/* No celular este botao fica na barra fixa acima do menu. */}
              {isMobile ? null : (
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  disabled={purchaseDisabled}
                  onClick={addToCart}
                >
                  <ShoppingBag size={18} />
                  {addToCartLabel}
                </Button>
              )}
            </div>
          </div>
        </section>
      </Reveal>

      {isMobile ? (
        <div
          ref={mobileBarRef}
          className="fixed inset-x-0 bottom-[var(--mobile-nav-height,64px)] z-20 border-t border-[#ddc7ea] bg-[#f8f5f9]/95 px-4 py-2.5 backdrop-blur"
        >
          <Button size="lg" fullWidth disabled={purchaseDisabled} onClick={addToCart}>
            <ShoppingBag size={18} />
            {addToCartLabel}
          </Button>
        </div>
      ) : null}
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
