import {
  BarChart3,
  BellRing,
  LayoutDashboard,
  ChevronDown,
  Clock,
  MapPin,
  MessageCircle,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Truck,
  Users,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../../services/api'
import { toWhatsappDigits } from '../../utils/checkout'
import { getOrderStatusPresentation } from '../../utils/orders'
import { disablePush, enablePush, getPushState, sendTestPush, type PushState } from '../../utils/push'
import { Button } from '../Button'
import { SalesReports } from './SalesReports'

type Dashboard = {
  today: { revenue: number; orders: number }
  month: { revenue: number; orders: number; averageTicket: number }
  awaitingPayment: number
  toShip: number
  shipped: number
  lastDays: Array<{ date: string; revenue: number; orders: number }>
  topProducts: Array<{ name: string; imageUrl: string; quantity: number; revenue: number }>
  customers: { total: number; newThisMonth: number }
}

type OrderRow = {
  id: string
  customerName: string
  total: number
  paymentStatus: string
  orderStatus: string
  createdAt: string
  origin: string
  paymentMethod: string
  deliveryMode: string
  itemsCount: number
}

type OrderDetail = {
  id: string
  customerName: string
  customerPhone: string
  total: number
  deliveryMode: string
  items: Array<{ name: string; price: number; quantity: number; imageUrl?: string }>
  address: { street: string; number: string; neighborhood: string; city: string; state: string; cep: string }
}

type View = 'overview' | 'orders' | 'reports'

const VIEWS: Array<{ key: View; label: string; icon: typeof ShoppingBag }> = [
  { key: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { key: 'orders', label: 'Pedidos', icon: ShoppingBag },
  { key: 'reports', label: 'Relatórios', icon: BarChart3 },
]

type TabKey = 'pago' | 'aguardando_pagamento' | 'enviado' | 'entregue' | 'todos'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'pago', label: 'A enviar' },
  { key: 'aguardando_pagamento', label: 'Aguardando pagamento' },
  { key: 'enviado', label: 'Enviados' },
  { key: 'entregue', label: 'Entregues' },
  { key: 'todos', label: 'Todos' },
]

const NEXT_STATUS: Record<string, { status: string; label: string; icon: typeof Truck }> = {
  pago: { status: 'enviado', label: 'Marcar como enviado', icon: Truck },
  enviado: { status: 'entregue', label: 'Marcar como entregue', icon: Package },
}

const PAGE_SIZE = 20

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase()
}

function orderDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function paymentLabel(order: OrderRow) {
  if (order.origin === 'pdv') return 'Balcão'
  if (order.paymentMethod === 'pix') return 'Pix'
  return order.paymentMethod ? `Cartão ${order.paymentMethod}` : 'Online'
}

function deliveryLabel(mode: string) {
  if (mode === 'pickup') return 'Retirada na loja'
  if (mode === 'correios') return 'Correios'
  if (mode === 'local') return 'Entrega local'
  return mode ? 'Entrega' : ''
}

