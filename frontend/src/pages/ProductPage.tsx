import type { ReactNode } from 'react'
import { FileText, PackageCheck, ShieldCheck, ShoppingBag, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
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
import { Badge } from '../components/Badge'

// Modelo unico de pagina de produto: busca o produto real na API e, quando
// nao existe (ex.: item criado no Organizador, sem cadastro no catalogo),
// monta o mesmo modelo a partir do node do Organizador com o mesmo id.
export function ProductPage() {
  const { slug = '' } = useParams()
  const { addItem } = useCart()
  const format = useCurrency()
  const { store } = useOrganizerStore()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState('')

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

  if (loading) {
    return <Skeleton className="h-[620px] w-full rounded-[36px]" />
  }

  if (!product) {
    return (
      <section className="surface-panel mx-auto max-w-2xl p-8 text-center">
        <FileText size={34} className="mx-auto text-[#d89a28]" />
        <h1 className="mt-4 font-serif text-3xl font-semibold">Produto não encontrado</h1>
        <p className="mt-2 text-sm text-[#6b665f]">Este produto foi removido ou não existe mais.</p>
      </section>
    )
  }

  return (
    <div className="space-y-10">
      <Reveal>
        <section className="surface-panel grid gap-8 p-5 lg:grid-cols-[1.02fr_0.98fr] lg:p-8">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[30px] bg-[#eadcf0] p-3">
              <img
                src={displayedImage}
                alt={product.name}
                className="h-full min-h-[380px] w-full rounded-[24px] object-cover transition duration-500 hover:scale-[1.04] sm:min-h-[520px]"
              />
            </div>
            {allImages.length > 1 ? (
              <div className="flex gap-3 overflow-auto pb-1">
                {allImages.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(img)}
                    className={`shrink-0 overflow-hidden rounded-[18px] border-2 transition ${img === displayedImage ? 'border-[#b77717]' : 'border-transparent'}`}
                  >
                    <img src={img} alt={`${product.name} ${i + 1}`} className="h-20 w-20 object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoCard
                icon={<ShieldCheck size={18} />}
                title="Originalidade"
                text="Curadoria premium com dados sincronizados do estoque."
              />
              <InfoCard
                icon={<Truck size={18} />}
                title="Entrega"
                text="Envio e retirada conforme regras ativas de frete."
              />
              <InfoCard
                icon={<PackageCheck size={18} />}
                title="Seguranca"
                text="Checkout e descontos validados pelo backend."
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge tone="amber">{product.brand}</Badge>
                <Badge>{product.category}</Badge>
                <Badge tone={product.isAvailable ? 'success' : 'neutral'}>
                  {product.isAvailable ? `${product.stockCurrent} unidades` : 'Indisponivel'}
                </Badge>
              </div>
              <h1 className="text-5xl leading-none text-[#2a0f3d] sm:text-6xl">{product.name}</h1>
              <p className="text-base leading-8 text-[#6b665f]">{product.description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MetaPanel label="Genero" value={product.gender} />
              <MetaPanel label="Tipo" value={product.productType} />
              <MetaPanel label="Volume" value={`${product.volumeMl} ml`} />
            </div>

            <div className="surface-soft p-5">
              {product.finalPrice < product.salePrice ? (
                <p className="text-sm text-stone-400 line-through">{format(product.salePrice)}</p>
              ) : null}
              <div className="mt-1 flex items-end justify-between gap-4">
                <div>
                  <p className="text-5xl leading-none text-[#2a0f3d]">{format(product.finalPrice)}</p>
                  <p className="mt-2 text-sm text-[#0f8a5f]">
                    {product.discountLabel || 'Desconto automatico aplicado quando elegivel'}
                  </p>
                </div>
                <div className="text-right text-xs uppercase tracking-[0.2em] text-[#6b665f]">
                  <p>Total</p>
                  <p className="mt-1 text-base font-semibold tracking-normal text-[#2a0f3d]">
                    {format(total)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block sm:max-w-[120px]">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-[#6b665f]">
                  Quantidade
                </span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(product.stockCurrent, 1)}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                  className="field-base"
                />
              </label>
              <Button
                size="lg"
                fullWidth
                disabled={!product.isAvailable}
                onClick={() => {
                  for (let index = 0; index < quantity; index += 1) {
                    addItem(product)
                  }
                }}
                className="bg-[#d89a28] text-[#2a0f3d] hover:bg-[#ecb64c] disabled:bg-stone-200 disabled:text-stone-500"
              >
                <ShoppingBag size={18} />
                {product.isAvailable ? 'Adicionar ao carrinho' : 'Produto indisponivel'}
              </Button>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  )
}

function MetaPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-soft p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6b665f]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[#2a0f3d]">{value}</p>
    </div>
  )
}

function InfoCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="surface-soft flex gap-3 p-4">
      <div className="rounded-[18px] bg-[#fff1d6] p-3 text-[#b77717]">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-[#2a0f3d]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#6b665f]">{text}</p>
      </div>
    </div>
  )
}
