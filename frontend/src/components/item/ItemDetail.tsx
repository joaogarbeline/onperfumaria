import {
  ArrowLeft,
  Check,
  ChevronDown,
  Home,
  Image as ImageIcon,
  Link2,
  LocateFixed,
  Mail,
  MapPin,
  Paperclip,
  Play,
  Share2,
  User,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import { useCurrency } from '../../hooks/useCurrency'
import { useDragScroll } from '../../hooks/useDragScroll'
import { api } from '../../services/api'
import type { CustomerAddress } from '../../types'
import { InstagramIcon, WhatsAppIcon } from '../icons/SocialIcons'
import { DEMO_INSTALLMENTS, DEMO_MEDIA, DEMO_PRICE, DEMO_PRODUCT } from './demoProduct'
import { itemIcons } from './icons'
import { StarPicker, StarRow } from './ReviewStars'
import {
  formatDaysAgo,
  SORT_LABELS,
  sortReviews,
  type DemoReview,
  type ReviewPhoto,
  type SortMode,
} from './reviewUtils'

type ItemDetailLocationState = {
  from?: string
}

export function ItemDetail() {
  const format = useCurrency()
  const { token, scope } = useAuth()
  const { addItem, items, updateQuantity } = useCart()
  const location = useLocation()
  const navigate = useNavigate()
  const locationState = location.state as ItemDetailLocationState | null
  const {
    ref: mediaRef,
    dragging: mediaDragging,
    dragState: mediaDragState,
    handlers: mediaHandlers,
  } = useDragScroll<HTMLDivElement>()
  const [shareOpen, setShareOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [cep, setCep] = useState('')
  const [shipping, setShipping] = useState<string | null>(null)
  const [reviews, setReviews] = useState<DemoReview[]>([])
  const [newRating, setNewRating] = useState(0)
  const [newReviewText, setNewReviewText] = useState('')
  const [reviewPhotos, setReviewPhotos] = useState<ReviewPhoto[]>([])
  const reviewPhotoInputRef = useRef<HTMLInputElement>(null)
  const [cepSheetOpen, setCepSheetOpen] = useState(false)
  const [cepInputVisible, setCepInputVisible] = useState(false)
  const [savedAddress, setSavedAddress] = useState<CustomerAddress | null>(null)
  const [favorited, setFavorited] = useState(false)
  const [bagSheetOpen, setBagSheetOpen] = useState(false)
  const [quantityBeforeAdd, setQuantityBeforeAdd] = useState<number | null>(null)

  useEffect(() => {
    if (token && scope === 'customer') {
      api
        .get<{ addresses: CustomerAddress[] }>('/customer/me', token)
        .then((profile) =>
          setSavedAddress(
            profile.addresses.find((address) => address.isDefault) ?? profile.addresses[0] ?? null,
          ),
        )
        .catch(() => setSavedAddress(null))
    }
  }, [token, scope])

  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0
  const ratingCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]
    reviews.forEach((review) => {
      counts[review.rating - 1] += 1
    })
    return counts
  }, [reviews])
  const sortedReviews = useMemo(() => sortReviews(reviews, sortMode), [reviews, sortMode])
  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  useEffect(() => {
    const el = mediaRef.current
    if (!el) return

    let settleTimeout: number

    function snapToNearest() {
      if (!el || mediaDragState.current.active) return
      const children = Array.from(el.children) as HTMLElement[]
      if (children.length === 0) return
      const center = el.scrollLeft + el.clientWidth / 2
      let closest = children[0]
      let closestDistance = Infinity
      children.forEach((child) => {
        const childCenter = child.offsetLeft + child.offsetWidth / 2
        const distance = Math.abs(childCenter - center)
        if (distance < closestDistance) {
          closestDistance = distance
          closest = child
        }
      })
      const target = closest.offsetLeft + closest.offsetWidth / 2 - el.clientWidth / 2
      el.scrollTo({ left: target, behavior: 'smooth' })
    }

    function handleScroll() {
      window.clearTimeout(settleTimeout)
      settleTimeout = window.setTimeout(snapToNearest, 120)
    }

    el.addEventListener('scroll', handleScroll)
    return () => {
      el.removeEventListener('scroll', handleScroll)
      window.clearTimeout(settleTimeout)
    }
  }, [mediaRef, mediaDragState])

  function handleCalculateShipping(value: string) {
    if (value.replace(/\D/g, '').length < 8) {
      setShipping('CEP invalido')
      return
    }
    setShipping('Entrega estimada em 5 a 8 dias uteis')
  }

  function handleConfirmTypedCep() {
    handleCalculateShipping(cep)
    setCepSheetOpen(false)
    setCepInputVisible(false)
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setShipping('Geolocalizacao nao suportada neste navegador')
      setCepSheetOpen(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setShipping('Localizacao obtida. Entrega estimada em 5 a 8 dias uteis')
        setCepSheetOpen(false)
      },
      () => {
        setShipping('Nao foi possivel obter sua localizacao')
        setCepSheetOpen(false)
      },
    )
  }

  function handleUseSavedAddress() {
    if (!savedAddress) return
    setCep(savedAddress.cep)
    handleCalculateShipping(savedAddress.cep)
    setCepSheetOpen(false)
  }

  function handleCopyLink() {
    navigator.clipboard?.writeText(shareUrl)
    setShareOpen(false)
  }

  function handleSubmitReview() {
    if (newRating === 0 || (!newReviewText.trim() && reviewPhotos.length === 0)) return
    setReviews((current) => [
      {
        id: String(Date.now()),
        author: 'Voce',
        rating: newRating,
        daysAgo: 0,
        hasPhoto: reviewPhotos.length > 0,
        photos: reviewPhotos.map((photo) => photo.previewUrl),
        text: newReviewText.trim(),
      },
      ...current,
    ])
    setNewRating(0)
    setNewReviewText('')
    setReviewPhotos([])
  }

  function handleReviewPhotoSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedPhotos = Array.from(event.target.files ?? []).map((file) => ({
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      previewUrl: URL.createObjectURL(file),
    }))
    setReviewPhotos((current) => [...current, ...selectedPhotos])
    event.target.value = ''
  }

  function handleRemoveReviewPhoto(photoId: string) {
    setReviewPhotos((current) => {
      const photo = current.find((item) => item.id === photoId)
      if (photo) URL.revokeObjectURL(photo.previewUrl)
      return current.filter((item) => item.id !== photoId)
    })
  }

  function handleBuy() {
    const currentQuantity = items.find((item) => item.id === DEMO_PRODUCT.id)?.quantity ?? 0
    setQuantityBeforeAdd(currentQuantity)
    addItem(DEMO_PRODUCT)
    setBagSheetOpen(true)
  }

  function handleCancelAddedItem() {
    if (quantityBeforeAdd !== null) {
      updateQuantity(DEMO_PRODUCT.id, quantityBeforeAdd)
    }
    setBagSheetOpen(false)
    setQuantityBeforeAdd(null)
  }

  function handleContinueShopping() {
    setBagSheetOpen(false)
    setQuantityBeforeAdd(null)
  }

  function handleGoToBag() {
    setBagSheetOpen(false)
    setQuantityBeforeAdd(null)
    navigate('/checkout')
  }

  function handleClose() {
    navigate(locationState?.from || '/')
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between bg-[#f4efe8] px-4 py-4">
        <button type="button" onClick={handleClose} aria-label="Voltar" className="text-[#171412]">
          <ArrowLeft size={22} />
        </button>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setFavorited((value) => !value)}
            aria-label={favorited ? 'Remover dos favoritos' : 'Favoritar'}
            aria-pressed={favorited}
            className="text-[#171412]"
          >
            <img
              src={favorited ? itemIcons.coracaoPreenchido : itemIcons.coracaoContornado}
              alt=""
              className="h-6 w-6 object-contain"
            />
          </button>
          <button type="button" aria-label="Ver sacola" className="text-[#171412]">
            <img src={itemIcons.sacola} alt="" className="h-6 w-6 object-contain" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-0.5 px-4 pt-4">
          <h1 className="text-xl font-semibold text-[#171412]">Nome do produto</h1>
          <p className="text-xs text-[#6b665f]">Codigo: DEMO-0001</p>
        </div>

        <div className="flex items-center justify-between px-4 pt-3">
          <div className="flex items-center gap-1.5 text-sm">
            <StarRow rating={averageRating} />
            <span className="font-semibold text-[#171412]">{averageRating.toFixed(1)}</span>
            <span className="text-[#6b665f]">({reviews.length})</span>
          </div>
          <span className="inline-block rounded-[14px] bg-[#fff1d6] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b77717]">
            Perfume importado premium
          </span>
        </div>

        <div className="relative mt-4">
          <div
            ref={mediaRef}
            {...mediaHandlers}
            className={[
              'flex gap-8 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              mediaDragging ? 'cursor-grabbing select-none' : 'cursor-grab',
            ].join(' ')}
          >
            {DEMO_MEDIA.map((media, index) => (
              <div
                key={index}
                className="flex aspect-[4/3] w-full shrink-0 items-center justify-center bg-[#f4efe8] text-[#d89a28]"
              >
                {media.type === 'video' ? <Play size={36} /> : <ImageIcon size={36} strokeWidth={1.5} />}
              </div>
            ))}
          </div>

          <div className="absolute right-4 top-3">
            <button
              type="button"
              onClick={() => setShareOpen((value) => !value)}
              aria-label="Compartilhar"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#171412] shadow"
            >
              <Share2 size={16} />
            </button>
            {shareOpen ? (
              <div className="absolute right-0 top-11 z-10 w-52 space-y-1 rounded-[16px] border border-stone-200 bg-white p-2 shadow-lg">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-[12px] px-2 py-2 text-sm text-[#171412] hover:bg-stone-50"
                >
                  <WhatsAppIcon size={16} />
                  WhatsApp
                </a>
                <a
                  href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent('Confira esse perfume')}&body=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-[12px] px-2 py-2 text-sm text-[#171412] hover:bg-stone-50"
                >
                  <Mail size={16} />
                  Gmail
                </a>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex w-full items-center gap-2 rounded-[12px] px-2 py-2 text-sm text-[#171412] hover:bg-stone-50"
                >
                  <InstagramIcon size={16} />
                  Instagram (copiar link)
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex w-full items-center gap-2 rounded-[12px] px-2 py-2 text-sm text-[#171412] hover:bg-stone-50"
                >
                  <Link2 size={16} />
                  Copiar link
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 px-4 pt-6">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#d89a28]">Descricao</h2>
          <p className="text-sm leading-6 text-[#171412]">
            Fragrancia demonstrativa com notas amadeiradas e toque amanteigado, projecao moderada e boa
            fixacao. Texto de exemplo para a pagina de detalhes do item.
          </p>
        </div>

        <div className="mx-4 mt-6 rounded-[24px] p-4">
          <p className="text-2xl font-bold text-[#171412]">{format(DEMO_PRICE)}</p>
          <p className="mt-1 text-sm text-[#6b665f]">
            ou {DEMO_INSTALLMENTS}x de {format(DEMO_PRICE / DEMO_INSTALLMENTS)} sem juros
          </p>
          <button
            type="button"
            onClick={handleBuy}
            className="mt-4 w-full rounded-[18px] bg-[#fff1d6] py-3 text-sm font-semibold text-[#171412]"
          >
            Comprar
          </button>
        </div>

        <div className="mx-4 mt-0 space-y-3 rounded-[24px] px-4 pb-4 pt-1">
          <button
            type="button"
            onClick={() => setCepSheetOpen(true)}
            className="w-full rounded-[14px] bg-[#fff1d6] py-2.5 text-sm font-semibold text-[#171412]"
          >
            Adicionar CEP
          </button>
          {cep ? <p className="text-xs text-[#6b665f]">CEP informado: {cep}</p> : null}
          {shipping ? <p className="text-xs text-[#6b665f]">{shipping}</p> : null}
        </div>

        <div className="mx-4 mb-8 mt-8 space-y-4">
          <h2 className="text-lg font-semibold text-[#171412]">Avaliacoes ({reviews.length})</h2>

          <div className="space-y-1.5">
            {ratingCounts
              .map((count, index) => ({ star: index + 1, count }))
              .reverse()
              .map(({ star, count }) => (
                <div key={star} className="flex items-center gap-2 text-xs text-[#6b665f]">
                  <span className="w-8 shrink-0">{star} est.</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
                    <div
                      className="h-full rounded-full bg-[#d89a28]"
                      style={{ width: reviews.length ? `${(count / reviews.length) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="w-4 shrink-0 text-right">{count}</span>
                </div>
              ))}
          </div>

          <div className="space-y-3 rounded-[20px] border border-stone-200 p-4">
            <p className="text-sm font-semibold text-[#171412]">Avalie este produto</p>
            <StarPicker value={newRating} onChange={setNewRating} />
            <div className="relative">
              <textarea
                value={newReviewText}
                onChange={(event) => setNewReviewText(event.target.value)}
                placeholder="Escreva sua avaliacao"
                rows={3}
                className="w-full rounded-[14px] border border-stone-300 bg-white px-3 py-2 pb-10 pr-10 text-sm text-[#171412] focus:border-[#d89a28] focus:outline-none"
              />
              <input
                ref={reviewPhotoInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleReviewPhotoSelect}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => reviewPhotoInputRef.current?.click()}
                aria-label="Anexar fotos ao comentario"
                title="Anexar fotos"
                className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full text-[#d89a28] hover:bg-[#fff1d6]"
              >
                <Paperclip size={17} />
              </button>
            </div>
            {reviewPhotos.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {reviewPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative h-16 w-16 overflow-hidden rounded-[12px] border border-stone-200 bg-[#f4efe8]"
                  >
                    <img
                      src={photo.previewUrl}
                      alt="Prévia da foto anexada"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveReviewPhoto(photo.id)}
                      aria-label="Remover foto anexada"
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#171412]/80 text-xs font-bold text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleSubmitReview}
              disabled={newRating === 0 || (!newReviewText.trim() && reviewPhotos.length === 0)}
              className="rounded-[14px] bg-[#142d52] px-4 py-2 text-sm font-semibold text-[#fafaf8] disabled:opacity-40"
            >
              Enviar avaliacao
            </button>
          </div>

          {reviews.length === 0 ? (
            <p className="text-sm text-[#6b665f]">Nenhuma avaliacao ainda. Seja o primeiro a avaliar.</p>
          ) : (
            <>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSortOpen((value) => !value)}
                  className="flex w-full items-center justify-between rounded-[14px] border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#171412]"
                >
                  <span>
                    Ordenar por: <span className="font-semibold">{SORT_LABELS[sortMode]}</span>
                  </span>
                  <ChevronDown
                    size={16}
                    className={sortOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
                  />
                </button>
                {sortOpen ? (
                  <div className="absolute inset-x-0 top-full z-10 mt-1 space-y-0.5 rounded-[14px] border border-stone-200 bg-white p-1.5 shadow-lg">
                    {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setSortMode(mode)
                          setSortOpen(false)
                        }}
                        className={`block w-full rounded-[10px] px-3 py-2 text-left text-sm ${
                          mode === sortMode
                            ? 'bg-[#fff1d6] font-semibold text-[#b77717]'
                            : 'text-[#171412] hover:bg-stone-50'
                        }`}
                      >
                        {SORT_LABELS[mode]}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                {sortedReviews.map((review) => (
                  <div key={review.id} className="space-y-1.5 border-b border-stone-100 pb-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#171412]">{review.author}</p>
                      <span className="text-xs text-[#6b665f]">{formatDaysAgo(review.daysAgo)}</span>
                    </div>
                    <StarRow rating={review.rating} size={12} />
                    {review.text ? <p className="text-sm leading-5 text-[#171412]">{review.text}</p> : null}
                    {review.photos.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {review.photos.map((photoUrl) => (
                          <img
                            key={photoUrl}
                            src={photoUrl}
                            alt={`Foto da avaliação de ${review.author}`}
                            className="h-20 w-20 rounded-[12px] object-cover"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="z-10 flex shrink-0 items-center justify-between gap-3 border-t border-stone-200 bg-white px-4 py-3 shadow-[0_-10px_30px_-20px_rgba(23,20,18,0.35)]">
        <div>
          <p className="text-xs text-[#6b665f]">Valor</p>
          <p className="text-lg font-bold text-[#171412]">{format(DEMO_PRICE)}</p>
        </div>
        <button
          type="button"
          onClick={handleBuy}
          className="rounded-[18px] bg-[#fff1d6] px-8 py-3 text-sm font-semibold text-[#171412]"
        >
          Comprar
        </button>
      </div>

      {bagSheetOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end">
          <button
            type="button"
            aria-label="Continuar comprando"
            onClick={handleContinueShopping}
            className="absolute inset-0 bg-[#171412]/40"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="bag-sheet-title"
            className="animate-slide-up relative w-full rounded-t-[28px] bg-white px-5 pb-7 pt-6 shadow-[0_-16px_40px_-24px_rgba(23,20,18,0.45)]"
          >
            <button
              type="button"
              onClick={handleCancelAddedItem}
              aria-label="Cancelar adição à sacola"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[#171412] hover:bg-stone-100"
            >
              <X size={20} />
            </button>

            <div className="flex gap-4 pr-12">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-[#f4efe8]">
                <img
                  src={DEMO_PRODUCT.imageUrl || itemIcons.frascoGold}
                  alt={DEMO_PRODUCT.name}
                  className="h-full w-full object-contain p-3"
                />
                <span
                  aria-label="Produto verificado"
                  className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#0f8a5f] text-white ring-2 ring-white"
                >
                  <Check size={14} strokeWidth={3} />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#0f8a5f]">Adicionado à sacola!</p>
                <h2 id="bag-sheet-title" className="mt-2 truncate text-lg font-semibold text-[#171412]">
                  {DEMO_PRODUCT.name}
                </h2>
                <p className="mt-1 text-sm text-[#6b665f]">Qtde: 1 | Tamanho: {DEMO_PRODUCT.volumeMl} ml</p>
                <p className="mt-2 text-lg font-bold text-[#171412]">{format(DEMO_PRODUCT.finalPrice)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={handleGoToBag}
                className="w-full rounded-[16px] bg-[#d89a28] px-4 py-3 text-sm font-semibold text-white"
              >
                Ir para Sacola
              </button>
              <button
                type="button"
                onClick={handleContinueShopping}
                className="w-full rounded-[16px] border border-[#d89a28] bg-transparent px-4 py-3 text-sm font-semibold text-[#d89a28]"
              >
                Continuar Comprando
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {cepSheetOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => {
              setCepSheetOpen(false)
              setCepInputVisible(false)
            }}
            className="absolute inset-0 bg-[#171412]/40"
          />
          <div className="animate-slide-up relative w-full space-y-3 rounded-t-[28px] bg-white p-5">
            <div className="mx-auto h-1 w-10 rounded-full bg-stone-300" />
            <h3 className="text-sm font-semibold text-[#171412]">Como voce quer informar o CEP?</h3>

            {cepInputVisible ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={cep}
                  onChange={(event) => setCep(event.target.value)}
                  placeholder="Digite seu CEP"
                  className="flex-1 rounded-[14px] border border-stone-300 bg-white px-3 py-2.5 text-sm text-[#171412] focus:border-[#d89a28] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleConfirmTypedCep}
                  className="rounded-[14px] bg-[#fff1d6] px-4 py-2.5 text-sm font-semibold text-[#171412]"
                >
                  Confirmar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCepInputVisible(true)}
                className="flex w-full items-center gap-3 rounded-[16px] border border-stone-200 px-4 py-3 text-sm text-[#171412]"
              >
                <MapPin size={16} className="text-[#b77717]" />
                Digitar CEP
              </button>
            )}

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className="flex w-full items-center gap-3 rounded-[16px] border border-stone-200 px-4 py-3 text-sm text-[#171412]"
            >
              <LocateFixed size={16} className="text-[#b77717]" />
              Usar localizacao atual
            </button>

            {!token || scope !== 'customer' ? (
              <Link
                to="/login"
                onClick={() => setCepSheetOpen(false)}
                className="flex w-full items-center gap-3 rounded-[16px] border border-stone-200 px-4 py-3 text-sm text-[#171412]"
              >
                <User size={16} className="text-[#b77717]" />
                Entrar na minha conta
              </Link>
            ) : savedAddress ? (
              <button
                type="button"
                onClick={handleUseSavedAddress}
                className="flex w-full items-center gap-3 rounded-[16px] border border-stone-200 px-4 py-3 text-sm text-[#171412]"
              >
                <Home size={16} className="text-[#b77717]" />
                Usar endereco da conta (CEP {savedAddress.cep})
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
