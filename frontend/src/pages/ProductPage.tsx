import type { ReactNode } from 'react'
import { PackageCheck, ShieldCheck, ShoppingBag, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { ProductCarousel } from '../components/ProductCarousel'
import { Reveal } from '../components/Reveal'
import { Skeleton } from '../components/Skeleton'
import { useCart } from '../contexts/CartContext'
import { useCurrency } from '../hooks/useCurrency'
import { api } from '../services/api'
import type { Product } from '../types'
import { Badge } from '../components/Badge'

export function ProductPage() {
  const { slug = '' } = useParams()
  const { addItem } = useCart()
  const format = useCurrency()
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    Promise.all([api.get<Product>(`/products/${slug}`), api.get<Product[]>('/products')])
      .then(([detail, allProducts]) => {
        setProduct(detail)
        setRelated(
          allProducts
            .filter((item) => item.slug !== detail.slug && (item.category === detail.category || item.brand === detail.brand))
            .slice(0, 8),
        )
      })
  }, [slug])

  const [selectedImage, setSelectedImage] = useState('')

  useEffect(() => {
    if (product) {
      const img = product.images?.length ? product.images : [product.imageUrl].filter(Boolean)
      setSelectedImage(img[0] || product.imageUrl)
    }
  }, [product])

  const allImages = product ? (product.images?.length ? product.images : [product.imageUrl].filter(Boolean)) : []
  const total = product ? product.finalPrice * quantity : 0

  if (!product || product.slug !== slug) {
    return <Skeleton className="h-[620px] w-full rounded-[36px]" />
  }

  return (
    <div className="space-y-10">
      <Reveal>
        <section className="surface-panel grid gap-8 p-5 lg:grid-cols-[1.02fr_0.98fr] lg:p-8">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[30px] bg-[#f4efe8] p-3">
              <img
                src={selectedImage}
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
                  className={`shrink-0 overflow-hidden rounded-[18px] border-2 transition ${img === selectedImage ? 'border-[#b77717]' : 'border-transparent'}`}
                  >
                    <img src={img} alt={`${product.name} ${i + 1}`} className="h-20 w-20 object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoCard icon={<ShieldCheck size={18} />} title="Originalidade" text="Curadoria premium com dados sincronizados do estoque." />
              <InfoCard icon={<Truck size={18} />} title="Entrega" text="Envio e retirada conforme regras ativas de frete." />
              <InfoCard icon={<PackageCheck size={18} />} title="Seguranca" text="Checkout e descontos validados pelo backend." />
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
              <h1 className="text-5xl leading-none text-[#171412] sm:text-6xl">{product.name}</h1>
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
                  <p className="text-5xl leading-none text-[#171412]">{format(product.finalPrice)}</p>
                  <p className="mt-2 text-sm text-[#0f8a5f]">
                    {product.discountLabel || 'Desconto automatico aplicado quando elegivel'}
                  </p>
                </div>
                <div className="text-right text-xs uppercase tracking-[0.2em] text-[#6b665f]">
                  <p>Total</p>
                  <p className="mt-1 text-base font-semibold tracking-normal text-[#171412]">{format(total)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block sm:max-w-[120px]">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-[#6b665f]">Quantidade</span>
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
                className="bg-[#d89a28] text-[#171412] hover:bg-[#ecb64c] disabled:bg-stone-200 disabled:text-stone-500"
              >
                <ShoppingBag size={18} />
                {product.isAvailable ? 'Adicionar ao carrinho' : 'Produto indisponivel'}
              </Button>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal delay={90}>
        <ProductCarousel
          title="Relacionados para combinar com sua busca"
          description="Sugestoes da mesma marca ou categoria, mantendo a navegacao comercial sem depender de dados artificiais."
          products={related}
        />
      </Reveal>
    </div>
  )
}

function MetaPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-soft p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6b665f]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[#171412]">{value}</p>
    </div>
  )
}

function InfoCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode
  title: string
  text: string
}) {
  return (
    <div className="surface-soft flex gap-3 p-4">
      <div className="rounded-[18px] bg-[#fff1d6] p-3 text-[#b77717]">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-[#171412]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#6b665f]">{text}</p>
      </div>
    </div>
  )
}
