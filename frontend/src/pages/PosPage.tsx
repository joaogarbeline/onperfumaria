import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../hooks/useCurrency'
import { api } from '../services/api'
import type { Product } from '../types'

export function PosPage() {
  const { token, scope } = useAuth()
  const format = useCurrency()
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<Array<{ productId: string; name: string; price: number; quantity: number }>>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (token && scope === 'admin') {
      api.get<Product[]>('/admin/products', token).then(setProducts)
    }
  }, [token, scope])

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart])

  function addProduct(product: Product) {
    const price = product.promotionalPrice ?? product.salePrice
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id)
      if (existing) {
        return current.map((item) => (item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item))
      }
      return [...current, { productId: product.id, name: product.name, price, quantity: 1 }]
    })
  }

  async function handleSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    const formData = new FormData(event.currentTarget)
    try {
      const response = await api.post<{ saleId: string; total: number }>(
        '/pos/sales',
        {
          customerName: String(formData.get('customerName') || 'Consumidor Final'),
          paymentMethod: String(formData.get('paymentMethod')),
          discount: Number(formData.get('discount') || 0),
          items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        },
        token,
      )
      setMessage(`Venda concluida ${response.saleId} | Total ${format(response.total)}`)
      setCart([])
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erro ao concluir venda')
    }
  }

  if (!token || scope !== 'admin') {
    return <p className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-zinc-300">Acesse primeiro o painel admin para usar o PDV.</p>
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[36px] border border-white/10 bg-white/[0.04] p-8">
        <h1 className="text-3xl font-semibold">PDV presencial</h1>
        <p className="mt-2 text-zinc-400">Busca rapida por nome com estoque sincronizado ao ecommerce.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {products.map((product) => (
            <button key={product.id} onClick={() => addProduct(product)} className="rounded-[28px] border border-white/10 p-4 text-left">
              <p className="font-medium">{product.name}</p>
              <p className="text-sm text-zinc-400">{format(product.promotionalPrice ?? product.salePrice)}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[36px] border border-white/10 bg-black/20 p-8">
        <h2 className="text-2xl font-semibold">Carrinho do PDV</h2>
        <div className="mt-6 space-y-3">
          {cart.map((item) => (
            <div key={item.productId} className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3">
              <span>{item.name} x{item.quantity}</span>
              <span className="text-gold">{format(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
        <form className="mt-6 space-y-4" onSubmit={handleSale}>
          <input name="customerName" placeholder="Cliente opcional" className="input" />
          <input name="discount" type="number" min="0" step="0.01" placeholder="Desconto manual" className="input" />
          <select name="paymentMethod" className="input">
            <option value="cash">Dinheiro</option>
            <option value="pix">Pix</option>
            <option value="card_debit">Cartao debito</option>
            <option value="card_credit">Cartao credito</option>
          </select>
          <div className="rounded-3xl border border-white/10 p-4">
            <p className="text-zinc-400">Total</p>
            <p className="text-3xl font-semibold text-gold">{format(total)}</p>
          </div>
          <button disabled={cart.length === 0} className="w-full rounded-full bg-gold px-6 py-4 font-semibold text-ink disabled:opacity-60">
            Finalizar venda
          </button>
          {message ? <p className="text-sm text-zinc-300">{message}</p> : null}
        </form>
      </section>
    </div>
  )
}
