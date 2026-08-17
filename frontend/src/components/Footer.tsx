import { CreditCard, Lock, ShieldCheck, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from './Badge'

const trustSeals = [
  { icon: ShieldCheck, label: 'Produto 100% original' },
  { icon: Lock, label: 'Pagamento criptografado' },
  { icon: Truck, label: 'Entrega rastreada' },
  { icon: CreditCard, label: 'Checkout protegido' },
]

export function Footer() {
  return (
    <footer className="relative mt-16 overflow-hidden border-t border-[#24457a] bg-[linear-gradient(160deg,#142d52_0%,#0a1a33_100%)] text-[#e7edf7]">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#2a4d82]/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-[#d89a28]/15 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl gap-10 border-b border-white/10 px-4 py-10 sm:px-6 lg:grid-cols-[1.3fr_0.8fr_0.9fr]">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.38em] text-white">ON PERFUMARIA</p>
          <p className="max-w-md text-sm leading-7 text-[#a9bedd]">
            Curadoria premium de perfumes importados e arabes com estoque real, checkout confiavel e atendimento local em Campo Grande-MS.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">Produto original</Badge>
            <Badge tone="amber">Entrega rapida</Badge>
            <Badge tone="trust">Checkout seguro</Badge>
          </div>
        </div>

        <div className="space-y-4">
          <p className="eyebrow-trust">Navegacao</p>
          <div className="grid gap-3 text-sm text-[#a9bedd]">
            <Link to="/" className="transition hover:text-white">Inicio</Link>
            <Link to="/catalogo" className="transition hover:text-white">Catalogo</Link>
            <Link to="/conta" className="transition hover:text-white">Minha conta</Link>
            <Link to="/checkout" className="transition hover:text-white">Carrinho e checkout</Link>
          </div>
        </div>

        <div className="space-y-4">
          <p className="eyebrow-trust">Contato</p>
          <div className="grid gap-3 text-sm text-[#a9bedd]">
            <p>WhatsApp e atendimento local</p>
            <p>Campo Grande-MS</p>
            <a href="https://wa.me/5567999999999" target="_blank" rel="noreferrer" className="transition hover:text-white">
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {trustSeals.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur-sm"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d89a28]/15 text-[#f0c977]">
                <Icon size={15} />
              </span>
              <span className="text-[11px] font-medium leading-4 text-[#dbe6f5]">{label}</span>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-[11px] uppercase tracking-[0.2em] text-[#6d84ab] sm:text-left">
          On Perfumaria e Importados — todos os direitos reservados
        </p>
      </div>
    </footer>
  )
}
