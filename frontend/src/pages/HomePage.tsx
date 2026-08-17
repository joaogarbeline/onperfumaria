import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  TicketPercent,
  Truck,
  WalletCards,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BrandMarquee } from '../components/BrandMarquee'
import { Button, buttonClassName } from '../components/Button'
import { CategoryCard } from '../components/CategoryCard'
import { ProductCard } from '../components/ProductCard'
import { ProductCarousel } from '../components/ProductCarousel'
import { Reveal } from '../components/Reveal'
import { SectionTitle } from '../components/SectionTitle'
import { Skeleton } from '../components/Skeleton'
import { StatCounter } from '../components/StatCounter'
import { TiltCard } from '../components/TiltCard'
import { api } from '../services/api'
import type { Product } from '../types'

type HomeData = {
  hero: { title: string; subtitle: string; imageUrl?: string; ctaLabel?: string; ctaLink?: string }
  featured: Product[]
  categories: Record<string, number>
  benefits: string[]
}

const trustIcons = [ShieldCheck, Truck, WalletCards, TicketPercent]
const marqueeFallback = [
  'Chanel',
  'Dior',
  'Carolina Herrera',
  'Lattafa',
  'Armaf',
  'Paco Rabanne',
  'Versace',
  'Jean Paul Gaultier',
]

export function HomePage() {
  const [data, setData] = useState<HomeData | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api
      .get<HomeData>('/store/home')
      .then(setData)
      .finally(() => setLoaded(true))
  }, [])

  const products = data?.featured ?? []
  const dynamicBrands = Array.from(new Set(products.map((product) => product.brand)))
  const brands =
    dynamicBrands.length > 0
      ? [...dynamicBrands, ...marqueeFallback.filter((brand) => !dynamicBrands.includes(brand))]
      : marqueeFallback

  if (!loaded && !data) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-[520px] w-full rounded-[36px]" />
        <Skeleton className="h-24 w-full rounded-[32px]" />
        <div className="grid gap-6 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[440px] w-full rounded-[32px]" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="space-y-12 sm:space-y-16">
      <Reveal>
        <section className="surface-panel grid gap-8 overflow-hidden p-6 lg:grid-cols-[1.08fr_0.92fr] lg:p-8 xl:p-10">
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="eyebrow">On Perfumaria e Importados</p>
              <h1 className="max-w-4xl text-5xl leading-[0.92] text-[#171412] sm:text-6xl xl:text-7xl">
                {data.hero.title}
              </h1>
              <p className="max-w-2xl text-base leading-8 text-[#6b665f] sm:text-lg">
                {data.hero.subtitle}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to={data.hero.ctaLink || '/catalogo'}>
                <Button size="lg">
                  {data.hero.ctaLabel || 'Explorar catalogo'}
                  <ArrowRight size={18} />
                </Button>
              </Link>
              <Link to="/catalogo?desconto=1" className={buttonClassName({ variant: 'secondary', size: 'lg' })}>
                Ver ofertas
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(data.benefits.length > 0 ? data.benefits : marqueeFallback.slice(0, 4)).slice(0, 4).map((benefit, index) => {
                const Icon = trustIcons[index] || Sparkles
                return (
                  <TiltCard
                    key={benefit}
                    intensity={5}
                    className="surface-soft flex items-start gap-3 p-4 transition-shadow duration-300 hover:shadow-[var(--shadow-3d)]"
                  >
                    <div className="rounded-[18px] bg-[#fff1d6] p-3 text-[#b77717]">
                      <Icon size={18} />
                    </div>
                    <p className="text-sm leading-6 text-[#6b665f]">{benefit}</p>
                  </TiltCard>
                )
              })}
            </div>
          </div>

          <TiltCard
            intensity={5}
            glare={false}
            className="relative flex min-h-[420px] items-end justify-center overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_rgba(244,239,232,0.75)_45%,_rgba(23,20,18,0.12)_130%)] p-5"
          >
            <div className="orbit-ring absolute -right-10 -top-10 h-40 w-40 rounded-full border border-dashed border-[#d89a28]/30" aria-hidden="true" />
            <div className="absolute inset-6 rounded-[28px] border border-white/50 bg-white/20 backdrop-blur-xl" />
            <div className="absolute inset-x-16 bottom-4 h-24 rounded-full bg-[#d89a28]/20 blur-3xl" />
            <div className="tilt-layer relative z-10 w-full max-w-[360px] rounded-[30px] border border-white/70 bg-white/70 p-4 shadow-[0_35px_80px_-40px_rgba(23,20,18,0.38)] backdrop-blur-md">
              <img
                src={data.hero.imageUrl || 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=1200&q=80'}
                alt="Destaque da loja"
                className="float-soft h-[360px] w-full rounded-[24px] object-cover"
              />
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="eyebrow">Curadoria ativa</p>
                  <p className="text-sm text-[#6b665f]">Perfumes importados e arabes com estoque real.</p>
                </div>
                <div className="rounded-full bg-[#171412] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#f6dba5]">
                  Premium
                </div>
              </div>
            </div>
            <div className="trust-pulse tilt-layer absolute right-8 top-8 z-20 flex items-center gap-2 rounded-full border border-[#c3d2ea] bg-white/90 px-3.5 py-2 shadow-[0_16px_30px_-16px_rgba(20,45,82,0.5)] backdrop-blur">
              <ShieldCheck size={14} className="text-[#142d52]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#142d52]">Original garantido</span>
            </div>
          </TiltCard>
        </section>
      </Reveal>

      <Reveal delay={80}>
        <BrandMarquee brands={brands} />
      </Reveal>

      <Reveal delay={100}>
        <section className="surface-trust relative overflow-hidden px-6 py-8 sm:px-10 sm:py-10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#2a4d82]/40 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-[#d89a28]/15 blur-3xl" aria-hidden="true" />
          <div className="relative grid gap-8 sm:grid-cols-3">
            <StatCounter value={12500} suffix="+" label="Pedidos entregues com sucesso" />
            <StatCounter value={4.9} decimals={1} suffix=" / 5" label="Avaliacao media dos clientes" />
            <StatCounter value={100} suffix="%" label="Produtos com originalidade garantida" />
          </div>
        </section>
      </Reveal>

      <Reveal delay={120}>
        <section className="space-y-8">
          <SectionTitle
            eyebrow="Destaques"
            title="Selecao premium com desconto automatico"
            description="Os produtos em destaque seguem os dados ativos do banco, com estoque, descontos e disponibilidade atualizados em tempo real."
          />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {products.map((product, index) => (
              <Reveal key={product.id} delay={index * 70}>
                <ProductCard product={product} />
              </Reveal>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal delay={160}>
        <ProductCarousel
          title="Mais desejados da semana"
          description="Uma vitrine horizontal para mobile e desktop com a mesma base de produtos reais, ideal para novidades, mais vendidos e promocoes."
          products={products.length > 1 ? [...products].reverse() : products}
        />
      </Reveal>

      <Reveal delay={220}>
        <section className="space-y-8">
          <SectionTitle
            eyebrow="Categorias"
            title="Navegue pela colecao ideal"
            description="Entre direto no catalogo filtrado por familia de fragrancias e encontre o seu proximo importado com uma experiencia mais fluida."
          />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(data.categories).map(([name, total]) => (
              <CategoryCard key={name} name={name} total={total} />
            ))}
          </div>
        </section>
      </Reveal>
    </div>
  )
}