/** Painel de vendas do admin: resumo, grafico, mais vendidos e pedidos. */
export function SalesDashboard({
  token,
  onClose,
  initialOrderId,
}: {
  token: string | null
  onClose: () => void
  initialOrderId?: string | null
}) {
  const [view, setView] = useState<View>(initialOrderId ? 'orders' : 'overview')
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [tab, setTab] = useState<TabKey>('pago')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [totalOrders, setTotalOrders] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(initialOrderId ?? null)
  const [refreshTick, setRefreshTick] = useState(0)

  const auth = token ?? undefined

  useEffect(() => {
    api
      .get<Dashboard>('/admin/dashboard', auth)
      .then((data) => {
        setDashboard(data)
        // Sem nada a enviar, abre direto em "Todos" (senao a lista nasce vazia).
        if (refreshTick === 0 && data.toShip === 0 && !initialOrderId) setTab('todos')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar o painel'))
  }, [auth, refreshTick, initialOrderId])

  // Busca so depois de uma pausa na digitacao.
  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(search.trim()), 350)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (tab !== 'todos') params.set('status', tab)
    if (query) params.set('search', query)
    api
      .get<{ orders: OrderRow[]; total: number }>(`/orders?${params}`, auth)
      .then((data) => {
        if (cancelled) return
        setOrders((current) => (page === 1 ? data.orders : [...current, ...data.orders]))
        setTotalOrders(data.total)
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Erro ao carregar pedidos'))
      .finally(() => !cancelled && setLoadingOrders(false))
    return () => {
      cancelled = true
    }
  }, [auth, tab, query, page, refreshTick])

  const changeTab = (next: TabKey) => {
    setTab(next)
    setPage(1)
    setLoadingOrders(true)
  }

  const refresh = () => {
    setPage(1)
    setLoadingOrders(true)
    setRefreshTick((tick) => tick + 1)
  }

  const handleStatusChanged = (orderId: string, orderStatus: string) => {
    setOrders((current) =>
      tab === 'todos'
        ? current.map((order) => (order.id === orderId ? { ...order, orderStatus } : order))
        : current.filter((order) => order.id !== orderId),
    )
    api
      .get<Dashboard>('/admin/dashboard', auth)
      .then(setDashboard)
      .catch(() => undefined)
  }

  // Fecha com Esc e trava a rolagem da pagina por baixo.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.classList.add('drawer-open')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('drawer-open')
    }
  }, [onClose])

  const tabCounts: Partial<Record<TabKey, number>> = dashboard
    ? { pago: dashboard.toShip, aguardando_pagamento: dashboard.awaitingPayment, enviado: dashboard.shipped }
    : {}

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pedidos e vendas"
      className="fixed inset-0 z-[60] flex flex-col bg-[var(--color-organizer-bg)]"
    >
      <header className="bg-brand-live flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-white shadow-[var(--shadow-organizer)] sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
            <ShoppingBag size={20} className="text-[#ffd27a]" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#ffd27a]">Admin</p>
            <h2 className="text-xl font-semibold leading-tight text-white">Painel de vendas</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            aria-label="Atualizar"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <RefreshCw size={18} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      <nav
        aria-label="Seções do painel"
        className="flex shrink-0 justify-center gap-1 border-b border-[#efe3f6] bg-white px-2 py-2 sm:gap-2"
      >
        {VIEWS.map((item) => {
          const Icon = item.icon
          const active = view === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setView(item.key)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition sm:px-5 sm:text-sm ${
                active
                  ? 'bg-[image:var(--grad-brand)] text-white shadow-[var(--glow-violet)]'
                  : 'text-[#5b247f] hover:bg-[#f6ecfc]'
              }`}
            >
              <Icon size={15} />
              {item.label}
              {item.key === 'orders' && dashboard?.toShip ? (
                <span
                  className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/25' : 'bg-[#fff1d6] text-[#8a5a0b]'}`}
                >
                  {dashboard.toShip}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6">
          {error ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {view === 'reports' ? <SalesReports token={token} /> : null}

          {view === 'overview' ? (
            <>
              <PushCard token={token} />

              <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi
                  icon={<TrendingUp size={18} />}
                  label="Vendas hoje"
                  value={dashboard ? money(dashboard.today.revenue) : null}
                  detail={dashboard ? `${dashboard.today.orders} pedido(s)` : ''}
                  highlight
                />
                <Kpi
                  icon={<ShoppingBag size={18} />}
                  label="Vendas no mês"
                  value={dashboard ? money(dashboard.month.revenue) : null}
                  detail={dashboard ? `${dashboard.month.orders} pedido(s)` : ''}
                />
                <Kpi
                  icon={<Package size={18} />}
                  label="Ticket médio"
                  value={dashboard ? money(dashboard.month.averageTicket) : null}
                  detail="no mês"
                />
                <Kpi
                  icon={<Users size={18} />}
                  label="Clientes"
                  value={dashboard ? String(dashboard.customers.total) : null}
                  detail={dashboard ? `+${dashboard.customers.newThisMonth} este mês` : ''}
                />
              </section>

              <section className="grid gap-3 sm:grid-cols-3">
                <AlertCard
                  icon={<Truck size={18} />}
                  label="A enviar"
                  value={dashboard?.toShip}
                  tone="gold"
                  onClick={() => {
                    changeTab('pago')
                    setView('orders')
                  }}
                />
                <AlertCard
                  icon={<Clock size={18} />}
                  label="Aguardando pagamento"
                  value={dashboard?.awaitingPayment}
                  tone="violet"
                  onClick={() => {
                    changeTab('aguardando_pagamento')
                    setView('orders')
                  }}
                />
                <AlertCard
                  icon={<Package size={18} />}
                  label="Em trânsito"
                  value={dashboard?.shipped}
                  tone="green"
                  onClick={() => {
                    changeTab('enviado')
                    setView('orders')
                  }}
                />
              </section>

              <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <div className="organizer-surface bg-white p-4 sm:p-5">
                  <p className="organizer-eyebrow">Últimos 7 dias</p>
                  <WeekChart days={dashboard?.lastDays ?? []} />
                </div>
                <div className="organizer-surface bg-white p-4 sm:p-5">
                  <p className="organizer-eyebrow">Mais vendidos no mês</p>
                  <TopProducts products={dashboard?.topProducts} />
                </div>
              </section>
            </>
          ) : null}

          {view === 'orders' ? (
            <section className="organizer-surface overflow-hidden bg-white">
              <div className="flex flex-col gap-3 border-b border-[#efe3f6] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <h3 className="text-2xl text-[#2a0f3d]">Pedidos</h3>
                <label className="flex h-10 items-center gap-2 rounded-full border border-[#ddc7ea] bg-[#fbf7fd] px-4 focus-within:border-[#9b3fd6] sm:w-72">
                  <Search size={16} className="text-[#9b86a8]" />
                  <span className="sr-only">Buscar pedido</span>
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                      setPage(1)
                    }}
                    placeholder="Cliente ou nº do pedido"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9b86a8]"
                  />
                </label>
              </div>

              <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-[#efe3f6] px-4 py-3 sm:px-5">
                {TABS.map((item) => {
                  const active = tab === item.key
                  const count = tabCounts[item.key]
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => changeTab(item.key)}
                      className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                        active
                          ? 'bg-[image:var(--grad-brand)] text-white shadow-[var(--glow-violet)]'
                          : 'bg-[#f6ecfc] text-[#5b247f] hover:bg-[#efdcf9]'
                      }`}
                    >
                      {item.label}
                      {count ? (
                        <span
                          className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/25' : 'bg-white text-[#6a2a94]'}`}
                        >
                          {count}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>

              <ul className="divide-y divide-[#f3e9f7]">
                {orders.map((order) => (
                  <OrderItem
                    key={order.id}
                    order={order}
                    token={token}
                    expanded={expandedId === order.id}
                    onToggle={() => setExpandedId((current) => (current === order.id ? null : order.id))}
                    onStatusChanged={handleStatusChanged}
                  />
                ))}
              </ul>

              {loadingOrders && orders.length === 0 ? (
                <p className="p-6 text-center text-sm text-[#9b86a8]">Carregando pedidos...</p>
              ) : null}
              {!loadingOrders && orders.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-10 text-center">
                  <Package size={32} className="text-[#d6b3ec]" />
                  <p className="text-sm font-semibold text-[#3a164f]">Nenhum pedido aqui</p>
                  <p className="text-xs text-[#9b86a8]">Quando chegar, ele aparece nesta lista.</p>
                </div>
              ) : null}
              {orders.length < totalOrders ? (
                <div className="p-4 text-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={loadingOrders}
                    onClick={() => {
                      setLoadingOrders(true)
                      setPage((current) => current + 1)
                    }}
                  >
                    {loadingOrders ? 'Carregando...' : `Ver mais (${totalOrders - orders.length})`}
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Kpi({
  icon,
  label,
  value,
  detail,
  highlight = false,
}: {
  icon: ReactNode
  label: string
  value: string | null
  detail: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rise-in rounded-[22px] p-4 shadow-[var(--shadow-float)] ${
        highlight ? 'bg-brand-live text-white' : 'border border-[#efe3f6] bg-white text-[#2a0f3d]'
      }`}
    >
      <div
        className={`flex items-center gap-2 text-xs font-semibold ${highlight ? 'text-[#ffd27a]' : 'text-[#9b3fd6]'}`}
      >
        {icon}
        {label}
      </div>
      {value === null ? (
        <div className="skeleton-wave mt-3 h-7 w-24 rounded-lg" />
      ) : (
        <p key={value} className="badge-bump mt-2 text-xl font-extrabold sm:text-2xl">
          {value}
        </p>
      )}
      <p className={`mt-1 text-[11px] ${highlight ? 'text-white/75' : 'text-[#9b86a8]'}`}>{detail}</p>
    </div>
  )
}

function AlertCard({
  icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: ReactNode
  label: string
  value: number | undefined
  tone: 'gold' | 'violet' | 'green'
  onClick: () => void
}) {
  const tones = {
    gold: 'bg-[#fff6e3] text-[#8a5a0b] ring-[#f6dfa8]',
    violet: 'bg-[#f6ecfc] text-[#5b247f] ring-[#e3cfee]',
    green: 'bg-[#eaf8f1] text-[#0f6b4b] ring-[#c4ebd8]',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-3 rounded-[20px] px-4 py-3 text-left ring-1 ring-inset transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)] ${tones[tone]}`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </span>
      <span className="text-2xl font-extrabold">{value ?? '–'}</span>
    </button>
  )
}

function WeekChart({ days }: { days: Dashboard['lastDays'] }) {
  const max = Math.max(...days.map((day) => day.revenue), 1)
  if (days.length === 0) return <div className="skeleton-wave mt-4 h-40 rounded-2xl" />
  return (
    <div className="mt-4 flex h-44 items-end gap-2">
      {days.map((day, index) => {
        const height = Math.max((day.revenue / max) * 100, day.revenue > 0 ? 6 : 2)
        const weekday = new Date(`${day.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' })
        const isToday = index === days.length - 1
        return (
          <div key={day.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-[10px] font-semibold text-[#6a2a94] opacity-0 transition group-hover:opacity-100">
              {day.revenue > 0 ? money(day.revenue) : ''}
            </span>
            <div
              className={`rise-in w-full max-w-10 rounded-t-xl ${
                isToday ? 'bg-[image:var(--grad-gold)]' : 'bg-[image:var(--grad-brand)]'
              }`}
              style={{ height: `${height}%`, animationDelay: `${index * 60}ms` }}
              title={`${money(day.revenue)} · ${day.orders} pedido(s)`}
            />
            <span
              className={`text-[10px] uppercase ${isToday ? 'font-bold text-[#b77717]' : 'text-[#9b86a8]'}`}
            >
              {isToday ? 'hoje' : weekday.replace('.', '')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function TopProducts({ products }: { products: Dashboard['topProducts'] | undefined }) {
  if (!products) return <div className="skeleton-wave mt-4 h-40 rounded-2xl" />
  if (products.length === 0) {
    return <p className="mt-4 text-sm text-[#9b86a8]">Nenhuma venda paga este mês ainda.</p>
  }
  const max = Math.max(...products.map((product) => product.quantity), 1)
  return (
    <ol className="mt-4 space-y-3">
      {products.map((product, index) => (
        <li key={product.name} className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f6ecfc] text-xs font-bold text-[#6a2a94]">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-semibold text-[#2a0f3d]">{product.name}</p>
              <p className="shrink-0 text-xs text-[#6b665f]">{product.quantity} un.</p>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f3e9f7]">
              <div
                className="h-full rounded-full bg-[image:var(--grad-brand)]"
                style={{ width: `${(product.quantity / max) * 100}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

function OrderItem({
  order,
  token,
  expanded,
  onToggle,
  onStatusChanged,
}: {
  order: OrderRow
  token: string | null
  expanded: boolean
  onToggle: () => void
  onStatusChanged: (orderId: string, orderStatus: string) => void
}) {
  const presentation = getOrderStatusPresentation(order)
  const next = order.origin === 'pdv' ? undefined : NEXT_STATUS[order.orderStatus]
  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  // Os detalhes (itens, endereco, telefone) so carregam ao abrir o pedido.
  // A mesma rota marca a notificacao como lida no sino do admin.
  useEffect(() => {
    if (!expanded || detail || order.origin === 'pdv') return
    api
      .post<OrderDetail>(`/admin/notifications/${order.id}/read`, {}, token ?? undefined)
      .then(setDetail)
      .catch(() => setNotice('Não foi possível carregar os detalhes.'))
  }, [expanded, detail, order.id, order.origin, token])

  async function advance() {
    if (!next) return
    setSaving(true)
    setNotice('')
    try {
      await api.put(`/orders/${order.id}/status`, { status: next.status }, token ?? undefined)
      onStatusChanged(order.id, next.status)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Não foi possível atualizar o pedido.')
    } finally {
      setSaving(false)
    }
  }

  const whatsapp = detail?.customerPhone ? toWhatsappDigits(detail.customerPhone) : ''
  const NextIcon = next?.icon

  return (
    <li className={expanded ? 'bg-[#fcf8fe]' : ''}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[#fbf5fe] sm:px-5"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f6ecfc] text-[#6a2a94]">
          <ShoppingBag size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-semibold text-[#2a0f3d]">{order.customerName}</span>
            <span className="shrink-0 text-sm font-extrabold text-[#2a0f3d]">{money(order.total)}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-[#6b665f]">
            #{shortId(order.id)} · {orderDate(order.createdAt)} · {paymentLabel(order)}
            {order.itemsCount ? ` · ${order.itemsCount} item(ns)` : ''}
            {deliveryLabel(order.deliveryMode) ? ` · ${deliveryLabel(order.deliveryMode)}` : ''}
          </span>
          <span
            className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ring-inset ${presentation.className}`}
          >
            {presentation.label}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#9b86a8] transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded ? (
        <div className="rise-in space-y-3 px-4 pb-4 sm:px-5">
          {order.origin === 'pdv' ? (
            <p className="text-xs text-[#6b665f]">Venda de balcão registrada na loja.</p>
          ) : !detail ? (
            notice ? null : (
              <div className="skeleton-wave h-24 rounded-2xl" />
            )
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#efe3f6] bg-white p-3">
                <p className="organizer-eyebrow mb-2">Itens</p>
                <ul className="space-y-1.5">
                  {detail.items.map((item) => (
                    <li key={item.name} className="flex justify-between gap-3 text-sm">
                      <span className="text-[#2a0f3d]">
                        {item.quantity}× {item.name}
                      </span>
                      <span className="shrink-0 text-[#6b665f]">{money(item.price * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-[#efe3f6] bg-white p-3">
                <p className="organizer-eyebrow mb-2">Entrega</p>
                {detail.deliveryMode === 'pickup' ? (
                  <p className="text-sm text-[#2a0f3d]">Cliente vai retirar na loja.</p>
                ) : (
                  <p className="flex gap-2 text-sm text-[#2a0f3d]">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-[#9b3fd6]" />
                    <span>
                      {detail.address.street}
                      {detail.address.number ? `, ${detail.address.number}` : ''}
                      {detail.address.neighborhood ? ` - ${detail.address.neighborhood}` : ''}
                      <br />
                      {detail.address.city}
                      {detail.address.state ? ` - ${detail.address.state}` : ''}
                      {detail.address.cep ? ` · CEP ${detail.address.cep}` : ''}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {next && NextIcon ? (
              <Button size="sm" disabled={saving} onClick={advance}>
                <NextIcon size={15} />
                {saving ? 'Salvando...' : next.label}
              </Button>
            ) : null}
            {whatsapp ? (
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="secondary">
                  <MessageCircle size={15} /> WhatsApp do cliente
                </Button>
              </a>
            ) : null}
          </div>
          {notice ? <p className="text-xs font-medium text-[#a0382f]">{notice}</p> : null}
        </div>
      ) : null}
    </li>
  )
}

const PUSH_COPY: Record<PushState, { title: string; detail: string }> = {
  on: {
    title: 'Notificações de venda ativadas',
    detail: 'Este aparelho recebe um aviso a cada venda paga.',
  },
  off: {
    title: 'Receba um aviso a cada venda',
    detail: 'Ative para ser avisado neste aparelho assim que um pedido for pago.',
  },
  denied: {
    title: 'Notificações bloqueadas',
    detail: 'Libere as notificações deste site nas configurações do navegador e tente de novo.',
  },
  'needs-install': {
    title: 'Instale o app para receber avisos',
    detail:
      'No iPhone/iPad: toque em Compartilhar e depois em "Adicionar à Tela de Início". Abra o app pelo ícone e ative aqui.',
  },
  unsupported: {
    title: 'Notificações indisponíveis neste navegador',
    detail: 'Use o Chrome no Android ou o app instalado no iPhone (iOS 16.4 ou mais novo).',
  },
}

function PushCard({ token }: { token: string | null }) {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    getPushState()
      .then(setState)
      .catch(() => setState('unsupported'))
  }, [])

  const run = useCallback(async (action: () => Promise<PushState>) => {
    setBusy(true)
    setMessage('')
    try {
      setState(await action())
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível concluir.')
    } finally {
      setBusy(false)
    }
  }, [])

  const copy = useMemo(() => (state ? PUSH_COPY[state] : null), [state])
  if (!state || !copy || !token) return null

  return (
    <section
      className={`rise-in flex flex-col gap-3 rounded-[22px] p-4 sm:flex-row sm:items-center sm:justify-between ${
        state === 'on' ? 'border border-[#c4ebd8] bg-[#eaf8f1]' : 'border border-[#f6dfa8] bg-[#fff6e3]'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            state === 'on' ? 'bg-[#0f8a5f] text-white' : 'bg-[image:var(--grad-gold)] text-[#3a164f]'
          }`}
        >
          {state === 'needs-install' ? <Smartphone size={18} /> : <BellRing size={18} />}
        </span>
        <div>
          <p className="text-sm font-bold text-[#2a0f3d]">{copy.title}</p>
          <p className="text-xs leading-5 text-[#6b665f]">{copy.detail}</p>
          {message ? <p className="mt-1 text-xs font-semibold text-[#a0382f]">{message}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {state === 'off' ? (
          <Button size="sm" disabled={busy} onClick={() => run(() => enablePush(token))}>
            <BellRing size={15} /> {busy ? 'Ativando...' : 'Ativar notificações'}
          </Button>
        ) : null}
        {state === 'on' ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const { sent } = await sendTestPush(token)
                  setMessage(sent ? '' : 'Nenhum aparelho recebeu o teste. Desative e ative de novo.')
                  return 'on'
                })
              }
            >
              Enviar teste
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => disablePush(token))}>
              Desativar
            </Button>
          </>
        ) : null}
      </div>
    </section>
  )
}
