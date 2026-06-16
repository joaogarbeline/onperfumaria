import { Link } from 'react-router-dom'
import { Badge } from './Badge'

export function Footer() {
  return (
    <footer className="mt-16 border-t border-stone-200/80 bg-white/75">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.3fr_0.8fr_0.9fr]">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.38em] text-[#171412]">ON PERFUMARIA</p>
          <p className="max-w-md text-sm leading-7 text-[#6b665f]">
            Curadoria premium de perfumes importados e arabes com estoque real, checkout confiavel e atendimento local em Campo Grande-MS.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">Produto original</Badge>
            <Badge tone="amber">Entrega rapida</Badge>
            <Badge>Checkout seguro</Badge>
          </div>
        </div>

        <div className="space-y-4">
          <p className="eyebrow">Navegacao</p>
          <div className="grid gap-3 text-sm text-[#6b665f]">
            <Link to="/">Inicio</Link>
            <Link to="/catalogo">Catalogo</Link>
            <Link to="/conta">Minha conta</Link>
            <Link to="/checkout">Carrinho e checkout</Link>
          </div>
        </div>

        <div className="space-y-4">
          <p className="eyebrow">Contato</p>
          <div className="grid gap-3 text-sm text-[#6b665f]">
            <p>WhatsApp e atendimento local</p>
            <p>Campo Grande-MS</p>
            <a href="https://wa.me/5567999999999" target="_blank" rel="noreferrer">
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
