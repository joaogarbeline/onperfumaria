import {
  Banknote,
  Check,
  CreditCard,
  Minus,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Search,
  Share2,
  ShoppingCart,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../../services/api'
import type { OrganizerNode, OrganizerTag } from '../../types/organizer'
import { toWhatsappDigits } from '../../utils/checkout'
import { Button } from '../Button'
import { ConfirmDialog } from '../ConfirmDialog'
import { itemIcons } from '../item/icons'
import { bestDiscountPercent } from '../site/autoFill'

type PaymentMethod = 'dinheiro' | 'pix' | 'debito' | 'credito'

type PosProduct = {
  id: string
  name: string
  brand: string
  imageUrl: string
  price: number
  basePrice: number
  stock: number | null
  available: boolean
}

type CartLine = { product: PosProduct; quantity: number }

type Sale = {
  id: string
  customerName: string
  customerPhone: string
  paymentMethod: PaymentMethod
  paymentLabel: string
  installments: number
  subtotal: number
  discount: number
  total: number
  amountReceived: number | null
  change: number
  status: string
  createdAt: string
  items: Array<{ name: string; price: number; quantity: number; total: number }>
}

type CashDay = {
  date: string
  total: number
  count: number
  byMethod: Array<{ key: PaymentMethod; label: string; total: number }>
  sales: Array<{
    id: string
    customerName: string
    paymentLabel: string
    total: number
    status: string
    createdAt: string
    itemsCount: number
  }>
}

const PAYMENTS: Array<{ key: PaymentMethod; label: string; icon: typeof Banknote }> = [
  { key: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { key: 'pix', label: 'Pix', icon: QrCode },
  { key: 'debito', label: 'Débito', icon: Wallet },
  { key: 'credito', label: 'Crédito', icon: CreditCard },
]

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseMoney(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

/** PDV: venda presencial no balcao, pensada para o celular do vendedor. */
export function PosTerminal({
  token,
  nodes,
  tags,
}: {
  token: string | null
  nodes: OrganizerNode[]
  tags: OrganizerTag[]
}) {
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [discountText, setDiscountText] = useState('')
  const [discountMode, setDiscountMode] = useState<'value' | 'percent'>('value')
  const [payment, setPayment] = useState<PaymentMethod>('pix')
  const [installments, setInstallments] = useState(1)
  const [receivedText, setReceivedText] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<Sale | null>(null)
  const [cash, setCash] = useState<CashDay | null>(null)
  const [cancelTarget, setCancelTarget] = useState<CashDay['sales'][number] | null>(null)

  const auth = token ?? undefined

  const loadCash = useCallback(() => {
    api
      .get<CashDay>('/admin/pos/day', auth)
      .then(setCash)
      .catch(() => undefined)
  }, [auth])

  useEffect(() => {
    loadCash()
  }, [loadCash])

  // Mesmo preco que o servidor cobra: preco do item com a maior tag de desconto.
  const products = useMemo<PosProduct[]>(
    () =>
      nodes
        .filter((node) => node.type === 'item' && node.status !== 'draft')
        .map((node) => {
          const discount = bestDiscountPercent(node, tags)
          const stock = typeof node.stock === 'number' ? node.stock : null
          return {
            id: node.id,
            name: node.name,
            brand: node.brand ?? '',
            imageUrl: node.imageUrl,
            basePrice: node.price,
            price: round(node.price * (1 - discount / 100)),
            stock,
            available:
              (node.status === 'published' || node.status === 'low-stock') && (stock === null || stock > 0),
          }
        })
        .sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name, 'pt-BR')),
    [nodes, tags],
  )

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR')
    if (!term) return products
    return products.filter((product) =>
      `${product.name} ${product.brand}`.toLocaleLowerCase('pt-BR').includes(term),
    )
  }, [products, query])

  const quantityOf = (id: string) => cart.find((line) => line.product.id === id)?.quantity ?? 0

  const add = (product: PosProduct) => {
    if (!product.available) return
    setCart((current) => {
      const line = current.find((item) => item.product.id === product.id)
      if (line) {
        if (product.stock !== null && line.quantity >= product.stock) return current
        return current.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }
      return [...current, { product, quantity: 1 }]
    })
  }

  const changeQuantity = (id: string, delta: number) =>
    setCart((current) =>
      current
        .map((item) => {
          if (item.product.id !== id) return item
          const max = item.product.stock ?? Infinity
          return { ...item, quantity: Math.min(max, item.quantity + delta) }
        })
        .filter((item) => item.quantity > 0),
    )

  const subtotal = round(cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0))
  const discountInput = parseMoney(discountText)
  const discount = Math.min(
    subtotal,
    round(discountMode === 'percent' ? (subtotal * Math.min(discountInput, 100)) / 100 : discountInput),
  )
  const total = round(subtotal - discount)
  const received = parseMoney(receivedText)
  const change = payment === 'dinheiro' && received > total ? round(received - total) : 0
  const itemsCount = cart.reduce((sum, line) => sum + line.quantity, 0)
  const cashShort = payment === 'dinheiro' && receivedText.trim() !== '' && received < total

  const reset = () => {
    setCart([])
    setDiscountText('')
    setReceivedText('')
    setCustomerName('')
    setCustomerPhone('')
    setInstallments(1)
    setError('')
  }

  async function finish() {
    setSaving(true)
    setError('')
    try {
      const sale = await api.post<Sale>(
        '/admin/pos/sales',
        {
          items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
          discount,
          paymentMethod: payment,
          installments: payment === 'credito' ? installments : 1,
          amountReceived: payment === 'dinheiro' ? received || total : 0,
          customerName,
          customerPhone,
        },
        auth,
      )
      setReceipt(sale)
      setCartOpen(false)
      reset()
      loadCash()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar a venda.')
    } finally {
      setSaving(false)
    }
  }

  async function cancelSale(id: string) {
    try {
      await api.post(`/admin/pos/sales/${id}/cancel`, {}, auth)
      loadCash()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cancelar a venda.')
    }
  }

  const checkout = (
    <div className="space-y-4">
      {cart.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[22px] border border-dashed border-[#ddc7ea] px-4 py-8 text-center">
          <ShoppingCart size={26} className="text-[#c9a4e2]" />
          <p className="text-sm text-[#6b665f]">Toque nos produtos para adicionar à venda.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {cart.map((line) => (
            <li
              key={line.product.id}
              className="rise-in flex items-center gap-3 rounded-[18px] border border-[#efe3f6] bg-white p-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#2a0f3d]">{line.product.name}</p>
                <p className="text-xs text-[#6b665f]">
                  {money(line.product.price)} · <b>{money(line.product.price * line.quantity)}</b>
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-full border border-[#ddc7ea] p-0.5">
                <button
                  type="button"
                  aria-label={`Diminuir ${line.product.name}`}
                  onClick={() => changeQuantity(line.product.id, -1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#5b247f] hover:bg-[#f3e3fb]"
                >
                  {line.quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                </button>
                <span key={line.quantity} className="badge-bump w-6 text-center text-sm font-bold">
                  {line.quantity}
                </span>
                <button
                  type="button"
                  aria-label={`Aumentar ${line.product.name}`}
                  onClick={() => changeQuantity(line.product.id, 1)}
                  disabled={line.product.stock !== null && line.quantity >= line.product.stock}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#5b247f] hover:bg-[#f3e3fb] disabled:opacity-30"
                >
                  <Plus size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <PosField label="Desconto">
          <input
            inputMode="decimal"
            value={discountText}
            onChange={(event) => setDiscountText(event.target.value)}
            placeholder={discountMode === 'percent' ? '0 %' : 'R$ 0,00'}
            className="pos-input"
          />
        </PosField>
        <div className="flex rounded-full bg-[#f6ecfc] p-1">
          {(['value', 'percent'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setDiscountMode(mode)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                discountMode === mode ? 'bg-white text-[#5b247f] shadow-sm' : 'text-[#9b86a8]'
              }`}
            >
              {mode === 'value' ? 'R$' : '%'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b665f]">Pagamento</p>
        <div className="grid grid-cols-4 gap-2">
          {PAYMENTS.map((item) => {
            const Icon = item.icon
            const active = payment === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setPayment(item.key)}
                className={`flex flex-col items-center gap-1 rounded-[18px] border px-1 py-3 text-xs font-bold transition ${
                  active
                    ? 'border-transparent bg-[image:var(--grad-brand)] text-white shadow-[var(--glow-violet)]'
                    : 'border-[#e3cfee] bg-white text-[#5b247f] hover:border-[#b98ad8]'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      {payment === 'credito' ? (
        <PosField label="Parcelas">
          <select
            value={installments}
            onChange={(event) => setInstallments(Number(event.target.value))}
            className="pos-input"
          >
            {Array.from({ length: 12 }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count}x de {money(total / count)}
              </option>
            ))}
          </select>
        </PosField>
      ) : null}

      {payment === 'dinheiro' ? (
        <div className="space-y-2">
          <PosField label="Valor recebido">
            <input
              inputMode="decimal"
              value={receivedText}
              onChange={(event) => setReceivedText(event.target.value)}
              placeholder={money(total)}
              className={`pos-input ${cashShort ? 'border-rose-300' : ''}`}
            />
          </PosField>
          <div className="flex flex-wrap gap-1.5">
            {[total, 50, 100, 200]
              .filter((value, index, list) => value > 0 && list.indexOf(value) === index && value >= total)
              .map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReceivedText(String(value).replace('.', ','))}
                  className="rounded-full bg-[#f6ecfc] px-3 py-1.5 text-xs font-bold text-[#5b247f] hover:bg-[#efdcf9]"
                >
                  {value === total ? 'Valor exato' : money(value)}
                </button>
              ))}
          </div>
          {change > 0 ? (
            <p className="rise-in flex items-center justify-between rounded-[16px] bg-[#eaf8f1] px-4 py-2.5 text-sm font-bold text-[#0f6b4b]">
              Troco <span className="text-lg">{money(change)}</span>
            </p>
          ) : null}
          {cashShort ? (
            <p className="text-xs font-semibold text-rose-600">Valor recebido menor que o total.</p>
          ) : null}
        </div>
      ) : null}

      <details className="rounded-[18px] border border-[#efe3f6] bg-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-[#5b247f]">Cliente (opcional)</summary>
        <div className="mt-3 grid gap-2">
          <input
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Nome"
            className="pos-input"
          />
          <input
            value={customerPhone}
            inputMode="tel"
            onChange={(event) => setCustomerPhone(event.target.value)}
            placeholder="WhatsApp para enviar o comprovante"
            className="pos-input"
          />
        </div>
      </details>

      <div className="space-y-1 rounded-[20px] bg-[#fbf7fd] px-4 py-3 text-sm">
        <SummaryLine
          label={`Subtotal (${itemsCount} ${itemsCount === 1 ? 'item' : 'itens'})`}
          value={money(subtotal)}
        />
        {discount > 0 ? <SummaryLine label="Desconto" value={`- ${money(discount)}`} tone="green" /> : null}
        <div className="flex items-center justify-between border-t border-[#efe3f6] pt-2">
          <span className="font-bold text-[#2a0f3d]">Total</span>
          <span key={total} className="badge-bump text-gradient-brand text-2xl font-extrabold">
            {money(total)}
          </span>
        </div>
      </div>

      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <Button size="lg" fullWidth disabled={cart.length === 0 || saving || cashShort} onClick={finish}>
        <Check size={18} /> {saving ? 'Registrando...' : `Finalizar venda · ${money(total)}`}
      </Button>
    </div>
  )

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <section className="space-y-3">
          <label className="flex h-12 items-center gap-2 rounded-full border border-[#ddc7ea] bg-white px-4 shadow-sm focus-within:border-[#9b3fd6]">
            <Search size={18} className="text-[#9b86a8]" />
            <span className="sr-only">Buscar produto</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar produto ou marca"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9b86a8]"
            />
            {query ? (
              <button type="button" aria-label="Limpar busca" onClick={() => setQuery('')}>
                <X size={16} className="text-[#9b86a8]" />
              </button>
            ) : null}
          </label>

          {filtered.length === 0 ? (
            <p className="rounded-[22px] bg-white p-6 text-center text-sm text-[#9b86a8]">
              Nenhum produto encontrado.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product) => {
                const inCart = quantityOf(product.id)
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => add(product)}
                    disabled={!product.available}
                    className={`relative flex flex-col overflow-hidden rounded-[20px] border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)] disabled:cursor-not-allowed disabled:opacity-45 ${
                      inCart ? 'border-[#9b3fd6] ring-2 ring-[#9b3fd6]/20' : 'border-[#efe3f6]'
                    }`}
                  >
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-[#f3e9f7]">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <img
                          src={itemIcons.frascoGold}
                          alt=""
                          className="h-9 w-9 object-contain opacity-60"
                        />
                      )}
                    </div>
                    {inCart ? (
                      <span
                        key={inCart}
                        className="badge-bump absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-[image:var(--grad-brand)] px-1.5 text-xs font-extrabold text-white shadow-[var(--glow-violet)]"
                      >
                        {inCart}
                      </span>
                    ) : null}
                    <div className="flex flex-1 flex-col gap-0.5 p-2.5">
                      <p className="line-clamp-2 text-xs font-semibold leading-4 text-[#2a0f3d]">
                        {product.name}
                      </p>
                      <p className="mt-auto pt-1 text-sm font-extrabold text-[#2a0f3d]">
                        {money(product.price)}
                      </p>
                      <p
                        className={`text-[10px] ${product.available ? 'text-[#9b86a8]' : 'font-bold text-rose-600'}`}
                      >
                        {!product.available
                          ? 'Indisponível'
                          : product.stock === null
                            ? 'Sem controle de estoque'
                            : `${product.stock} em estoque`}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <aside className="organizer-surface hidden self-start bg-white p-4 lg:sticky lg:top-0 lg:block">
          <h3 className="mb-3 flex items-center gap-2 text-2xl text-[#2a0f3d]">
            <Receipt size={20} className="text-[#9b3fd6]" /> Venda atual
          </h3>
          {checkout}
        </aside>
      </div>

      <CashSummary cash={cash} onCancel={setCancelTarget} />

      {/* Celular: barra fixa com o total que abre o carrinho em tela cheia. */}
      <div className="fixed inset-x-0 bottom-16 z-[61] border-t border-[#efe3f6] bg-white/95 p-3 backdrop-blur lg:hidden">
        <Button size="lg" fullWidth disabled={cart.length === 0} onClick={() => setCartOpen(true)}>
          <ShoppingCart size={18} />
          {cart.length === 0
            ? 'Nenhum item na venda'
            : `Cobrar ${money(total)} · ${itemsCount} ${itemsCount === 1 ? 'item' : 'itens'}`}
        </Button>
      </div>

      {cartOpen ? (
        <div
          className="fixed inset-0 z-[62] flex flex-col bg-[var(--color-organizer-bg)] lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between border-b border-[#efe3f6] bg-white px-4 py-3">
            <h3 className="text-2xl text-[#2a0f3d]">Venda atual</h3>
            <button
              type="button"
              aria-label="Voltar aos produtos"
              onClick={() => setCartOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f6ecfc] text-[#5b247f]"
            >
              <X size={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{checkout}</div>
        </div>
      ) : null}

      {receipt ? <ReceiptDialog sale={receipt} onClose={() => setReceipt(null)} /> : null}

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancelar esta venda?"
        confirmLabel="Cancelar venda"
        cancelLabel="Voltar"
        onConfirm={() => {
          if (cancelTarget) cancelSale(cancelTarget.id)
          setCancelTarget(null)
        }}
        onCancel={() => setCancelTarget(null)}
      >
        A venda de <b>{cancelTarget ? money(cancelTarget.total) : ''}</b> sai do caixa e os produtos voltam ao
        estoque.
      </ConfirmDialog>
    </div>
  )
}

function PosField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b665f]">
        {label}
      </span>
      {children}
    </label>
  )
}

function SummaryLine({ label, value, tone }: { label: string; value: string; tone?: 'green' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#6b665f]">{label}</span>
      <span className={`font-semibold ${tone === 'green' ? 'text-[#0f8a5f]' : 'text-[#2a0f3d]'}`}>
        {value}
      </span>
    </div>
  )
}

function CashSummary({
  cash,
  onCancel,
}: {
  cash: CashDay | null
  onCancel: (sale: CashDay['sales'][number]) => void
}) {
  return (
    <section className="organizer-surface overflow-hidden bg-white">
      <div className="flex flex-wrap items-end justify-between gap-2 p-4 sm:p-5">
        <div>
          <p className="organizer-eyebrow">Caixa de hoje</p>
          <p className="text-gradient-brand text-3xl font-extrabold">{cash ? money(cash.total) : '...'}</p>
          <p className="text-xs text-[#9b86a8]">{cash ? `${cash.count} venda(s) no balcão` : ''}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-4 sm:px-5">
        {(cash?.byMethod ?? []).map((method) => (
          <div key={method.key} className="rounded-[16px] bg-[#fbf7fd] px-3 py-2.5">
            <p className="text-[11px] font-semibold text-[#9b86a8]">{method.label}</p>
            <p className="text-sm font-extrabold text-[#2a0f3d]">{money(method.total)}</p>
          </div>
        ))}
      </div>
      {cash && cash.sales.length > 0 ? (
        <ul className="divide-y divide-[#f3e9f7] border-t border-[#f3e9f7]">
          {cash.sales.map((sale) => {
            const cancelled = sale.status === 'cancelada'
            return (
              <li key={sale.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-semibold ${cancelled ? 'text-[#9b86a8] line-through' : 'text-[#2a0f3d]'}`}
                  >
                    {sale.customerName}
                  </p>
                  <p className="text-xs text-[#6b665f]">
                    {new Date(sale.createdAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {sale.paymentLabel} · {sale.itemsCount} item(ns)
                  </p>
                </div>
                <span
                  className={`text-sm font-extrabold ${cancelled ? 'text-[#9b86a8] line-through' : 'text-[#2a0f3d]'}`}
                >
                  {money(sale.total)}
                </span>
                {cancelled ? (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                    Cancelada
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCancel(sale)}
                    aria-label="Cancelar venda"
                    className="rounded-full p-2 text-[#9b86a8] hover:bg-rose-50 hover:text-rose-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}

function receiptText(sale: Sale) {
  const lines = [
    '*On Perfumaria e Importados*',
    `Comprovante #${sale.id.slice(0, 8).toUpperCase()}`,
    new Date(sale.createdAt).toLocaleString('pt-BR'),
    '',
    ...sale.items.map((item) => `${item.quantity}x ${item.name} — ${money(item.total)}`),
    '',
    sale.discount > 0 ? `Desconto: -${money(sale.discount)}` : '',
    `*Total: ${money(sale.total)}*`,
    `Pagamento: ${sale.paymentLabel}${sale.installments > 1 ? ` em ${sale.installments}x` : ''}`,
    sale.change > 0 ? `Troco: ${money(sale.change)}` : '',
    '',
    'Obrigado pela preferência! 💜',
  ]
  return lines.filter((line, index, all) => line !== '' || all[index - 1] !== '').join('\n')
}

function ReceiptDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const phone = toWhatsappDigits(sale.customerPhone)
  const text = receiptText(sale)

  const share = () => {
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank')
      return
    }
    if (navigator.share) {
      navigator.share({ text }).catch(() => undefined)
      return
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="pos-receipt rise-in max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-6 sm:rounded-[28px]">
        <div className="text-center">
          <span className="success-badge mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[image:var(--grad-brand)] text-white shadow-[var(--glow-violet)]">
            <Check size={30} strokeWidth={3} />
          </span>
          <h3 className="mt-3 text-3xl text-[#2a0f3d]">Venda registrada!</h3>
          <p className="text-xs text-[#9b86a8]">
            #{sale.id.slice(0, 8).toUpperCase()} · {new Date(sale.createdAt).toLocaleString('pt-BR')}
          </p>
        </div>
        <ul className="mt-5 space-y-1.5 border-y border-dashed border-[#e3cfee] py-3 text-sm">
          {sale.items.map((item) => (
            <li key={item.name} className="flex justify-between gap-3">
              <span className="text-[#2a0f3d]">
                {item.quantity}× {item.name}
              </span>
              <span className="shrink-0 text-[#6b665f]">{money(item.total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 text-sm">
          {sale.discount > 0 ? (
            <SummaryLine label="Desconto" value={`- ${money(sale.discount)}`} tone="green" />
          ) : null}
          <SummaryLine
            label="Pagamento"
            value={`${sale.paymentLabel}${sale.installments > 1 ? ` · ${sale.installments}x` : ''}`}
          />
          {sale.amountReceived ? <SummaryLine label="Recebido" value={money(sale.amountReceived)} /> : null}
          {sale.change > 0 ? <SummaryLine label="Troco" value={money(sale.change)} tone="green" /> : null}
          <div className="flex items-center justify-between pt-1">
            <span className="font-bold text-[#2a0f3d]">Total</span>
            <span className="text-gradient-brand text-2xl font-extrabold">{money(sale.total)}</span>
          </div>
        </div>
        <div className="pos-receipt-actions mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={share}>
            <Share2 size={16} /> {phone ? 'WhatsApp' : 'Compartilhar'}
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir
          </Button>
          <Button className="col-span-2" size="lg" onClick={onClose}>
            <Plus size={16} /> Nova venda
          </Button>
        </div>
      </div>
    </div>
  )
}
