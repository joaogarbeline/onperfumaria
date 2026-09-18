import { initMercadoPago, Payment } from '@mercadopago/sdk-react'
import { Copy, Eye, EyeOff, Minus, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { CartSummary } from '../components/CartSummary'
import { EmptyState } from '../components/EmptyState'
import { InputField, SelectField } from '../components/Field'
import { Reveal } from '../components/Reveal'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { useCurrency } from '../hooks/useCurrency'
import { api } from '../services/api'
import type { CustomerAddress } from '../types'

function validateCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '')
  if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false
  for (let j = 9; j <= 10; j++) {
    let sum = 0
    for (let i = 0; i < j; i++) sum += parseInt(clean[i]) * ((j + 1) - i)
    const digit = ((sum * 10) % 11) % 10
    if (digit !== parseInt(clean[j])) return false
  }
  return true
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

function rejectionMessage(detail?: string): string {
  const reasons: Record<string, string> = {
    cc_rejected_insufficient_amount: 'Saldo insuficiente no cartao.',
    cc_rejected_bad_filled_security_code: 'Codigo de seguranca (CVV) invalido.',
    cc_rejected_bad_filled_date: 'Data de validade invalida.',
    cc_rejected_bad_filled_card_number: 'Numero do cartao invalido.',
    cc_rejected_bad_filled_other: 'Confira os dados do cartao e tente novamente.',
    cc_rejected_call_for_authorize: 'Cartao requer autorizacao. Entre em contato com o banco emissor.',
    cc_rejected_card_disabled: 'Cartao desabilitado. Entre em contato com o banco emissor.',
    cc_rejected_duplicated_payment: 'Pagamento duplicado para esse pedido.',
    cc_rejected_high_risk: 'Pagamento recusado por seguranca.',
    cc_rejected_max_attempts: 'Numero maximo de tentativas excedido. Tente outro cartao.',
    cc_rejected_other_reason: 'Pagamento recusado pelo banco emissor.',
  }
  return (detail && reasons[detail]) || 'Pagamento recusado. Verifique os dados do cartao ou tente Pix.'
}

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 8) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Fraca', color: 'text-rose-500' }
  if (score <= 2) return { score, label: 'Media', color: 'text-amber-500' }
  if (score <= 3) return { score, label: 'Boa', color: 'text-emerald-500' }
  return { score, label: 'Forte', color: 'text-emerald-600' }
}

type CheckoutConfig = {
  shippingOptions: Array<{ value: string; label: string }>
  mpPublicKey: string
}

type CustomerProfile = {
  name: string
  email: string
  phone: string
  cpf: string
  addresses: CustomerAddress[]
}

type ShippingQuote = {
  amount: number
  label: string
}

type CorreiosOption = {
  service: string
  code: string
  price: number
  days: number
  label: string
}

type CheckoutForm = {
  customerName: string
  customerEmail: string
  confirmEmail: string
  customerPhone: string
  customerCpf: string
  password: string
  confirmPassword: string
  showPassword: boolean
  cep: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
  deliveryMode: string
  couponCode: string
}

const initialForm: CheckoutForm = {
  customerName: '',
  customerEmail: '',
  confirmEmail: '',
  customerPhone: '',
  customerCpf: '',
  password: '',
  confirmPassword: '',
  showPassword: false,
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  city: 'Campo Grande',
  state: 'MS',
  deliveryMode: '',
  couponCode: '',
}

const paymentMethodsConfig = {
  creditCard: 'all',
  bankTransfer: 'all',
  debitCard: [],
  ticket: [],
  mercadoPago: [],
  atm: [],
  prepaidCard: [],
  maxInstallments: 12,
}

