import { Check, Clock, Copy, MessageCircle, Package, ShoppingBag, Sparkles, Truck } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useCurrency } from '../../hooks/useCurrency'
import { Button } from '../Button'

const CONFETTI_COLORS = ['#a54de6', '#f2b33d', '#6a2a94', '#ffd27a', '#e879f9', '#0f8a5f']

// Pecas espalhadas em circulo a partir do selo, com distancia e giro
// variados (deterministicos, para nao mudar a cada render).
const CONFETTI = Array.from({ length: 26 }, (_, index) => {
  const angle = (index / 26) * Math.PI * 2
  const distance = 120 + ((index * 37) % 70)
  return {
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    style: {
      '--dx': `${Math.cos(angle) * distance}px`,
      '--dy': `${Math.sin(angle) * distance - 30}px`,
      '--rot': `${(index * 47) % 360}deg`,
      animationDelay: `${150 + (index % 5) * 40}ms`,
    } as CSSProperties,
  }
})

function shortOrderId(orderId: string) {
  return orderId.slice(0, 8).toUpperCase()
}

function useCopy() {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => undefined)
  }
  return { copied, copy }
}

function SuccessBadge({ pending }: { pending: boolean }) {
  return (
    <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
      {pending ? null : (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {CONFETTI.map((piece, index) => (
            <span
              key={index}
              className="confetti-piece"
              style={{ ...piece.style, backgroundColor: piece.color }}
            />
          ))}
        </div>
      )}
      <span
        aria-hidden="true"
        className={`success-ring absolute inset-2 rounded-full ${pending ? 'bg-[#f2b33d]/40' : 'bg-[#9b3fd6]/35'}`}
      />
      <span
        className={`success-badge relative flex h-24 w-24 items-center justify-center rounded-full text-white shadow-[var(--glow-violet)] ${
          pending ? 'bg-[image:var(--grad-gold)]' : 'bg-[image:var(--grad-brand)]'
        }`}
      >
        {pending ? (
          <Clock size={40} strokeWidth={2.4} />
        ) : (
          <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" aria-hidden="true">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              className="check-draw"
              stroke="currentColor"
              strokeWidth={2.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </div>
  )
}

function OrderIdChip({ orderId }: { orderId: string }) {
  const { copied, copy } = useCopy()
  return (
    <button
      type="button"
      onClick={() => copy(orderId)}
      className="inline-flex items-center gap-2 rounded-full border border-[#ddc7ea] bg-white px-4 py-2 text-sm font-semibold text-[#3a164f] shadow-sm transition hover:-translate-y-0.5 hover:border-[#b98ad8] hover:shadow-[0_12px_24px_-16px_rgba(106,42,148,0.6)]"
    >
      Pedido <span className="font-extrabold tracking-wider">#{shortOrderId(orderId)}</span>
      {copied ? (
        <Check size={15} className="text-[#0f8a5f]" />
      ) : (
        <Copy size={15} className="text-[#9b86a8]" />
      )}
    </button>
  )
}

type Step = { label: string; icon: typeof Check; state: 'done' | 'current' | 'next' }

function NextSteps({ steps }: { steps: Step[] }) {
  return (
    <ol className="mx-auto w-full max-w-sm space-y-2 text-left">
      {steps.map((step, index) => {
        const Icon = step.state === 'done' ? Check : step.icon
        return (
          <li
            key={step.label}
            className="rise-in flex items-center gap-3 rounded-[18px] border border-[#ecdcf5] bg-white/80 px-4 py-3"
            style={{ animationDelay: `${450 + index * 110}ms` }}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                step.state === 'done'
                  ? 'bg-[image:var(--grad-brand)] text-white'
                  : step.state === 'current'
                    ? 'bg-[#fff1d6] text-[#b77717]'
                    : 'bg-[#f4eef7] text-[#b7a3c4]'
              }`}
            >
              <Icon size={16} strokeWidth={step.state === 'done' ? 3 : 2} />
            </span>
            <span
              className={`flex-1 text-sm font-semibold ${step.state === 'next' ? 'text-[#9b86a8]' : 'text-[#2a0f3d]'}`}
            >
              {step.label}
            </span>
            {step.state === 'current' ? <span className="live-dot" aria-label="em andamento" /> : null}
          </li>
        )
      })}
    </ol>
  )
}

function whatsappHref(storeWhatsapp: string, message: string) {
  return `https://wa.me/${storeWhatsapp}?text=${encodeURIComponent(message)}`
}

/** Tela final da compra (cartao aprovado, em analise ou Pix ja pago). */
export function OrderSuccess({
  orderId,
  total,
  pending = false,
  storeWhatsapp,
  whatsappMessage,
}: {
  orderId: string
  total?: number
  pending?: boolean
  storeWhatsapp?: string
  whatsappMessage: string
}) {
  const format = useCurrency()
  const steps: Step[] = [
    { label: 'Pedido recebido', icon: ShoppingBag, state: 'done' },
    {
      label: pending ? 'Pagamento em análise' : 'Pagamento aprovado',
      icon: Clock,
      state: pending ? 'current' : 'done',
    },
    { label: 'Preparando seu pedido', icon: Package, state: pending ? 'next' : 'current' },
    { label: 'A caminho', icon: Truck, state: 'next' },
  ]

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center py-6">
      <div className="surface-panel relative w-full overflow-hidden px-6 py-10 text-center sm:px-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[#a54de6]/20 blur-3xl"
        />
        <SuccessBadge pending={pending} />

        <div className="rise-in mt-6 space-y-2" style={{ animationDelay: '250ms' }}>
          <p className="eyebrow inline-flex items-center gap-1.5">
            <Sparkles size={13} /> {pending ? 'Quase lá' : 'Compra confirmada'}
          </p>
          <h1 className="text-4xl leading-tight text-[#2a0f3d] sm:text-5xl">
            {pending ? 'Pagamento em análise' : 'Obrigado pela compra!'}
          </h1>
          <p className="mx-auto max-w-sm text-sm leading-6 text-[#6b665f]">
            {pending
              ? 'Seu banco está analisando o pagamento. Assim que for aprovado, seu pedido segue automaticamente.'
              : 'Seu pagamento foi aprovado e já estamos separando seus perfumes com todo o cuidado.'}
          </p>
        </div>

        <div
          className="rise-in mt-6 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: '350ms' }}
        >
          <OrderIdChip orderId={orderId} />
          {total ? (
            <span className="rounded-full bg-[#f6ecfc] px-4 py-2 text-sm font-semibold text-[#3a164f]">
              Total <span className="text-gradient-brand font-extrabold">{format(total)}</span>
            </span>
          ) : null}
        </div>

        <div className="mt-7">
          <NextSteps steps={steps} />
        </div>

        <div
          className="rise-in mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
          style={{ animationDelay: '900ms' }}
        >
          <Link to={`/pedido/${orderId}`}>
            <Button fullWidth>
              <Package size={16} /> Acompanhar pedido
            </Button>
          </Link>
          {storeWhatsapp ? (
            <a href={whatsappHref(storeWhatsapp, whatsappMessage)} target="_blank" rel="noreferrer">
              <Button type="button" variant="secondary" fullWidth>
                <MessageCircle size={16} /> Falar no WhatsApp
              </Button>
            </a>
          ) : null}
        </div>
        <Link
          to="/"
          className="rise-in mt-4 inline-block text-sm font-semibold text-[#6a2a94] underline-offset-4 hover:underline"
          style={{ animationDelay: '1000ms' }}
        >
          Continuar comprando
        </Link>
      </div>
    </section>
  )
}

/** Pix gerado, esperando o cliente pagar. A pagina troca sozinha para
 *  OrderSuccess quando o webhook confirma (polling no CheckoutPage). */
export function PixWaiting({
  orderId,
  total,
  qrCode,
  qrCodeBase64,
}: {
  orderId: string
  total?: number
  qrCode: string
  qrCodeBase64: string
}) {
  const format = useCurrency()
  const { copied, copy } = useCopy()

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center py-6">
      <div className="surface-panel relative w-full overflow-hidden px-6 py-10 text-center sm:px-10">
        <div className="rise-in space-y-2">
          <p className="eyebrow">Pagamento via Pix</p>
          <h1 className="text-4xl leading-tight text-[#2a0f3d]">Falta só pagar!</h1>
          {total ? <p className="text-gradient-brand text-3xl font-extrabold">{format(total)}</p> : null}
        </div>

        {qrCodeBase64 ? (
          <div className="rise-in mx-auto mt-6 w-fit" style={{ animationDelay: '120ms' }}>
            <div className="qr-glow">
              <img
                src={`data:image/png;base64,${qrCodeBase64}`}
                alt="QR Code Pix"
                className="h-56 w-56 rounded-[26px] bg-white p-3"
              />
            </div>
          </div>
        ) : null}

        <div className="rise-in mt-6 flex flex-col items-center gap-3" style={{ animationDelay: '220ms' }}>
          <Button type="button" onClick={() => copy(qrCode)} className={copied ? 'bg-none bg-[#0f8a5f]' : ''}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Código copiado!' : 'Copiar código Pix'}
          </Button>
          <p className="inline-flex items-center gap-2 rounded-full bg-[#fff6e3] px-4 py-2 text-xs font-semibold text-[#8a5a0b]">
            <span className="live-dot" /> Aguardando pagamento · esta tela atualiza sozinha
          </p>
        </div>

        <ol className="mx-auto mt-7 grid max-w-md gap-2 text-left sm:grid-cols-3">
          {['Abra o app do seu banco', 'Escolha pagar com Pix', 'Escaneie ou cole o código'].map(
            (label, index) => (
              <li
                key={label}
                className="rise-in flex items-center gap-2 rounded-[16px] bg-white/80 px-3 py-2.5 text-xs font-semibold text-[#3a164f] sm:flex-col sm:text-center"
                style={{ animationDelay: `${320 + index * 100}ms` }}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[image:var(--grad-brand)] text-xs font-bold text-white">
                  {index + 1}
                </span>
                {label}
              </li>
            ),
          )}
        </ol>

        <p className="mt-6 text-xs text-[#9b86a8]">Pedido #{shortOrderId(orderId)}</p>
      </div>
    </section>
  )
}
