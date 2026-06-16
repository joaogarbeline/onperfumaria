import { ShieldCheck, TicketPercent, Truck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCurrency } from '../hooks/useCurrency'

export function CartSummary({
  subtotal,
  discount = 0,
  shipping = 0,
  total,
  couponCode,
  shippingLabel,
  compact = false,
}: {
  subtotal: number
  discount?: number
  shipping?: number
  total: number
  couponCode?: string
  shippingLabel?: string
  compact?: boolean
}) {
  const format = useCurrency()

  return (
    <section className={compact ? 'surface-soft p-5' : 'surface-panel p-6 sm:p-7'}>
      <div className="space-y-1">
        <p className="eyebrow">Resumo</p>
        <h2 className="text-3xl text-[#171412]">Pedido premium</h2>
      </div>

      <div className="mt-6 space-y-4 text-sm">
        <SummaryRow label="Subtotal" value={format(subtotal)} />
        <SummaryRow label="Desconto" value={discount > 0 ? `- ${format(discount)}` : format(0)} highlight={discount > 0} />
        <SummaryRow label={shippingLabel || 'Frete'} value={shipping > 0 ? format(shipping) : 'A calcular'} />
        {couponCode ? <SummaryRow label="Cupom informado" value={couponCode.toUpperCase()} /> : null}
      </div>

      <div className="mt-5 rounded-[26px] bg-[#171412] px-5 py-5 text-[#fafaf8]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f6dba5]">Total estimado</p>
        <p className="mt-2 text-4xl">{format(total)}</p>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-[#6b665f]">
        <TrustLine icon={<ShieldCheck size={16} />} text="Checkout seguro e validado pelo backend." />
        <TrustLine icon={<Truck size={16} />} text="Frete calculado com base no CEP e peso real." />
        <TrustLine icon={<TicketPercent size={16} />} text="Cupons e descontos automaticos seguem as regras ativas." />
      </div>
    </section>
  )
}

function SummaryRow({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#6b665f]">{label}</span>
      <span className={highlight ? 'font-semibold text-[#0f8a5f]' : 'font-semibold text-[#171412]'}>{value}</span>
    </div>
  )
}

function TrustLine({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-[#d89a28]">{icon}</span>
      <span>{text}</span>
    </div>
  )
}