function useFormValidation(form: CheckoutForm, isGuest: boolean) {
  const errors: string[] = []
  if (!form.customerName.trim()) errors.push('Nome obrigatorio')
  if (!form.customerEmail.trim() || !form.customerEmail.includes('@')) errors.push('Email invalido')
  if (form.customerEmail !== form.confirmEmail) errors.push('Emails nao conferem')
  if (!form.customerPhone.replace(/\D/g, '')) errors.push('Telefone obrigatorio')
  const cpfClean = form.customerCpf.replace(/\D/g, '')
  if (!cpfClean) errors.push('CPF obrigatorio')
  else if (!validateCPF(form.customerCpf)) errors.push('CPF invalido')
  if (isGuest) {
    if (!form.password) errors.push('Senha obrigatoria')
    else if (form.password.length < 6) errors.push('Senha deve ter no minimo 6 caracteres')
    else if (getPasswordStrength(form.password).score < 2) errors.push('Senha muito fraca - use letras e numeros')
    if (form.password && form.confirmPassword && form.password !== form.confirmPassword) errors.push('Senhas nao conferem')
  }
  if (!form.cep.replace(/\D/g, '')) errors.push('CEP obrigatorio')
  if (!form.street.trim()) errors.push('Rua obrigatoria')
  if (!form.number.trim()) errors.push('Numero obrigatorio')
  if (!form.neighborhood.trim()) errors.push('Bairro obrigatorio')
  if (!form.city.trim()) errors.push('Cidade obrigatoria')
  if (!form.state.trim()) errors.push('Estado obrigatorio')
  if (!form.deliveryMode) errors.push('Selecione a entrega')
  return { valid: errors.length === 0, errors }
}

