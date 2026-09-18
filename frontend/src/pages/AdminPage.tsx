import type { FormEvent, ReactNode } from 'react'
import {
  Boxes,
  CreditCard,
  LayoutDashboard,
  PackageSearch,
  Percent,
  Search,
  ShoppingCart,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminTable } from '../components/AdminTable'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InputField, SelectField, TextAreaField } from '../components/Field'
import { Reveal } from '../components/Reveal'
import { Toast } from '../components/Toast'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../hooks/useCurrency'
import { api } from '../services/api'
import type { Product, SelectOption } from '../types'

type Dashboard = {
  revenueToday: number
  revenueMonth: number
  pendingOrders: number
  paidOrders: number
  lowStockProducts: number
  customers: number
}

type CatalogData = {
  brands: SelectOption[]
  categories: SelectOption[]
  productTypes: string[]
}

type BrandItem = {
  id: string
  name: string
  slug: string
}

type CategoryItem = {
  id: string
  name: string
  slug: string
}

type PosLine = {
  productId: string
  name: string
  price: number
  quantity: number
  stockCurrent: number
  discountLabel: string
}

type AdminOrder = {
  id: string
  customerName: string
  total: number
  paymentStatus: string
  orderStatus: string
  createdAt: string
  origin: string
}

type AdminCustomer = {
  id: string
  name: string
  email: string
  phone: string
  cpf: string
  createdAt: string
}

type AdminTab = 'dashboard' | 'products' | 'catalog' | 'orders' | 'customers' | 'marketing' | 'pdv'

type CouponItem = { id: string; code: string; discountType: string; value: number; isActive: boolean }
type DiscountRuleItem = { id: string; name: string; targetType: string; targetId: string; targetName: string; discountType: string; value: number; isActive: boolean }

const emptyProductForm = {
  id: '',
  name: '',
  sku: '',
  slug: '',
  brandId: '',
  categoryId: '',
  description: '',
  salePrice: 0,
  costPrice: 0,
  stockCurrent: 0,
  stockMinimum: 0,
  weightGrams: 0,
  volumeMl: 0,
  gender: 'unissex',
  productType: 'importado',
  imageUrl: '',
  isActive: true,
  isFeatured: false,
}

