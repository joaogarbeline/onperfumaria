import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Package,
  Percent,
  ShoppingBag,
  TrendingUp,
  Truck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../../services/api'
import { Button } from '../Button'

type Period = 'week' | 'month' | 'year' | 'custom'

type Summary = {
  revenue: number
  orders: number
  averageTicket: number
  items: number
  discount: number
  shipping: number
  customers: number
  newCustomers: number
  cancelled: number
  pending: number
}

type Breakdown = Array<{ key: string; revenue: number; orders: number }>

type Report = {
  period: Period
  from: string
  to: string
  previous: { from: string; to: string }
  summary: Summary
  previousSummary: Summary
  series: Breakdown
  byPayment: Breakdown
  byDelivery: Breakdown
  topProducts: Array<{ name: string; quantity: number; revenue: number }>
  topCustomers: Array<{ id: string; name: string; orders: number; revenue: number }>
}

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'year', label: 'Ano' },
  { key: 'custom', label: 'Personalizado' },
]

const PAYMENT_LABELS: Record<string, string> = { pix: 'Pix', cartao: 'Cartão de crédito', outros: 'Outros' }
const DELIVERY_LABELS: Record<string, string> = {
  pickup: 'Retirada na loja',
  local: 'Entrega local',
  correios: 'Correios',
  fixed: 'Frete fixo',
  manual: 'A combinar',
  outros: 'Outros',
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function toISO(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function fromISO(value: string) {
  return new Date(`${value}T12:00:00`)
}

function shiftDay(value: string, days: number) {
  const date = fromISO(value)
  date.setDate(date.getDate() + days)
  return toISO(date)
}

function periodTitle(report: Pick<Report, 'period' | 'from' | 'to'>) {
  const from = fromISO(report.from)
  const to = fromISO(report.to)
  if (report.period === 'year') return String(from.getFullYear())
  if (report.period === 'month') {
    const label = from.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }
  const short = (date: Date) => date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return `${short(from)} a ${short(to)}/${to.getFullYear()}`
}

function delta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? null : 0
  return ((current - previous) / previous) * 100
}

/** Relatorios de venda do admin: semana, mes, ano ou periodo livre. */
export function SalesReports({ token }: { token: string | null }) {
  const today = toISO(new Date())
  const [period, setPeriod] = useState<Period>('month')
  const [reference, setReference] = useState(today)
  const [customFrom, setCustomFrom] = useState(shiftDay(today, -29))
  const [customTo, setCustomTo] = useState(today)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  const query =
    period === 'custom'
      ? `period=custom&from=${customFrom}&to=${customTo}`
      : `period=${period}&date=${reference}`

  useEffect(() => {
    let cancelled = false
    api
      .get<Report>(`/admin/reports?${query}`, token ?? undefined)
      .then((data) => {
        if (cancelled) return
        setReport(data)
        setError('')
      })
      .catch(
        (err) => !cancelled && setError(err instanceof Error ? err.message : 'Erro ao gerar o relatório'),
      )
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [query, token])

  const choosePeriod = (next: Period) => {
    setPeriod(next)
    setReference(today)
    setLoading(true)
  }

  const step = (direction: -1 | 1) => {
    if (!report) return
    setLoading(true)
    setReference(direction < 0 ? shiftDay(report.from, -1) : shiftDay(report.to, 1))
  }

  async function downloadSheet() {
    setDownloading(true)
    try {
      const blob = await api.download(`/admin/reports/export?${query}`, token ?? undefined)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = report ? `relatorio-${report.from}-a-${report.to}.csv` : 'relatorio.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao baixar a planilha')
    } finally {
      setDownloading(false)
    }
  }

  const summary = report?.summary
  const previous = report?.previousSummary
  const canGoForward = report ? report.to < today : false

  return (
    <div className="space-y-5">
      <section className="organizer-surface space-y-4 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-[#f6ecfc] p-1">
            {PERIODS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => choosePeriod(item.key)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
                  period === item.key
                    ? 'bg-[image:var(--grad-brand)] text-white shadow-[var(--glow-violet)]'
                    : 'text-[#5b247f] hover:bg-white/70'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="secondary" disabled={downloading || !report} onClick={downloadSheet}>
            <Download size={15} /> {downloading ? 'Gerando...' : 'Baixar planilha (Excel)'}
          </Button>
        </div>

        {period === 'custom' ? (
          <div className="flex flex-wrap items-end gap-3">
            <DateInput
              label="De"
              value={customFrom}
              max={customTo}
              onChange={(value) => {
                setCustomFrom(value)
                setLoading(true)
              }}
            />
            <DateInput
              label="Até"
              value={customTo}
              min={customFrom}
              onChange={(value) => {
                setCustomTo(value)
                setLoading(true)
              }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Período anterior"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e3cfee] text-[#6a2a94] transition hover:bg-[#f6ecfc]"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <p className="flex items-center justify-center gap-2 text-xl font-bold text-[#2a0f3d] sm:text-2xl">
                <CalendarRange size={20} className="text-[#9b3fd6]" />
                {report ? periodTitle({ ...report, period }) : '...'}
              </p>
              {report && (period === 'month' || period === 'year') ? (
                <p className="text-xs text-[#9b86a8]">
                  {fromISO(report.from).toLocaleDateString('pt-BR')} a{' '}
                  {fromISO(report.to).toLocaleDateString('pt-BR')}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={!canGoForward}
              aria-label="Próximo período"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e3cfee] text-[#6a2a94] transition hover:bg-[#f6ecfc] disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
        {report ? (
          <p className="text-center text-[11px] text-[#9b86a8]">
            Comparando com {fromISO(report.previous.from).toLocaleDateString('pt-BR')} a{' '}
            {fromISO(report.previous.to).toLocaleDateString('pt-BR')} · só pedidos com pagamento confirmado
          </p>
        ) : null}
      </section>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className={`space-y-5 transition-opacity ${loading ? 'opacity-50' : ''}`}>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            icon={<TrendingUp size={17} />}
            label="Faturamento"
            value={summary ? money(summary.revenue) : null}
            change={summary && previous ? delta(summary.revenue, previous.revenue) : undefined}
            highlight
          />
          <Metric
            icon={<ShoppingBag size={17} />}
            label="Pedidos pagos"
            value={summary ? String(summary.orders) : null}
            change={summary && previous ? delta(summary.orders, previous.orders) : undefined}
          />
          <Metric
            icon={<CreditCard size={17} />}
            label="Ticket médio"
            value={summary ? money(summary.averageTicket) : null}
            change={summary && previous ? delta(summary.averageTicket, previous.averageTicket) : undefined}
          />
          <Metric
            icon={<Package size={17} />}
            label="Itens vendidos"
            value={summary ? String(summary.items) : null}
            change={summary && previous ? delta(summary.items, previous.items) : undefined}
          />
          <Metric
            icon={<Users size={17} />}
            label="Clientes que compraram"
            value={summary ? String(summary.customers) : null}
            change={summary && previous ? delta(summary.customers, previous.customers) : undefined}
          />
          <Metric
            icon={<UserPlus size={17} />}
            label="Novos cadastros"
            value={summary ? String(summary.newCustomers) : null}
            change={summary && previous ? delta(summary.newCustomers, previous.newCustomers) : undefined}
          />
          <Metric
            icon={<Percent size={17} />}
            label="Descontos dados"
            value={summary ? money(summary.discount) : null}
            detail={summary ? `Frete cobrado: ${money(summary.shipping)}` : ''}
          />
          <Metric
            icon={<XCircle size={17} />}
            label="Cancelados / recusados"
            value={summary ? String(summary.cancelled) : null}
            detail={summary ? `${summary.pending} aguardando pagamento` : ''}
          />
        </section>

        <section className="organizer-surface bg-white p-4 sm:p-5">
          <p className="organizer-eyebrow">
            Faturamento por {report && report.series[0]?.key.length === 7 ? 'mês' : 'dia'}
          </p>
          <SeriesChart series={report?.series} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="organizer-surface bg-white p-4 sm:p-5">
            <p className="organizer-eyebrow flex items-center gap-1.5">
              <CreditCard size={13} /> Formas de pagamento
            </p>
            <ShareList items={report?.byPayment} labels={PAYMENT_LABELS} total={summary?.revenue ?? 0} />
          </div>
          <div className="organizer-surface bg-white p-4 sm:p-5">
            <p className="organizer-eyebrow flex items-center gap-1.5">
              <Truck size={13} /> Formas de entrega
            </p>
            <ShareList items={report?.byDelivery} labels={DELIVERY_LABELS} total={summary?.revenue ?? 0} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <RankTable
            title="Produtos mais vendidos"
            empty="Nenhum produto vendido no período."
            columns={['Produto', 'Qtd.', 'Faturamento']}
            rows={report?.topProducts.map((product) => [
              product.name,
              String(product.quantity),
              money(product.revenue),
            ])}
          />
          <RankTable
            title="Clientes que mais compraram"
            empty="Nenhuma compra no período."
            columns={['Cliente', 'Pedidos', 'Total']}
            rows={report?.topCustomers.map((customer) => [
              customer.name,
              String(customer.orders),
              money(customer.revenue),
            ])}
          />
        </section>
      </div>
    </div>
  )
}

function DateInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: string
  min?: string
  max?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b665f]">
      {label}
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => event.target.value && onChange(event.target.value)}
        className="rounded-xl border border-[#ddc7ea] bg-[#fbf7fd] px-3 py-2 text-sm font-semibold normal-case tracking-normal text-[#2a0f3d] outline-none focus:border-[#9b3fd6]"
      />
    </label>
  )
}

function Metric({
  icon,
  label,
  value,
  change,
  detail,
  highlight = false,
}: {
  icon: ReactNode
  label: string
  value: string | null
  change?: number | null
  detail?: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-[22px] p-4 shadow-[var(--shadow-float)] ${
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
      {change !== undefined ? (
        <ChangeBadge change={change} inverted={highlight} />
      ) : detail ? (
        <p className="mt-1 text-[11px] text-[#9b86a8]">{detail}</p>
      ) : null}
    </div>
  )
}

function ChangeBadge({ change, inverted }: { change: number | null; inverted: boolean }) {
  if (change === null) {
    return (
      <p className={`mt-1 text-[11px] font-semibold ${inverted ? 'text-white/80' : 'text-[#0f8a5f]'}`}>
        novo vs. período anterior
      </p>
    )
  }
  const up = change >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  const tone = inverted
    ? 'bg-white/15 text-white'
    : up
      ? 'bg-[#eaf8f1] text-[#0f6b4b]'
      : 'bg-rose-50 text-rose-700'
  return (
    <p
      className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}
    >
      <Icon size={12} />
      {Math.abs(change).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
      <span className="font-medium opacity-80">vs. anterior</span>
    </p>
  )
}

function SeriesChart({ series }: { series: Breakdown | undefined }) {
  if (!series) return <div className="skeleton-wave mt-4 h-48 rounded-2xl" />
  const max = Math.max(...series.map((point) => point.revenue), 1)
  const monthly = series[0]?.key.length === 7
  const dense = series.length > 14
  const total = series.reduce((sum, point) => sum + point.revenue, 0)
  if (total === 0) return <p className="mt-4 text-sm text-[#9b86a8]">Nenhuma venda paga no período.</p>

  return (
    <div className="mt-4 flex h-52 items-end gap-[3px] sm:gap-1.5">
      {series.map((point, index) => {
        const date = fromISO(monthly ? `${point.key}-01` : point.key)
        const label = monthly
          ? date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
          : String(date.getDate())
        // Com muitos dias, so alguns rotulos aparecem para nao embolar.
        const showLabel = !dense || index === 0 || date.getDate() % 5 === 0
        return (
          <div
            key={point.key}
            className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
          >
            <div className="relative flex w-full flex-1 items-end justify-center">
              <span className="pointer-events-none absolute -top-1 z-10 hidden -translate-y-full whitespace-nowrap rounded-lg bg-[#2a0f3d] px-2 py-1 text-[10px] font-semibold text-white shadow-lg group-hover:block">
                {money(point.revenue)} · {point.orders} ped.
              </span>
              <div
                className="rise-in w-full max-w-12 rounded-t-md bg-[image:var(--grad-brand)] transition group-hover:brightness-125"
                style={{
                  height: `${Math.max((point.revenue / max) * 100, point.revenue > 0 ? 4 : 1)}%`,
                  animationDelay: `${Math.min(index * 25, 600)}ms`,
                }}
              />
            </div>
            <span className="h-3 text-[9px] uppercase text-[#9b86a8] sm:text-[10px]">
              {showLabel ? label : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ShareList({
  items,
  labels,
  total,
}: {
  items: Breakdown | undefined
  labels: Record<string, string>
  total: number
}) {
  if (!items) return <div className="skeleton-wave mt-4 h-24 rounded-2xl" />
  if (items.length === 0) return <p className="mt-4 text-sm text-[#9b86a8]">Sem vendas no período.</p>
  return (
    <ul className="mt-4 space-y-3">
      {items.map((item) => {
        const share = total > 0 ? (item.revenue / total) * 100 : 0
        return (
          <li key={item.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold text-[#2a0f3d]">{labels[item.key] ?? item.key}</span>
              <span className="text-xs text-[#6b665f]">
                {money(item.revenue)} · {item.orders} ped. ·{' '}
                <b className="text-[#6a2a94]">
                  {share.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
                </b>
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f3e9f7]">
              <div
                className="h-full rounded-full bg-[image:var(--grad-brand)]"
                style={{ width: `${share}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function RankTable({
  title,
  empty,
  columns,
  rows,
}: {
  title: string
  empty: string
  columns: [string, string, string]
  rows: string[][] | undefined
}) {
  return (
    <div className="organizer-surface overflow-hidden bg-white">
      <p className="organizer-eyebrow px-4 pt-4 sm:px-5">{title}</p>
      {!rows ? (
        <div className="skeleton-wave m-4 h-32 rounded-2xl" />
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[#9b86a8] sm:px-5">{empty}</p>
      ) : (
        <table className="mt-3 w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-[#f3e9f7] text-left text-[10px] uppercase tracking-[0.15em] text-[#9b86a8]">
              <th className="py-2 pl-4 font-semibold sm:pl-5">{columns[0]}</th>
              <th className="w-16 px-2 py-2 text-right font-semibold">{columns[1]}</th>
              <th className="w-28 py-2 pr-4 text-right font-semibold sm:w-32 sm:pr-5">{columns[2]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, count, value], index) => (
              <tr
                key={`${name}-${index}`}
                className="border-b border-[#f8f1fb] last:border-0 hover:bg-[#fcf8fe]"
              >
                <td className="py-2.5 pl-4 sm:pl-5">
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f6ecfc] text-[10px] font-bold text-[#6a2a94]">
                      {index + 1}
                    </span>
                    <span className="truncate font-semibold text-[#2a0f3d]">{name}</span>
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right text-[#6b665f]">{count}</td>
                <td className="whitespace-nowrap py-2.5 pr-4 text-right font-bold text-[#2a0f3d] sm:pr-5">
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