export function CheckoutPage() {
  const { items, updateQuantity, removeItem, clearCart } = useCart()
  const { token, scope } = useAuth()
  const format = useCurrency()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<CheckoutConfig>({ shippingOptions: [], mpPublicKey: '' })
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [form, setForm] = useState<CheckoutForm>(initialForm)
  const [quote, setQuote] = useState<ShippingQuote | null>(null)
  const [couponMessage, setCouponMessage] = useState('')
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponApplied, setCouponApplied] = useState(false)
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [correiosOptions, setCorreiosOptions] = useState<CorreiosOption[]>([])
  const [selectedCorreios, setSelectedCorreios] = useState<string>('')
  const [searchParams] = useSearchParams()
  const [pixData, setPixData] = useState<{ orderId: string; qrCode: string; qrCodeBase64: string } | null>(null)
  const [pixPaid, setPixPaid] = useState(false)
  const [pixCopied, setPixCopied] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [brickReady, setBrickReady] = useState(false)
  const [brickTimedOut, setBrickTimedOut] = useState(false)

  useEffect(() => {
    const status = searchParams.get('status')
    if (status === 'success') setMessage('Pagamento aprovado! Seu pedido esta sendo processado.')
    else if (status === 'failure') setMessage('Pagamento recusado. Tente novamente.')
    else if (status === 'pending') setMessage('Pagamento pendente. Aguardando confirmacao.')
  }, [searchParams])

  useEffect(() => {
    if (config.mpPublicKey) {
      initMercadoPago(config.mpPublicKey, { locale: 'pt-BR' })
    }
  }, [config.mpPublicKey])

  useEffect(() => {
    if (!pixData || pixPaid) return
    const interval = window.setInterval(() => {
      api
        .get<{ paymentStatus: string }>(`/order/${pixData.orderId}`)
        .then((order) => {
          if (order.paymentStatus === 'paid') {
            setPixPaid(true)
          }
        })
        .catch(() => undefined)
    }, 5000)
    return () => window.clearInterval(interval)
  }, [pixData, pixPaid])

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0), [items])
  const totalWeight = useMemo(() => items.reduce((sum, item) => sum + item.weightGrams * item.quantity, 0), [items])

  useEffect(() => {
    api.get<CheckoutConfig>('/store/config').then((data) => {
      setConfig(data)
      setForm((current) => ({
        ...current,
        deliveryMode: current.deliveryMode || data.shippingOptions[0]?.value || '',
      }))
    })
  }, [])

  useEffect(() => {
    if (token && scope === 'customer') {
      api
        .get<CustomerProfile>('/customer/me', token)
        .then((data) => {
          setProfile(data)
          const primaryAddress = data.addresses?.find((address) => address.isDefault) ?? data.addresses?.[0]
          setSelectedAddressId(primaryAddress?.id ?? '')
          setForm((current) => ({
            ...current,
            customerName: data.name,
            customerEmail: data.email,
            confirmEmail: data.email,
            customerPhone: data.phone,
            customerCpf: data.cpf,
            cep: primaryAddress?.cep ?? current.cep,
            street: primaryAddress?.street ?? current.street,
            number: primaryAddress?.number ?? current.number,
            neighborhood: primaryAddress?.neighborhood ?? current.neighborhood,
            city: primaryAddress?.city ?? current.city,
            state: primaryAddress?.state ?? current.state,
          }))
        })
        .catch(() => undefined)
    }
  }, [token, scope])

  function applyAddress(addressId: string) {
    if (!profile) return
    const nextAddress = profile.addresses.find((address) => address.id === addressId)
    if (!nextAddress) return

    setSelectedAddressId(addressId)
    setForm((current) => ({
      ...current,
      cep: nextAddress.cep,
      street: nextAddress.street,
      number: nextAddress.number,
      neighborhood: nextAddress.neighborhood,
      city: nextAddress.city,
      state: nextAddress.state,
    }))
  }

  useEffect(() => {
    if (!form.deliveryMode || !form.cep || subtotal <= 0 || totalWeight <= 0) {
      return
    }

    if (form.deliveryMode === 'correios') {
      api
        .get<CorreiosOption[]>(`/shipping/correios?cep=${form.cep}&weight=${totalWeight}`)
        .then((options) => {
          setCorreiosOptions(options)
          if (options.length > 0 && !selectedCorreios) {
            setSelectedCorreios(options[0].code)
          }
        })
        .catch(() => setCorreiosOptions([]))
      return
    }

    setCorreiosOptions([])
    setSelectedCorreios('')
    api
      .post<ShippingQuote>('/shipping/quote', {
        cep: form.cep,
        subtotal: subtotal - couponDiscount,
        weightGrams: totalWeight,
        deliveryMode: form.deliveryMode,
        city: form.city,
      })
      .then(setQuote)
      .catch(() => setQuote(null))
  }, [form.cep, form.deliveryMode, form.city, subtotal, totalWeight, couponDiscount])

  const selectedCorreiosOption = correiosOptions.find((o) => o.code === selectedCorreios)
  const activeQuote = form.deliveryMode === 'correios'
    ? (selectedCorreiosOption ? { amount: selectedCorreiosOption.price, label: selectedCorreiosOption.label } : null)
    : (form.deliveryMode && form.cep && subtotal > 0 && totalWeight > 0 ? quote : null)
  const total = subtotal - couponDiscount + (activeQuote?.amount ?? 0)
  const isGuest = !token || scope !== 'customer'
  const validation = useFormValidation(form, isGuest)
  const missingRequiredFields = !validation.valid
  const showBrick = !missingRequiredFields && !!config.mpPublicKey

  useEffect(() => {
    if (!showBrick) return
    setBrickReady(false)
    setBrickTimedOut(false)
    const timeout = window.setTimeout(() => setBrickTimedOut(true), 10000)
    return () => window.clearTimeout(timeout)
  }, [showBrick, total])

  async function handlePayment(brickData: { formData?: unknown }): Promise<void> {
    const formData = (brickData.formData ?? {}) as Record<string, unknown>
    setPaymentError('')
    setLoading(true)
    try {
      const response = await api.post<{
        orderId: string
        total: number
        paymentStatus: string
        orderStatus: string
        discount: number
        shippingAmount: number
        statusDetail?: string
        qrCode?: string
        qrCodeBase64?: string
      }>(
        '/checkout',
        {
          ...form,
          correiosPrice: form.deliveryMode === 'correios' ? activeQuote?.amount ?? 0 : 0,
          items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
          paymentMethodId: formData.payment_method_id,
          token: formData.token ?? '',
          issuerId: formData.issuer_id ?? '',
          installments: Number(formData.installments ?? 1),
        },
        token && scope === 'customer' ? token : undefined,
      )

      if (response.qrCode) {
        setPixData({ orderId: response.orderId, qrCode: response.qrCode, qrCodeBase64: response.qrCodeBase64 ?? '' })
        clearCart()
        return
      }

      if (response.paymentStatus === 'rejected' || response.paymentStatus === 'cancelled') {
        throw new Error(rejectionMessage(response.statusDetail))
      }

      clearCart()
      setMessage(
        response.paymentStatus === 'approved'
          ? 'Pagamento aprovado! Seu pedido foi confirmado.'
          : 'Pagamento em analise. Voce recebera a confirmacao em breve.',
      )
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao processar pagamento'
      setPaymentError(msg)
      throw error
    } finally {
      setLoading(false)
    }
  }

  if (pixData) {
    return (
      <EmptyState
        eyebrow="Pix"
        title={pixPaid ? 'Pagamento confirmado!' : 'Escaneie o QR Code para pagar'}
        description={
          pixPaid
            ? 'Recebemos a confirmacao do seu Pix. Seu pedido ja esta sendo processado.'
            : 'Abra o app do seu banco, escolha pagar com Pix e escaneie o codigo abaixo, ou copie o codigo e cole no app.'
        }
        action={
          pixPaid ? (
            <Link to="/catalogo">
              <Button>Voltar ao catalogo</Button>
            </Link>
          ) : (
            <div className="flex flex-col items-center gap-4">
              {pixData.qrCodeBase64 ? (
                <img
                  src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                  alt="QR Code Pix"
                  className="h-56 w-56 rounded-[24px] border border-stone-200 bg-white p-3"
                />
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(pixData.qrCode).then(() => {
                    setPixCopied(true)
                    window.setTimeout(() => setPixCopied(false), 2000)
                  })
                }}
              >
                <Copy size={16} />
                {pixCopied ? 'Codigo copiado!' : 'Copiar codigo Pix'}
              </Button>
              <p className="text-xs text-[#6b665f]">Aguardando confirmacao do pagamento...</p>
            </div>
          )
        }
      />
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        eyebrow="Carrinho vazio"
        title={message ? 'Pedido concluido' : 'Seu carrinho esta vazio'}
        description={
          message ||
          'Explore o catalogo para adicionar perfumes importados ou arabes antes de seguir para o checkout.'
        }
        action={
          <Link to="/catalogo">
            <Button>Voltar ao catalogo</Button>
          </Link>
        }
      />
    )
  }

  return (
    <form className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]" onSubmit={(event) => event.preventDefault()}>
      <div className="space-y-6">
        <Reveal>
          <section className="surface-panel p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">Checkout</p>
                <h1 className="mt-2 text-5xl leading-none text-[#171412]">Finalize com seguranca</h1>
              </div>
              {profile ? <p className="text-sm text-[#6b665f]">Cliente identificado: {profile.name}</p> : null}
            </div>

            <div className="mt-6 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="surface-soft flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <img src={item.imageUrl} alt={item.name} className="h-28 w-full rounded-[24px] object-cover sm:h-24 sm:w-24" />
                  <div className="flex-1">
                    <p className="text-xl font-semibold text-[#171412]">{item.name}</p>
                    <p className="mt-1 text-sm text-[#6b665f]">{item.brand} • {format(item.finalPrice)}</p>
                    {item.discountLabel ? <p className="mt-1 text-xs text-[#0f8a5f]">{item.discountLabel}</p> : null}
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-2 py-2">
                      <button type="button" aria-label={`Diminuir quantidade de ${item.name}`} onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}>
                        <Minus size={16} />
                      </button>
                      <span className="min-w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <button type="button" aria-label={`Aumentar quantidade de ${item.name}`} onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                        <Plus size={16} />
                      </button>
                    </div>
                    <button type="button" aria-label={`Remover ${item.name}`} onClick={() => removeItem(item.id)} className="rounded-full border border-rose-200 p-2 text-rose-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal delay={80}>
          <section className="surface-panel p-5 sm:p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                label="Nome completo"
                value={form.customerName}
                onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))}
                required
              />
              {!isGuest && profile && profile.addresses.length > 0 ? (
                <SelectField
                  label="Endereco salvo"
                  value={selectedAddressId}
                  onChange={(event) => {
                    if (event.target.value === '__new__') {
                      setSelectedAddressId('__new__')
                      setForm((current) => ({
                        ...current,
                        cep: '',
                        street: '',
                        number: '',
                        neighborhood: '',
                        city: 'Campo Grande',
                        state: 'MS',
                      }))
                    } else {
                      applyAddress(event.target.value)
                    }
                  }}
                >
                  <option value="">Selecionar endereco...</option>
                  {profile.addresses.map((address, index) => (
                    <option key={address.id || `${address.cep}-${index}`} value={address.id}>
                      {(address.label || `Endereco ${index + 1}`) + (address.isDefault ? ' - padrao' : '')}
                    </option>
                  ))}
                  <option value="__new__">+ Novo endereco</option>
                </SelectField>
              ) : null}
              <InputField
                label="CEP"
                value={form.cep}
                onChange={(event) => {
                  const cep = event.target.value
                  setForm((current) => ({ ...current, cep }))
                  if (cep.replace(/\D/g, '').length === 8) {
                    api.get<{ logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: string }>(`/cep/${cep.replace(/\D/g, '')}`)
                      .then((data) => {
                        if (!data.erro) {
                          setForm((current) => ({
                            ...current,
                            street: data.logradouro || current.street,
                            neighborhood: data.bairro || current.neighborhood,
                            city: data.localidade ? data.localidade.toUpperCase() : current.city,
                            state: data.uf || current.state,
                          }))
                        }
                      })
                      .catch(() => undefined)
                  }
                }}
                required
              />
              <InputField
                label="Rua"
                value={form.street}
                onChange={(event) => setForm((current) => ({ ...current, street: event.target.value }))}
                required
              />
              <InputField
                label="Numero"
                value={form.number}
                onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))}
                required
              />
              <InputField
                label="Bairro"
                value={form.neighborhood}
                onChange={(event) => setForm((current) => ({ ...current, neighborhood: event.target.value }))}
                required
              />
              <InputField
                label="Cidade"
                value={form.city}
                onChange={(event) => {
                  let value = event.target.value
                  if (value.toLowerCase() === 'campo grande') {
                    value = 'CAMPO GRANDE'
                  }
                  setForm((current) => ({ ...current, city: value }))
                }}
                required
              />
              <InputField
                label="Estado"
                value={form.state}
                onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}
                required
              />
              <InputField
                label="E-mail"
                type="email"
                value={form.customerEmail}
                onChange={(event) => setForm((current) => ({ ...current, customerEmail: event.target.value }))}
                required
              />
              <InputField
                label="Confirmar e-mail"
                type="email"
                value={form.confirmEmail}
                onChange={(event) => setForm((current) => ({ ...current, confirmEmail: event.target.value }))}
                required
              />
              <InputField
                label="Telefone"
                value={form.customerPhone}
                onChange={(event) => setForm((current) => ({ ...current, customerPhone: formatPhone(event.target.value) }))}
                placeholder="(67) 99999-9999"
                required
              />
              <InputField
                label="CPF"
                value={form.customerCpf}
                onChange={(event) => setForm((current) => ({ ...current, customerCpf: formatCPF(event.target.value) }))}
                placeholder="000.000.000-00"
                required
              />
              {isGuest ? (
                <>
                  <div className="md:col-span-2">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="relative">
                        <InputField
                          label="Senha para cadastro"
                          type={form.showPassword ? 'text' : 'password'}
                          value={form.password}
                          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, showPassword: !f.showPassword }))}
                          className="absolute right-3 top-[34px] text-[#6b665f]"
                          tabIndex={-1}
                        >
                          {form.showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                        {form.password ? (
                          <p className={`mt-1 text-xs font-medium ${getPasswordStrength(form.password).color}`}>
                            Forca: {getPasswordStrength(form.password).label}
                          </p>
                        ) : null}
                      </div>
                      <div className="relative">
                        <InputField
                          label="Confirmar senha"
                          type={form.showPassword ? 'text' : 'password'}
                          value={form.confirmPassword}
                          onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                          required
                        />
                        {form.confirmPassword ? (
                          <p className={`mt-1 text-xs font-medium ${form.password === form.confirmPassword ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {form.password === form.confirmPassword ? 'Senhas conferem' : 'Senhas nao conferem'}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
              <SelectField
                label="Entrega"
                value={form.deliveryMode}
                onChange={(event) => setForm((current) => ({ ...current, deliveryMode: event.target.value }))}
              >
                {config.shippingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              {form.deliveryMode === 'correios' && correiosOptions.length > 0 ? (
                <SelectField
                  label="Opcao Correios"
                  value={selectedCorreios}
                  onChange={(event) => setSelectedCorreios(event.target.value)}
                >
                  {correiosOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
              ) : null}
              <div className="md:col-span-2">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <InputField
                    label="Cupom"
                    value={form.couponCode}
                    onChange={(event) => setForm((current) => ({ ...current, couponCode: event.target.value }))}
                    placeholder="Digite seu cupom"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="self-end"
                    disabled={couponApplied}
                    onClick={async () => {
                      if (!form.couponCode.trim()) {
                        setCouponMessage('Informe um codigo de cupom.')
                        return
                      }
                      try {
                        const result = await api.post<{ discount: number; discountType: string; value: number }>('/store/validate-coupon', { code: form.couponCode, subtotal })
                        setCouponDiscount(result.discount)
                        setCouponApplied(true)
                        setCouponMessage(`Cupom ${form.couponCode.toUpperCase()} aplicado! Desconto: ${format(result.discount)}`)
                      } catch (err) {
                        setCouponMessage(err instanceof Error ? err.message : 'Cupom invalido')
                        setCouponDiscount(0)
                        setCouponApplied(false)
                      }
                    }}
                  >
                    {couponApplied ? 'Aplicado' : 'Aplicar'}
                  </Button>
                </div>
                {couponMessage ? <p className="mt-2 text-xs text-[#6b665f]">{couponMessage}</p> : null}
              </div>
            </div>

            {message ? <p className="mt-5 rounded-[22px] border border-stone-200 bg-[#f7f2eb] px-4 py-3 text-sm text-[#6b665f]">{message}</p> : null}
          </section>
        </Reveal>
      </div>

      <Reveal delay={120}>
        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <CartSummary
            subtotal={subtotal}
            shipping={activeQuote?.amount ?? 0}
            shippingLabel={activeQuote?.label || 'Frete'}
            discount={couponDiscount}
            total={total}
            couponCode={form.couponCode}
          />
          {missingRequiredFields ? (
            <p className="rounded-[22px] border border-stone-200 bg-[#f7f2eb] px-4 py-3 text-center text-sm text-[#6b665f]">
              Preencha seus dados e endereco acima para escolher a forma de pagamento.
            </p>
          ) : !config.mpPublicKey ? (
            <p className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-[#6b665f]">
              Pagamento online indisponivel no momento. Entre em contato para finalizar seu pedido.
            </p>
          ) : brickTimedOut && !brickReady ? (
            <p className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-600">
              Nao foi possivel carregar o formulario de pagamento. Verifique sua conexao e recarregue a pagina.
            </p>
          ) : (
            <div className={`surface-panel overflow-hidden p-2 ${loading ? 'pointer-events-none opacity-60' : ''}`}>
              {loading ? <p className="px-4 pt-3 text-center text-xs font-medium text-[#6b665f]">Processando pagamento...</p> : null}
              {!brickReady ? <p className="px-4 pt-3 text-center text-xs font-medium text-[#6b665f]">Carregando formulario de pagamento...</p> : null}
              <Payment
                key={total.toFixed(2)}
                initialization={{ amount: total }}
                customization={{ paymentMethods: paymentMethodsConfig }}
                onSubmit={handlePayment}
                onReady={() => setBrickReady(true)}
                onError={(error) => setPaymentError(error instanceof Error ? error.message : 'Erro ao carregar o pagamento')}
                locale="pt-BR"
              />
            </div>
          )}
          {paymentError ? (
            <p className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{paymentError}</p>
          ) : null}
          {isGuest ? (
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-[#6b665f]">
              Ja tem cadastro?{' '}
              <Link to="/login" className="font-semibold text-[#b77717]">
                Entrar como cliente
              </Link>
            </div>
          ) : null}
        </div>
      </Reveal>
    </form>
  )
}
