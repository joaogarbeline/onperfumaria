import type { FormEvent, ReactNode } from 'react'
import { Check, ChevronRight, LogOut, MapPin, Package, Pencil, Plus, Star, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { InputField } from '../components/Field'
import { Reveal } from '../components/Reveal'
import { Skeleton } from '../components/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../hooks/useCurrency'
import { api } from '../services/api'
import type { CustomerAddress, CustomerOrder } from '../types'
import { formatOrderDate, getOrderStatusPresentation } from '../utils/orders'

type Profile = {
  name: string
  email: string
  phone: string
  cpf: string
  addresses: CustomerAddress[]
  orders: CustomerOrder[]
}

type AddressForm = {
  addressId: string
  addressLabel: string
  cep: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
  isDefault: boolean
}

type Notice = { tone: 'success' | 'error'; text: string } | null

const emptyAddressForm: AddressForm = {
  addressId: '',
  addressLabel: '',
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  city: 'Campo Grande',
  state: 'MS',
  isDefault: false,
}

const RECENT_ORDERS = 3

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

/** Minha conta: dados, enderecos e ultimos pedidos numa tela so. */
export function AccountPage() {
  const { token, scope, logout, openAuth } = useAuth()
  const [searchParams] = useSearchParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const addressesRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (token && scope === 'customer') {
      api
        .get<Profile>('/customer/me', token)
        .then(setProfile)
        .catch(() => undefined)
    }
  }, [token, scope])

  // Links antigos (/conta?tab=addresses) ainda caem direto nos enderecos.
  const requestedTab = searchParams.get('tab')
  useEffect(() => {
    if (profile && requestedTab === 'addresses') {
      addressesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [profile, requestedTab])

  if (!token || scope !== 'customer') {
    return (
      <section className="surface-panel mx-auto max-w-3xl p-6 text-center sm:p-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[image:var(--grad-brand)] text-white shadow-[var(--glow-violet)]">
          <UserRound size={28} />
        </span>
        <h1 className="mt-5 text-5xl leading-none text-[#2a0f3d]">Minha conta</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#6b665f]">
          Entre para acompanhar seus pedidos, salvar endereços e comprar mais rápido nas próximas vezes.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={() => openAuth({ reason: 'Entre para ver seus pedidos e endereços.' })}>
            Entrar
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => openAuth({ view: 'register', reason: 'Preencha sua ficha de cadastro.' })}
          >
            Criar cadastro
          </Button>
        </div>
      </section>
    )
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <Skeleton className="h-40 w-full rounded-[32px]" />
        <Skeleton className="h-72 w-full rounded-[32px]" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Reveal>
        <section className="bg-brand-live relative overflow-hidden rounded-[32px] p-6 text-white shadow-[var(--shadow-trust)] sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#f2b33d]/25 blur-3xl"
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[image:var(--grad-gold)] text-xl font-extrabold text-[#3a164f] shadow-[var(--glow-gold)]">
                {initials(profile.name)}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#ffd27a]">Minha conta</p>
                <h1 className="truncate text-4xl leading-tight text-white">{profile.name}</h1>
                <p className="truncate text-sm text-white/75">{profile.email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to="/pedidos" className="flex-1 sm:flex-none">
                <Button variant="secondary" fullWidth>
                  <Package size={16} /> Meus pedidos
                </Button>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-2 rounded-[20px] border border-white/25 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <LogOut size={16} /> Sair
              </button>
            </div>
          </div>
        </section>
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <ProfileSection profile={profile} token={token} onSaved={setProfile} />
        <RecentOrders orders={profile.orders} />
      </div>

      <section ref={addressesRef} className="scroll-mt-28">
        <AddressesSection profile={profile} token={token} onSaved={setProfile} />
      </section>
    </div>
  )
}

function SectionCard({
  icon,
  title,
  action,
  children,
}: {
  icon: ReactNode
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="surface-panel h-full p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-3xl leading-none text-[#2a0f3d]">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f3e3fb] text-[#6a2a94]">
            {icon}
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null
  return (
    <p
      className={`rise-in mt-4 flex items-center gap-2 rounded-[18px] px-4 py-3 text-sm ${
        notice.tone === 'success'
          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border border-rose-200 bg-rose-50 text-rose-700'
      }`}
    >
      {notice.tone === 'success' ? <Check size={16} /> : <X size={16} />}
      {notice.text}
    </p>
  )
}

function ProfileSection({
  profile,
  token,
  onSaved,
}: {
  profile: Profile
  token: string
  onSaved: (profile: Profile) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setSaving(true)
    setNotice(null)
    try {
      const updated = await api.put<Profile>(
        '/customer/me',
        {
          name: String(formData.get('name')),
          email: String(formData.get('email')),
          phone: String(formData.get('phone')),
          cpf: String(formData.get('cpf') || ''),
        },
        token,
      )
      onSaved(updated)
      setEditing(false)
      setNotice({ tone: 'success', text: 'Dados atualizados.' })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Erro ao salvar seus dados' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard
      icon={<UserRound size={18} />}
      title="Meus dados"
      action={
        editing ? null : (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Editar
          </Button>
        )
      }
    >
      {editing ? (
        <form className="rise-in grid gap-4" onSubmit={handleSave}>
          <InputField name="name" label="Nome" defaultValue={profile.name} required />
          <InputField name="email" label="E-mail" type="email" defaultValue={profile.email} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField name="phone" label="Telefone" defaultValue={profile.phone} required />
            <InputField name="cpf" label="CPF" defaultValue={profile.cpf} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          <DataItem label="Nome" value={profile.name} />
          <DataItem label="E-mail" value={profile.email} />
          <DataItem label="Telefone" value={profile.phone} />
          <DataItem label="CPF" value={profile.cpf} />
        </dl>
      )}
      <NoticeLine notice={notice} />
    </SectionCard>
  )
}

function DataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#efe3f6] bg-white/80 px-4 py-3">
      <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9b86a8]">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-[#2a0f3d]">{value || 'Não informado'}</dd>
    </div>
  )
}

function RecentOrders({ orders }: { orders: CustomerOrder[] }) {
  const format = useCurrency()
  const recent = orders.slice(0, RECENT_ORDERS)

  return (
    <SectionCard
      icon={<Package size={18} />}
      title="Últimos pedidos"
      action={
        orders.length > RECENT_ORDERS ? (
          <Link to="/pedidos" className="text-sm font-semibold text-[#6a2a94] hover:underline">
            Ver todos
          </Link>
        ) : null
      }
    >
      {recent.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-[#ddc7ea] px-4 py-8 text-center">
          <p className="text-sm text-[#6b665f]">Você ainda não fez nenhum pedido.</p>
          <Link to="/">
            <Button size="sm">Explorar perfumes</Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {recent.map((order) => {
            const status = getOrderStatusPresentation(order)
            return (
              <li key={order.id}>
                <Link
                  to={`/pedidos/${order.id}`}
                  className="flex items-center gap-3 rounded-[20px] border border-[#efe3f6] bg-white/80 px-4 py-3 transition hover:-translate-y-0.5 hover:border-[#d6b3ec] hover:shadow-[var(--shadow-float)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#2a0f3d]">
                      Pedido #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-[#6b665f]">
                      {formatOrderDate(order.createdAt)} · {format(order.total)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset ${status.className}`}
                  >
                    {status.label}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-[#9b86a8]" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}

function AddressesSection({
  profile,
  token,
  onSaved,
}: {
  profile: Profile
  token: string
  onSaved: (profile: Profile) => void
}) {
  const [form, setForm] = useState<AddressForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const openForm = (next: AddressForm) => {
    setForm(next)
    setNotice(null)
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  const update = (field: keyof AddressForm, value: string | boolean) =>
    setForm((current) => (current ? { ...current, [field]: value } : current))

  async function lookupCep(rawCep: string) {
    const cep = rawCep.replace(/\D/g, '')
    if (cep.length !== 8) return
    try {
      const data = await api.get<{
        logradouro?: string
        bairro?: string
        localidade?: string
        uf?: string
        erro?: string
      }>(`/cep/${cep}`)
      if (data.erro) return
      setForm((current) =>
        current
          ? {
              ...current,
              street: data.logradouro || current.street,
              neighborhood: data.bairro || current.neighborhood,
              city: data.localidade || current.city,
              state: data.uf || current.state,
            }
          : current,
      )
    } catch {
      // CEP fora do ar: o cliente preenche na mao.
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    setSaving(true)
    setNotice(null)
    try {
      const updated = await api.post<Profile>('/customer/addresses', form, token)
      onSaved(updated)
      setForm(null)
      setNotice({ tone: 'success', text: 'Endereço salvo.' })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Erro ao salvar endereço' })
    } finally {
      setSaving(false)
    }
  }

  async function makeDefault(addressId: string) {
    setNotice(null)
    try {
      onSaved(await api.put<Profile>(`/customer/addresses/${addressId}/default`, {}, token))
      setNotice({ tone: 'success', text: 'Endereço padrão atualizado.' })
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Erro ao definir endereço padrão',
      })
    }
  }

  return (
    <SectionCard
      icon={<MapPin size={18} />}
      title="Endereços"
      action={
        form ? null : (
          <Button size="sm" onClick={() => openForm(emptyAddressForm)}>
            <Plus size={15} /> Adicionar
          </Button>
        )
      }
    >
      {profile.addresses.length === 0 && !form ? (
        <button
          type="button"
          onClick={() => openForm(emptyAddressForm)}
          className="flex w-full flex-col items-center gap-2 rounded-[22px] border border-dashed border-[#ddc7ea] px-4 py-8 text-center text-sm text-[#6b665f] transition hover:border-[#9b3fd6] hover:bg-white/60"
        >
          <MapPin size={22} className="text-[#9b3fd6]" />
          Nenhum endereço salvo. Toque para cadastrar e agilizar seu checkout.
        </button>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {profile.addresses.map((address, index) => (
            <article
              key={`${address.id ?? address.cep}-${index}`}
              className={`rounded-[22px] border bg-white/85 p-4 transition hover:shadow-[var(--shadow-float)] ${
                address.isDefault ? 'border-[#c9a4e2] ring-2 ring-[#9b3fd6]/15' : 'border-[#efe3f6]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold text-[#2a0f3d]">{address.label || `Endereço ${index + 1}`}</p>
                {address.isDefault ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[image:var(--grad-gold)] px-2.5 py-0.5 text-[10px] font-bold text-[#3a164f]">
                    <Star size={11} fill="currentColor" /> Padrão
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-[#6b665f]">
                {address.street}, {address.number}
                {address.neighborhood ? ` - ${address.neighborhood}` : ''}
                <br />
                {address.city} - {address.state} · CEP {address.cep}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    openForm({
                      addressId: address.id || '',
                      addressLabel: address.label || '',
                      cep: address.cep,
                      street: address.street,
                      number: address.number,
                      neighborhood: address.neighborhood,
                      city: address.city,
                      state: address.state,
                      isDefault: Boolean(address.isDefault),
                    })
                  }
                >
                  <Pencil size={13} /> Editar
                </Button>
                {!address.isDefault && address.id ? (
                  <Button variant="ghost" size="sm" onClick={() => makeDefault(address.id!)}>
                    <Star size={13} /> Tornar padrão
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {form ? (
        <form
          ref={formRef}
          className="rise-in mt-4 grid gap-4 rounded-[24px] border border-[#e3cfee] bg-white/90 p-4 sm:p-5"
          onSubmit={handleSubmit}
        >
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold text-[#2a0f3d]">
              {form.addressId ? 'Editar endereço' : 'Novo endereço'}
            </p>
            <button
              type="button"
              aria-label="Fechar formulário"
              onClick={() => setForm(null)}
              className="rounded-full p-1.5 text-[#9b86a8] hover:bg-[#f6ecfc]"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField
              label="CEP"
              value={form.cep}
              inputMode="numeric"
              onChange={(event) => update('cep', event.target.value)}
              onBlur={(event) => lookupCep(event.target.value)}
              required
            />
            <InputField
              label="Apelido"
              value={form.addressLabel}
              onChange={(event) => update('addressLabel', event.target.value)}
              placeholder="Casa, trabalho..."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <InputField
              label="Rua"
              value={form.street}
              onChange={(event) => update('street', event.target.value)}
              required
            />
            <InputField
              label="Número"
              value={form.number}
              onChange={(event) => update('number', event.target.value)}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_100px]">
            <InputField
              label="Bairro"
              value={form.neighborhood}
              onChange={(event) => update('neighborhood', event.target.value)}
              required
            />
            <InputField
              label="Cidade"
              value={form.city}
              onChange={(event) => update('city', event.target.value)}
            />
            <InputField
              label="UF"
              value={form.state}
              onChange={(event) => update('state', event.target.value)}
            />
          </div>
          <label className="choice-card flex cursor-pointer items-center gap-3 rounded-[18px] border border-[#efe3f6] bg-white px-4 py-3 text-sm text-[#2a0f3d]">
            <input
              type="checkbox"
              className="radio-fx rounded-md"
              checked={form.isDefault}
              onChange={(event) => update('isDefault', event.target.checked)}
            />
            Usar como endereço padrão
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar endereço'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setForm(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}
      <NoticeLine notice={notice} />
    </SectionCard>
  )
}