export function AdminPage() {
  const { token, logout } = useAuth()
  const format = useCurrency()
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [customers, setCustomers] = useState<AdminCustomer[]>([])
  const [catalogData, setCatalogData] = useState<CatalogData>({ brands: [], categories: [], productTypes: [] })
  const [brands, setBrands] = useState<BrandItem[]>([])
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [productTypes, setProductTypes] = useState<string[]>([])
  const [brandForm, setBrandForm] = useState({ id: '', name: '' })
  const [categoryForm, setCategoryForm] = useState({ id: '', name: '' })
  const [newType, setNewType] = useState('')
  const [mpSettings, setMpSettings] = useState({ mp_access_token: '', mp_public_key: '', mp_webhook_secret: '' })
  const [coupons, setCoupons] = useState<CouponItem[]>([])
  const [discountRules, setDiscountRules] = useState<DiscountRuleItem[]>([])
  const [couponForm, setCouponForm] = useState({ id: '', code: '', discountType: 'percent', value: 0, isActive: true })
  const [discountForm, setDiscountForm] = useState({ id: '', name: '', targetType: 'all', targetId: '', discountType: 'percent', value: 0, isActive: true })
  const [productForm, setProductForm] = useState(emptyProductForm)
  const [search, setSearch] = useState('')
  const [pdvSearch, setPdvSearch] = useState('')
  const [pdvDiscount, setPdvDiscount] = useState(0)
  const [pdvCustomer, setPdvCustomer] = useState('')
  const [pdvCustomerSearch, setPdvCustomerSearch] = useState('')
  const [pdvCustomerResults, setPdvCustomerResults] = useState<AdminCustomer[]>([])
  const [pdvShowCustomers, setPdvShowCustomers] = useState(false)
  const [pdvPaymentMethod, setPdvPaymentMethod] = useState('cash')
  const [pdvCart, setPdvCart] = useState<PosLine[]>([])
  const [message, setMessage] = useState('')
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; action: (() => void) | null }>({ open: false, action: null })

  function notify(msg: string, tone: 'success' | 'error' = 'success') {
    setToast({ message: msg, tone })
    setMessage(msg)
  }

  async function updateOrderStatus(orderId: string, newStatus: string) {
    if (!token) return
    await api.put(`/admin/orders/${orderId}/status`, { status: newStatus }, token)
    notify('Status atualizado para ' + newStatus)
    await loadOrders()
  }

  function exportOrders() {
    if (!token) return
    window.open(`${import.meta.env.VITE_API_URL ?? '/api'}/admin/export/orders?token=${token}`, '_blank')
  }
  const [uploadingImage, setUploadingImage] = useState(false)
  const [productImages, setProductImages] = useState<Array<{ id: string; url: string }>>([])
  const [orderFilter, setOrderFilter] = useState({ search: '', status: '', payment: '', startDate: '', endDate: '' })
  const [orderPage, setOrderPage] = useState(1)
  const [orderTotal, setOrderTotal] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadAdminData() {
    if (!token) return
    const [dash, productList, customerList, options] = await Promise.all([
      api.get<Dashboard>('/admin/dashboard', token),
      api.get<Product[]>('/admin/products', token),
      api.get<AdminCustomer[]>('/admin/customers', token),
      api.get<CatalogData>('/admin/catalog-data', token),
    ])
    setDashboard(dash)
    setProducts(productList)
    setCustomers(customerList)
    setCatalogData(options)
    setProductTypes(options.productTypes)
    await loadOrders()
  }

  async function loadOrders() {
    if (!token) return
    const params = new URLSearchParams()
    if (orderFilter.search) params.set('search', orderFilter.search)
    if (orderFilter.status) params.set('status', orderFilter.status)
    if (orderFilter.payment) params.set('payment', orderFilter.payment)
    if (orderFilter.startDate) params.set('startDate', orderFilter.startDate)
    if (orderFilter.endDate) params.set('endDate', orderFilter.endDate)
    params.set('page', String(orderPage))
    params.set('limit', '50')
    const data = await api.get<{ orders: AdminOrder[]; total: number; page: number; limit: number }>(`/admin/orders?${params}`, token)
    setOrders(data.orders)
    setOrderTotal(data.total)
  }

  useEffect(() => {
    if (!token) {
      return
    }

    loadAdminData()

    const interval = window.setInterval(() => {
      api.get<Dashboard>('/admin/dashboard', token).then(setDashboard).catch(() => undefined)
    }, 30000)

    return () => window.clearInterval(interval)
  }, [token])

  useEffect(() => {
    if (token && activeTab === 'orders') {
      loadOrders()
    }
  }, [token, activeTab, orderFilter, orderPage])

  useEffect(() => {
    if (token && activeTab === 'catalog') {
      loadCatalog()
      loadMPSettings()
    }
  }, [token, activeTab])

  useEffect(() => {
    if (token && activeTab === 'marketing') {
      loadMarketing()
    }
  }, [token, activeTab])

  const filteredProducts = useMemo(() => {
    const normalized = search.toLowerCase()
    return products.filter((product) =>
      [product.name, product.brand, product.category, product.sku].some((value) => value.toLowerCase().includes(normalized)),
    )
  }, [products, search])

  const pdvProducts = useMemo(() => {
    const normalized = pdvSearch.toLowerCase()
    return products.filter((product) =>
      [product.name, product.sku].some((value) => value.toLowerCase().includes(normalized)),
    )
  }, [products, pdvSearch])

  const pdvTotal = useMemo(
    () => Math.max(0, pdvCart.reduce((sum, item) => sum + item.price * item.quantity, 0) - pdvDiscount),
    [pdvCart, pdvDiscount],
  )

  function handleProductChange(field: string, value: string | number | boolean) {
    setProductForm((current) => ({ ...current, [field]: value }))
  }

  async function handleImageUpload(file: File) {
    if (!token) return
    setUploadingImage(true)
    try {
      const url = await api.upload('/admin/upload', file, token)
      setProductForm((current) => ({ ...current, imageUrl: url }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao enviar imagem')
    } finally {
      setUploadingImage(false)
    }
  }

  async function loadProductImages(productId: string) {
    if (!token) return
    const images = await api.get<Array<{ id: string; url: string }>>(`/admin/products/${productId}/images`, token)
    setProductImages(images)
  }

  async function addProductImage(productId: string, imageUrl: string) {
    if (!token) return
    await api.post(`/admin/products/${productId}/images`, { imageUrl }, token)
    await loadProductImages(productId)
  }

  async function removeProductImage(productId: string, imageId: string) {
    if (!token) return
    await api.delete(`/admin/products/${productId}/images/${imageId}`, token)
    await loadProductImages(productId)
  }

  async function setAsMainImage(productId: string, imageUrl: string) {
    if (!token) return
    await api.put(`/admin/products/${productId}/main-image`, { imageUrl }, token)
    notify('Imagem principal atualizada.')
    await loadAdminData()
  }

  function startEdit(product: Product) {
    setActiveTab('products')
    loadProductImages(product.id)
    setProductForm({
      id: product.id,
      name: product.name,
      sku: product.sku,
      slug: product.slug,
      brandId: product.brandId || '',
      categoryId: product.categoryId || '',
      description: product.description,
      salePrice: product.salePrice,
      costPrice: product.costPrice,
      stockCurrent: product.stockCurrent,
      stockMinimum: product.stockMinimum,
      weightGrams: product.weightGrams,
      volumeMl: product.volumeMl,
      gender: product.gender,
      productType: product.productType,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
    })
  }

  async function handleProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return

    const payload = {
      ...productForm,
      salePrice: Number(productForm.salePrice),
      costPrice: Number(productForm.costPrice),
      stockCurrent: Number(productForm.stockCurrent),
      stockMinimum: Number(productForm.stockMinimum),
      weightGrams: Number(productForm.weightGrams),
      volumeMl: Number(productForm.volumeMl),
    }

    if (productForm.id) {
      await api.put(`/admin/products/${productForm.id}`, payload, token)
      setMessage('Produto atualizado com sucesso.')
    } else {
      await api.post('/admin/products', payload, token)
      setMessage('Produto criado com sucesso.')
    }

    setProductForm(emptyProductForm)
    await loadAdminData()
  }

  async function deactivateProduct(id: string) {
    if (!token) return
    await api.delete(`/admin/products/${id}`, token)
    setMessage('Produto inativado com sucesso.')
    await loadAdminData()
  }

  async function searchPdvCustomers(query: string) {
    setPdvCustomerSearch(query)
    setPdvShowCustomers(true)
    if (query.length < 2) {
      setPdvCustomerResults([])
      return
    }
    try {
      const results = await api.get<AdminCustomer[]>(`/admin/customers?search=${encodeURIComponent(query)}`, token!)
      setPdvCustomerResults(results)
    } catch {
      setPdvCustomerResults([])
    }
  }

  function selectPdvCustomer(customer: AdminCustomer) {
    setPdvCustomer(customer.name)
    setPdvCustomerSearch(customer.name)
    setPdvShowCustomers(false)
    setPdvCustomerResults([])
  }

  function addToPos(product: Product) {
    if (!product.isAvailable) return
    setPdvCart((current) => {
      const existing = current.find((item) => item.productId === product.id)
      if (existing) {
        return current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stockCurrent) }
            : item,
        )
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          price: product.finalPrice,
          quantity: 1,
          stockCurrent: product.stockCurrent,
          discountLabel: product.discountLabel,
        },
      ]
    })
  }

  async function finishPosSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    await api.post(
      '/admin/pos/sales',
      {
        customerName: pdvCustomer,
        paymentMethod: pdvPaymentMethod,
        discount: Number(pdvDiscount),
        items: pdvCart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      },
      token,
    )
    setMessage('Venda PDV registrada com sucesso.')
    setPdvCart([])
    setPdvDiscount(0)
    setPdvCustomer('')
    await loadAdminData()
  }

  async function loadCatalog() {
    if (!token) return
    const [brandsList, categoriesList, typesList] = await Promise.all([
      api.get<BrandItem[]>('/admin/brands', token),
      api.get<CategoryItem[]>('/admin/categories', token),
      api.get<string[]>('/admin/product-types', token),
    ])
    setBrands(brandsList)
    setCategories(categoriesList)
    setProductTypes(typesList)
  }

  async function handleBrandSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    if (brandForm.id) {
      await api.put(`/admin/brands/${brandForm.id}`, { name: brandForm.name }, token)
      setMessage('Marca atualizada.')
    } else {
      await api.post('/admin/brands', { name: brandForm.name }, token)
      setMessage('Marca criada.')
    }
    setBrandForm({ id: '', name: '' })
    await loadCatalog()
    await loadAdminData()
  }

  async function deleteBrand(id: string) {
    if (!token) return
    await api.delete(`/admin/brands/${id}`, token)
    setMessage('Marca removida.')
    await loadCatalog()
    await loadAdminData()
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    if (categoryForm.id) {
      await api.put(`/admin/categories/${categoryForm.id}`, { name: categoryForm.name }, token)
      setMessage('Categoria atualizada.')
    } else {
      await api.post('/admin/categories', { name: categoryForm.name }, token)
      setMessage('Categoria criada.')
    }
    setCategoryForm({ id: '', name: '' })
    await loadCatalog()
    await loadAdminData()
  }

  async function deleteCategory(id: string) {
    if (!token) return
    await api.delete(`/admin/categories/${id}`, token)
    setMessage('Categoria removida.')
    await loadCatalog()
    await loadAdminData()
  }

  async function addProductType() {
    if (!token || !newType.trim()) return
    const updated = [...productTypes, newType.trim()]
    await api.put('/admin/product-types', { types: updated }, token)
    setProductTypes(updated)
    setNewType('')
    setMessage('Tipo adicionado.')
    await loadAdminData()
  }

  async function removeProductType(type: string) {
    if (!token) return
    const updated = productTypes.filter((t) => t !== type)
    await api.put('/admin/product-types', { types: updated }, token)
    setProductTypes(updated)
    setMessage('Tipo removido.')
    await loadAdminData()
  }

  async function loadMPSettings() {
    if (!token) return
    const settings = await api.get<Record<string, string>>('/admin/mp-settings', token)
    setMpSettings({ mp_access_token: settings.mp_access_token || '', mp_public_key: settings.mp_public_key || '', mp_webhook_secret: settings.mp_webhook_secret || '' })
  }

  async function saveMPSetting(key: string, value: string) {
    if (!token) return
    await api.put('/admin/mp-settings', { key, value }, token)
    setMessage('Configuracao Mercado Pago salva.')
  }

  async function loadMarketing() {
    if (!token) return
    const [couponsList, rulesList] = await Promise.all([
      api.get<CouponItem[]>('/admin/coupons', token),
      api.get<DiscountRuleItem[]>('/admin/discount-rules', token),
    ])
    setCoupons(couponsList)
    setDiscountRules(rulesList)
  }

  async function handleCouponSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    if (couponForm.id) {
      await api.put(`/admin/coupons/${couponForm.id}`, { code: couponForm.code, discountType: couponForm.discountType, value: Number(couponForm.value), isActive: couponForm.isActive }, token)
      notify('Cupom atualizado.')
    } else {
      await api.post('/admin/coupons', { code: couponForm.code, discountType: couponForm.discountType, value: Number(couponForm.value), isActive: couponForm.isActive }, token)
      notify('Cupom criado.')
    }
    setCouponForm({ id: '', code: '', discountType: 'percent', value: 0, isActive: true })
    await loadMarketing()
  }

  async function deleteCoupon(id: string) {
    if (!token) return
    await api.delete(`/admin/coupons/${id}`, token)
    notify('Cupom removido.')
    await loadMarketing()
  }

  async function handleDiscountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    const payload = { name: discountForm.name, targetType: discountForm.targetType, targetId: discountForm.targetId, discountType: discountForm.discountType, value: Number(discountForm.value), isActive: discountForm.isActive }
    if (discountForm.id) {
      await api.put(`/admin/discount-rules/${discountForm.id}`, payload, token)
      notify('Regra atualizada.')
    } else {
      await api.post('/admin/discount-rules', payload, token)
      notify('Regra criada.')
    }
    setDiscountForm({ id: '', name: '', targetType: 'all', targetId: '', discountType: 'percent', value: 0, isActive: true })
    await loadMarketing()
  }

  async function deleteDiscountRule(id: string) {
    if (!token) return
    await api.delete(`/admin/discount-rules/${id}`, token)
    notify('Regra removida.')
    await loadMarketing()
  }

  useEffect(() => {
    if (token && activeTab === 'marketing') {
      loadMarketing()
    }
  }, [token, activeTab])

  const tabs: Array<{ id: AdminTab; label: string; icon: ReactNode }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'products', label: 'Produtos', icon: <Boxes size={16} /> },
    { id: 'catalog', label: 'Catalogo', icon: <PackageSearch size={16} /> },
    { id: 'orders', label: 'Pedidos', icon: <ShoppingCart size={16} /> },
    { id: 'customers', label: 'Clientes', icon: <Users size={16} /> },
    { id: 'marketing', label: 'Marketing', icon: <Percent size={16} /> },
    { id: 'pdv', label: 'PDV', icon: <CreditCard size={16} /> },
  ]

  return (
    <div className={`grid gap-6 ${activeTab === 'pdv' ? '' : 'xl:grid-cols-[250px_minmax(0,1fr)]'}`}>
      <aside className={activeTab === 'pdv' ? 'hidden' : 'surface-panel h-fit p-4 xl:sticky xl:top-24'}>
        <div className="space-y-2 px-2 py-2">
          <p className="eyebrow">Painel privado</p>
          <h1 className="text-4xl leading-none text-[#171412]">On Perfumaria</h1>
          <p className="text-sm leading-6 text-[#6b665f]">Operacao comercial, estoque, pedidos e PDV em uma unica interface.</p>
        </div>
        <div className="mt-5 grid gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex items-center gap-3 rounded-[20px] px-4 py-3 text-left text-sm font-semibold',
                activeTab === tab.id ? 'bg-[#171412] text-[#fafaf8]' : 'bg-[#f7f2eb] text-[#6b665f]',
              ].join(' ')}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        <div className="mt-5 px-2">
          <Button variant="secondary" fullWidth onClick={logout}>
            Sair
          </Button>
        </div>
      </aside>

      <div className="space-y-6">
        <Reveal>
          <section className="surface-panel p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow">Admin</p>
                <h2 className="mt-2 text-5xl leading-none text-[#171412]">Operacao da loja em tempo real</h2>
                <p className="mt-3 text-sm leading-7 text-[#6b665f]">
                  Ajustes aqui refletem no catalogo porque o frontend continua usando os mesmos endpoints reais.
                </p>
              </div>
              {message ? <Badge tone="success">{message}</Badge> : null}
            </div>
          </section>
        </Reveal>

        {activeTab === 'dashboard' && dashboard ? (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Metric label="Faturamento do dia" value={format(dashboard.revenueToday)} />
            <Metric label="Faturamento do mes" value={format(dashboard.revenueMonth)} />
            <Metric label="Pedidos pendentes" value={String(dashboard.pendingOrders)} />
            <Metric label="Pedidos pagos" value={String(dashboard.paidOrders)} />
            <Metric label="Estoque baixo" value={String(dashboard.lowStockProducts)} />
            <Metric label="Clientes" value={String(dashboard.customers)} />
          </section>
        ) : null}

        {activeTab === 'products' ? (
          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="surface-panel p-6">
              <h2 className="text-4xl leading-none text-[#171412]">{productForm.id ? 'Editar produto' : 'Novo produto'}</h2>
              <form className="mt-5 space-y-6" onSubmit={handleProductSubmit}>
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#b77717]">Imagem do produto</p>
                  <div className="flex flex-col gap-4">
                    {productForm.imageUrl ? (
                      <div className="relative w-full overflow-hidden rounded-[24px] border border-stone-200 bg-[#f7f2eb]">
                        <img src={productForm.imageUrl} alt="Preview" className="h-64 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleProductChange('imageUrl', '')}
                          className="absolute right-3 top-3 rounded-full bg-white/80 p-2 text-xs font-semibold text-rose-600 backdrop-blur"
                        >
                          Remover imagem
                        </button>
                      </div>
                    ) : null}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleImageUpload(file)
                      }}
                    />
                    <Button type="button" variant="secondary" fullWidth disabled={uploadingImage} onClick={() => fileInputRef.current?.click()}>
                      {uploadingImage ? 'Enviando...' : productForm.imageUrl ? 'Trocar imagem' : 'Selecionar imagem'}
                    </Button>
                    {productForm.id && productForm.imageUrl ? (
                      <Button type="button" variant="ghost" fullWidth size="sm" onClick={() => addProductImage(productForm.id, productForm.imageUrl)} disabled={productForm.imageUrl === productImages.find((i) => i.url === productForm.imageUrl)?.url && productImages.length > 0}>
                        Adicionar imagem a galeria
                      </Button>
                    ) : null}
                  </div>
                  {productImages.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {productImages.map((img) => (
                        <div key={img.id} className="relative">
                          <img src={img.url} alt="" className="h-16 w-16 rounded-[12px] object-cover" />
                          <button
                            type="button"
                            onClick={() => removeProductImage(productForm.id, img.id)}
                            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] text-white"
                          >
                            X
                          </button>
                          <button
                            type="button"
                            onClick={() => setAsMainImage(productForm.id, img.url)}
                            className="mt-1 block w-full text-center text-[10px] text-[#6b665f] hover:text-[#b77717]"
                          >
                            Principal
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#b77717]">Informacoes basicas</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <InputField value={productForm.name} onChange={(e) => handleProductChange('name', e.target.value)} label="Nome" required />
                    <InputField value={productForm.sku} onChange={(e) => handleProductChange('sku', e.target.value)} label="SKU" required />
                    <InputField value={productForm.slug} onChange={(e) => handleProductChange('slug', e.target.value)} label="Slug (gerado automatico)" placeholder="Deixe em branco para gerar do nome" />
                    <div />
                    <SelectField value={productForm.brandId} onChange={(e) => handleProductChange('brandId', e.target.value)} label="Marca">
                      <option value="">Selecione</option>
                      {catalogData.brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>{brand.name}</option>
                      ))}
                    </SelectField>
                    <SelectField value={productForm.categoryId} onChange={(e) => handleProductChange('categoryId', e.target.value)} label="Categoria">
                      <option value="">Selecione</option>
                      {catalogData.categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </SelectField>
                  </div>
                  <div className="mt-4">
                    <TextAreaField value={productForm.description} onChange={(e) => handleProductChange('description', e.target.value)} label="Descricao" />
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#b77717]">Precificacao</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <InputField type="number" value={productForm.salePrice} onChange={(e) => handleProductChange('salePrice', Number(e.target.value))} label="Preco de venda" />
                    <InputField type="number" value={productForm.costPrice} onChange={(e) => handleProductChange('costPrice', Number(e.target.value))} label="Custo interno (oculto)" />
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#b77717]">Estoque</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <InputField type="number" value={productForm.stockCurrent} onChange={(e) => handleProductChange('stockCurrent', Number(e.target.value))} label="Estoque atual" />
                    <InputField type="number" value={productForm.stockMinimum} onChange={(e) => handleProductChange('stockMinimum', Number(e.target.value))} label="Estoque minimo" />
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#b77717]">Detalhes</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <InputField type="number" value={productForm.weightGrams} onChange={(e) => handleProductChange('weightGrams', Number(e.target.value))} label="Peso (g)" />
                    <InputField type="number" value={productForm.volumeMl} onChange={(e) => handleProductChange('volumeMl', Number(e.target.value))} label="Volume (ml)" />
                    <SelectField value={productForm.gender} onChange={(e) => handleProductChange('gender', e.target.value)} label="Genero">
                      <option value="masculino">Masculino</option>
                      <option value="feminino">Feminino</option>
                      <option value="unissex">Unissex</option>
                    </SelectField>
                    <SelectField value={productForm.productType} onChange={(e) => handleProductChange('productType', e.target.value)} label="Tipo">
                      {catalogData.productTypes.map((type) => (
                        <option key={type} value={type.toLowerCase().replace(/\s+/g, '_')}>{type}</option>
                      ))}
                    </SelectField>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="surface-soft flex items-center gap-3 px-4 py-4 text-sm text-[#171412]">
                    <input type="checkbox" checked={productForm.isActive} onChange={(e) => handleProductChange('isActive', e.target.checked)} />
                    Produto ativo
                  </label>
                  <label className="surface-soft flex items-center gap-3 px-4 py-4 text-sm text-[#171412]">
                    <input type="checkbox" checked={productForm.isFeatured} onChange={(e) => handleProductChange('isFeatured', e.target.checked)} />
                    Destacar na loja
                  </label>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="submit" fullWidth>{productForm.id ? 'Salvar alteracoes' : 'Criar produto'}</Button>
                  <Button type="button" variant="secondary" fullWidth onClick={() => setProductForm(emptyProductForm)}>
                    Limpar formulario
                  </Button>
                </div>
              </form>
            </div>

            <div className="space-y-5">
              <div className="surface-panel p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-4xl leading-none text-[#171412]">Produtos</h2>
                  <label className="surface-soft flex items-center gap-3 px-4 py-3 sm:min-w-[280px]">
                    <Search size={16} className="text-[#6b665f]" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou codigo" className="w-full bg-transparent text-sm outline-none" />
                  </label>
                </div>
              </div>

              <AdminTable columns={['Produto', 'Categoria', 'Preco', 'Acoes']}>
                {filteredProducts.map((product) => (
                  <div key={product.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_1fr_1fr_0.9fr] md:items-center">
                    <div>
                      <p className="font-semibold text-[#171412]">{product.name}</p>
                      <p className="text-sm text-[#6b665f]">{product.brand}</p>
                    </div>
                    <div className="text-sm text-[#6b665f]">{product.category}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#171412]">{format(product.finalPrice)}</span>
                      <Badge tone={product.stockCurrent <= product.stockMinimum ? 'danger' : 'success'}>
                        {product.stockCurrent} un.
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={() => startEdit(product)}>Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete({ open: true, action: () => deactivateProduct(product.id) })}>Inativar</Button>
                    </div>
                  </div>
                ))}
              </AdminTable>
            </div>
          </section>
        ) : null}

        {activeTab === 'catalog' ? (
          <section className="grid gap-6 xl:grid-cols-3">
            <div className="surface-panel p-6">
              <h2 className="mb-5 text-3xl leading-none text-[#171412]">Marcas</h2>
              <form className="mb-4 flex gap-2" onSubmit={handleBrandSubmit}>
                <input
                  value={brandForm.name}
                  onChange={(e) => setBrandForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nome da marca"
                  className="field-base flex-1"
                  required
                />
                <Button type="submit" size="sm">{brandForm.id ? 'Salvar' : 'Adicionar'}</Button>
                {brandForm.id ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setBrandForm({ id: '', name: '' })}>Cancelar</Button>
                ) : null}
              </form>
              <div className="max-h-[400px] space-y-2 overflow-auto">
                {brands.map((brand) => (
                  <div key={brand.id} className="flex items-center justify-between rounded-[18px] bg-[#f7f2eb] px-4 py-3">
                    <span className="text-sm font-semibold text-[#171412]">{brand.name}</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setBrandForm({ id: brand.id, name: brand.name })}>Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete({ open: true, action: () => deleteBrand(brand.id) })}>Remover</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-panel p-6">
              <h2 className="mb-5 text-3xl leading-none text-[#171412]">Categorias</h2>
              <form className="mb-4 flex gap-2" onSubmit={handleCategorySubmit}>
                <input
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nome da categoria"
                  className="field-base flex-1"
                  required
                />
                <Button type="submit" size="sm">{categoryForm.id ? 'Salvar' : 'Adicionar'}</Button>
                {categoryForm.id ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCategoryForm({ id: '', name: '' })}>Cancelar</Button>
                ) : null}
              </form>
              <div className="max-h-[400px] space-y-2 overflow-auto">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between rounded-[18px] bg-[#f7f2eb] px-4 py-3">
                    <span className="text-sm font-semibold text-[#171412]">{category.name}</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setCategoryForm({ id: category.id, name: category.name })}>Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete({ open: true, action: () => deleteCategory(category.id) })}>Remover</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-panel p-6">
              <h2 className="mb-5 text-3xl leading-none text-[#171412]">Tipos de produto</h2>
              <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); addProductType() }}>
                <input
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  placeholder="Nome do tipo"
                  className="field-base flex-1"
                  required
                />
                <Button type="submit" size="sm">Adicionar</Button>
              </form>
              <div className="max-h-[400px] space-y-2 overflow-auto">
                {productTypes.map((type) => (
                  <div key={type} className="flex items-center justify-between rounded-[18px] bg-[#f7f2eb] px-4 py-3">
                    <span className="text-sm font-semibold text-[#171412]">{type}</span>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete({ open: true, action: () => removeProductType(type) })}>Remover</Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="surface-panel p-6 xl:col-span-3">
              <h2 className="mb-5 text-3xl leading-none text-[#171412]">Mercado Pago</h2>
              <p className="mb-4 text-sm text-[#6b665f]">Configure suas credenciais do Mercado Pago para ativar pagamentos online. O webhook e automaticamente registrado.</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#6b665f]">Access Token</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={mpSettings.mp_access_token}
                      onChange={(e) => setMpSettings((s) => ({ ...s, mp_access_token: e.target.value }))}
                      placeholder="APP_USR-..."
                      className="field-base flex-1"
                    />
                    <Button type="button" size="sm" onClick={() => saveMPSetting('mp_access_token', mpSettings.mp_access_token)}>Salvar</Button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#6b665f]">Public Key</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={mpSettings.mp_public_key}
                      onChange={(e) => setMpSettings((s) => ({ ...s, mp_public_key: e.target.value }))}
                      placeholder="APP_USR-..."
                      className="field-base flex-1"
                    />
                    <Button type="button" size="sm" onClick={() => saveMPSetting('mp_public_key', mpSettings.mp_public_key)}>Salvar</Button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'orders' ? (
          <section className="surface-panel p-6">
            <div className="mb-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <PackageSearch size={18} className="text-[#b77717]" />
                <h2 className="text-4xl leading-none text-[#171412]">Pedidos {orderTotal > 0 ? `(${orderTotal})` : ''}</h2>
                <Button variant="secondary" size="sm" onClick={exportOrders}>Exportar CSV</Button>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <input
                  value={orderFilter.search}
                  onChange={(e) => { setOrderFilter((f) => ({ ...f, search: e.target.value })); setOrderPage(1) }}
                  placeholder="Buscar cliente ou ID"
                  className="field-base min-w-[200px]"
                />
                <select
                  value={orderFilter.status}
                  onChange={(e) => { setOrderFilter((f) => ({ ...f, status: e.target.value })); setOrderPage(1) }}
                  className="field-base"
                >
                  <option value="">Todos status</option>
                  <option value="aguardando_pagamento">Aguardando pagamento</option>
                  <option value="pago">Pago</option>
                  <option value="enviado">Enviado</option>
                  <option value="entregue">Entregue</option>
                  <option value="cancelado">Cancelado</option>
                </select>
                <select
                  value={orderFilter.payment}
                  onChange={(e) => { setOrderFilter((f) => ({ ...f, payment: e.target.value })); setOrderPage(1) }}
                  className="field-base"
                >
                  <option value="">Todos pagamentos</option>
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                </select>
                <input
                  type="date"
                  value={orderFilter.startDate}
                  onChange={(e) => { setOrderFilter((f) => ({ ...f, startDate: e.target.value })); setOrderPage(1) }}
                  className="field-base"
                  placeholder="Data inicio"
                />
                <input
                  type="date"
                  value={orderFilter.endDate}
                  onChange={(e) => { setOrderFilter((f) => ({ ...f, endDate: e.target.value })); setOrderPage(1) }}
                  className="field-base"
                  placeholder="Data fim"
                />
              </div>
            </div>
            <AdminTable columns={['Cliente', 'Data', 'Total', 'Status', 'Acoes']}>
              {orders.map((order) => (
                <div key={order.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_0.8fr_0.7fr_0.8fr_0.7fr] md:items-center">
                  <div>
                    <p className="font-semibold text-[#171412]">{order.customerName || 'Cliente sem nome'}</p>
                    <p className="text-sm text-[#6b665f]">#{order.id.slice(0, 8)}</p>
                  </div>
                  <div className="text-sm text-[#6b665f]">{new Date(order.createdAt).toLocaleDateString('pt-BR')}</div>
                  <div className="font-semibold text-[#171412]">{format(order.total)}</div>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone="success">{order.paymentStatus}</Badge>
                    <Badge>{order.orderStatus}</Badge>
                    <Badge tone={order.origin === 'pdv' ? 'amber' : 'neutral'}>{order.origin === 'pdv' ? 'PDV' : 'Online'}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {order.orderStatus === 'aguardando_pagamento' && order.paymentStatus === 'paid' ? (
                      <Button variant="ghost" size="sm" onClick={() => updateOrderStatus(order.id, 'pago')}>Marcar pago</Button>
                    ) : null}
                    {order.orderStatus === 'pago' ? (
                      <Button variant="ghost" size="sm" onClick={() => updateOrderStatus(order.id, 'enviado')}>Enviar</Button>
                    ) : null}
                    {order.orderStatus === 'enviado' ? (
                      <Button variant="ghost" size="sm" onClick={() => updateOrderStatus(order.id, 'entregue')}>Entregue</Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </AdminTable>
            {orderTotal > 50 ? (
              <div className="mt-4 flex items-center justify-center gap-4">
                <Button variant="secondary" size="sm" disabled={orderPage <= 1} onClick={() => setOrderPage((p) => p - 1)}>Anterior</Button>
                <span className="text-sm text-[#6b665f]">Pagina {orderPage}</span>
                <Button variant="secondary" size="sm" disabled={orderPage * 50 >= orderTotal} onClick={() => setOrderPage((p) => p + 1)}>Proximo</Button>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === 'customers' ? (
          <section className="surface-panel p-6">
            <div className="mb-5 flex items-center gap-3">
              <Users size={18} className="text-[#b77717]" />
              <h2 className="text-4xl leading-none text-[#171412]">Base de clientes</h2>
            </div>
            <AdminTable columns={['Cliente', 'Contato', 'Cadastro', 'Documento']}>
              {customers.map((customer) => (
                <div key={customer.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_1fr_1fr_0.9fr] md:items-center">
                  <div>
                    <p className="font-semibold text-[#171412]">{customer.name}</p>
                    <p className="text-sm text-[#6b665f]">{customer.email}</p>
                  </div>
                  <div className="text-sm text-[#6b665f]">{customer.phone}</div>
                  <div className="text-sm text-[#6b665f]">{new Date(customer.createdAt).toLocaleDateString('pt-BR')}</div>
                  <div className="text-sm text-[#6b665f]">{customer.cpf || 'Nao informado'}</div>
                </div>
              ))}
            </AdminTable>
          </section>
        ) : null}

        {activeTab === 'marketing' ? (
          <section className="grid gap-6 xl:grid-cols-2">
            <div className="surface-panel p-6">
              <h2 className="mb-5 text-3xl leading-none text-[#171412]">Cupons</h2>
              <form className="mb-4 grid gap-3" onSubmit={handleCouponSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={couponForm.code} onChange={(e) => setCouponForm((f) => ({ ...f, code: e.target.value }))} placeholder="Codigo (ex: BEMVINDO10)" className="field-base" required />
                  <SelectField value={couponForm.discountType} onChange={(e) => setCouponForm((f) => ({ ...f, discountType: e.target.value }))} label="Tipo">
                    <option value="percent">Percentual (%)</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </SelectField>
                  <input type="number" value={couponForm.value} onChange={(e) => setCouponForm((f) => ({ ...f, value: Number(e.target.value) }))} placeholder="Valor" className="field-base" required />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={couponForm.isActive} onChange={(e) => setCouponForm((f) => ({ ...f, isActive: e.target.checked }))} />
                    Ativo
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm">{couponForm.id ? 'Salvar' : 'Criar'}</Button>
                  {couponForm.id ? <Button type="button" variant="ghost" size="sm" onClick={() => setCouponForm({ id: '', code: '', discountType: 'percent', value: 0, isActive: true })}>Cancelar</Button> : null}
                </div>
              </form>
              <div className="space-y-2">
                {coupons.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-[18px] bg-[#f7f2eb] px-4 py-3">
                    <div>
                      <span className="font-semibold text-[#171412]">{c.code}</span>
                      <span className="ml-2 text-sm text-[#6b665f]">{c.discountType === 'percent' ? `${c.value}%` : format(c.value)} {c.isActive ? '' : '(inativo)'}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setCouponForm({ id: c.id, code: c.code, discountType: c.discountType, value: c.value, isActive: c.isActive })}>Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete({ open: true, action: () => deleteCoupon(c.id) })}>Remover</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-panel p-6">
              <h2 className="mb-5 text-3xl leading-none text-[#171412]">Regras de desconto</h2>
              <form className="mb-4 grid gap-3" onSubmit={handleDiscountSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={discountForm.name} onChange={(e) => setDiscountForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome da regra" className="field-base" required />
                  <SelectField value={discountForm.targetType} onChange={(e) => setDiscountForm((f) => ({ ...f, targetType: e.target.value, targetId: '' }))} label="Aplicar a">
                    <option value="all">Todos os produtos</option>
                    <option value="brand">Marca</option>
                    <option value="category">Categoria</option>
                  </SelectField>
                  {discountForm.targetType !== 'all' ? (
                    <SelectField value={discountForm.targetId} onChange={(e) => setDiscountForm((f) => ({ ...f, targetId: e.target.value }))} label={discountForm.targetType === 'brand' ? 'Marca' : 'Categoria'}>
                      <option value="">Selecione</option>
                      {(discountForm.targetType === 'brand' ? catalogData.brands : catalogData.categories).map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </SelectField>
                  ) : <div />}
                  <SelectField value={discountForm.discountType} onChange={(e) => setDiscountForm((f) => ({ ...f, discountType: e.target.value }))} label="Tipo">
                    <option value="percent">Percentual (%)</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </SelectField>
                  <input type="number" value={discountForm.value} onChange={(e) => setDiscountForm((f) => ({ ...f, value: Number(e.target.value) }))} placeholder="Valor" className="field-base" required />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={discountForm.isActive} onChange={(e) => setDiscountForm((f) => ({ ...f, isActive: e.target.checked }))} />
                    Ativo
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm">{discountForm.id ? 'Salvar' : 'Criar'}</Button>
                  {discountForm.id ? <Button type="button" variant="ghost" size="sm" onClick={() => setDiscountForm({ id: '', name: '', targetType: 'all', targetId: '', discountType: 'percent', value: 0, isActive: true })}>Cancelar</Button> : null}
                </div>
              </form>
              <div className="space-y-2">
                {discountRules.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-[18px] bg-[#f7f2eb] px-4 py-3">
                    <div>
                      <span className="font-semibold text-[#171412]">{r.name}</span>
                      <span className="ml-2 text-sm text-[#6b665f]">{r.targetName} - {r.discountType === 'percent' ? `${r.value}%` : format(r.value)} {r.isActive ? '' : '(inativo)'}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setDiscountForm({ id: r.id, name: r.name, targetType: r.targetType, targetId: r.targetId, discountType: r.discountType, value: r.value, isActive: r.isActive })}>Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete({ open: true, action: () => deleteDiscountRule(r.id) })}>Remover</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'pdv' ? (
          <section className="grid gap-4 lg:gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="surface-panel flex flex-col p-4 sm:p-6">
              <div className="mb-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={[
                        'flex items-center gap-2 rounded-[20px] px-3 py-2 text-xs font-semibold transition',
                        activeTab === tab.id
                          ? 'bg-[#171412] text-[#fafaf8]'
                          : 'bg-[#f7f2eb] text-[#6b665f] hover:bg-stone-200',
                      ].join(' ')}
                    >
                      {tab.icon}
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>
                <label className="surface-soft flex w-full items-center gap-3 px-3 py-3 sm:min-w-[280px]">
                  <Search size={16} className="shrink-0 text-[#6b665f]" />
                  <input value={pdvSearch} onChange={(e) => setPdvSearch(e.target.value)} placeholder="Buscar nome ou SKU" className="w-full min-w-0 bg-transparent text-sm outline-none" />
                </label>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                {pdvProducts.length === 0 ? (
                  <p className="py-12 text-center text-sm text-[#6b665f]">{pdvSearch ? 'Nenhum produto encontrado' : 'Carregando produtos...'}</p>
                ) : (
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                    {pdvProducts.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => addToPos(product)}
                        disabled={!product.isAvailable}
                        className="surface-soft flex flex-col text-left transition hover:scale-[1.02] disabled:opacity-40"
                      >
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="aspect-[4/3] w-full rounded-t-[28px] object-cover sm:rounded-[28px] sm:rounded-b-none"
                          />
                        ) : (
                          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-t-[28px] bg-[#f7f2eb] sm:rounded-[28px] sm:rounded-b-none">
                            <span className="text-4xl text-stone-300">N/A</span>
                          </div>
                        )}
                        <div className="p-3 sm:p-4">
                          <p className="text-sm font-semibold leading-tight text-[#171412] sm:text-base">{product.name}</p>
                          <div className="mt-2 flex items-end justify-between gap-1">
                            <div>
                              {product.finalPrice < product.salePrice ? (
                                <p className="text-xs text-stone-400 line-through">{format(product.salePrice)}</p>
                              ) : null}
                              <p className={`font-bold text-[#b77717] ${product.finalPrice < product.salePrice ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'}`}>{format(product.finalPrice)}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${product.isAvailable ? 'bg-[#eefaf5] text-[#0f8a5f]' : 'bg-stone-100 text-stone-400'}`}>
                              {product.isAvailable ? product.stockCurrent : '0'}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="surface-panel flex flex-col p-4 sm:p-6">
              <h2 className="text-2xl leading-none text-[#171412] sm:text-3xl">Carrinho</h2>
              <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-auto">
                <form className="flex flex-1 flex-col space-y-4" onSubmit={finishPosSale}>
                  <div className="relative">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#6b665f]">Cliente</label>
                    <input
                      value={pdvCustomerSearch}
                      onChange={(e) => { searchPdvCustomers(e.target.value); setPdvCustomer(e.target.value) }}
                      onFocus={() => { if (pdvCustomerSearch.length >= 2) setPdvShowCustomers(true) }}
                      onBlur={() => setTimeout(() => setPdvShowCustomers(false), 200)}
                      placeholder="Buscar cliente pelo nome ou telefone"
                      className="field-base w-full"
                      autoComplete="off"
                    />
                    {pdvShowCustomers && pdvCustomerResults.length > 0 ? (
                      <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-[18px] border border-stone-200 bg-white shadow-lg">
                        {pdvCustomerResults.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onMouseDown={() => selectPdvCustomer(customer)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-[#f7f2eb]"
                          >
                            <div>
                              <p className="font-semibold text-[#171412]">{customer.name}</p>
                              <p className="text-xs text-[#6b665f]">{customer.phone}</p>
                            </div>
                            {customer.cpf ? <span className="text-xs text-[#6b665f]">{customer.cpf}</span> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {pdvShowCustomers && pdvCustomerSearch.length >= 2 && pdvCustomerResults.length === 0 ? (
                      <div className="absolute z-20 mt-1 w-full rounded-[18px] border border-stone-200 bg-white px-4 py-3 text-sm text-[#6b665f] shadow-lg">
                        Nenhum cliente encontrado
                      </div>
                    ) : null}
                  </div>
                  <div className="flex-1 space-y-3 overflow-auto">
                    {pdvCart.length === 0 ? (
                      <p className="py-8 text-center text-sm text-[#6b665f]">Toque nos produtos ao lado para adicionar ao carrinho</p>
                    ) : (
                      pdvCart.map((item) => (
                        <div key={item.productId} className="surface-soft p-3 sm:p-4">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-[#171412] sm:text-base">{item.name}</p>
                                <p className="text-xs text-[#6b665f] sm:text-sm">{format(item.price)} / un.</p>
                                {item.discountLabel ? <p className="text-xs text-[#0f8a5f]">{item.discountLabel}</p> : null}
                              </div>
                              <p className="shrink-0 text-base font-bold text-[#171412] sm:text-lg">{format(item.price * item.quantity)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                max={item.stockCurrent}
                                value={item.quantity}
                                onChange={(e) =>
                                  setPdvCart((current) =>
                                    current.map((line) =>
                                      line.productId === item.productId ? { ...line, quantity: Number(e.target.value) } : line,
                                    ),
                                  )
                                }
                                className="field-base w-16 sm:w-20"
                              />
                              <Button type="button" variant="ghost" size="sm" onClick={() => setPdvCart((current) => current.filter((line) => line.productId !== item.productId))}>
                                Remover
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <InputField type="number" value={pdvDiscount} onChange={(e) => setPdvDiscount(Number(e.target.value))} label="Desconto manual" />
                  <SelectField value={pdvPaymentMethod} onChange={(e) => setPdvPaymentMethod(e.target.value)} label="Pagamento">
                    <option value="cash">Dinheiro</option>
                    <option value="pix">Pix</option>
                    <option value="card_debit">Cartao de debito</option>
                    <option value="card_credit">Cartao de credito</option>
                  </SelectField>
                  <div className="rounded-[24px] bg-[#171412] px-5 py-4 text-[#fafaf8] sm:py-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f6dba5]">Total final</p>
                    <p className="mt-1 text-3xl sm:mt-2 sm:text-4xl">{format(pdvTotal)}</p>
                  </div>
                  <Button type="submit" fullWidth size="lg" disabled={pdvCart.length === 0}>
                    Finalizar venda
                  </Button>
                  {message ? <p className="rounded-[22px] border border-stone-200 bg-[#f7f2eb] px-4 py-3 text-sm text-[#6b665f]">{message}</p> : null}
                </form>
              </div>
            </div>
          </section>
        ) : null}
      </div>
      {toast ? <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} /> : null}
      <ConfirmDialog
        open={confirmDelete.open}
        title="Confirmar exclusao"
        onConfirm={() => { confirmDelete.action?.(); setConfirmDelete({ open: false, action: null }) }}
        onCancel={() => setConfirmDelete({ open: false, action: null })}
      >
        Tem certeza que deseja excluir este item? Esta acao nao pode ser desfeita.
      </ConfirmDialog>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-panel p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6b665f]">{label}</p>
      <p className="mt-3 text-4xl leading-none text-[#171412]">{value}</p>
    </div>
  )
}
