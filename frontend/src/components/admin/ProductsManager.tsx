import {
  Camera,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  Package,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import {
  generateItemSku,
  normalizeOrganizerSearch,
  type OrganizerNode,
  type OrganizerTag,
} from '../../types/organizer'
import type { CreateOrganizerNodeInput } from '../../hooks/useOrganizerStore'
import { Button } from '../Button'
import { ConfirmDialog } from '../ConfirmDialog'
import { itemIcons } from '../item/icons'

/** Categorias = paginas do site. A tag com o mesmo nome coloca o produto la. */
const CATEGORIES = [
  { key: 'arabes', label: 'Árabes', names: ['arabes', 'arabe'], color: '#d89a28' },
  { key: 'feminino', label: 'Feminino', names: ['feminino'], color: '#e11d48' },
  { key: 'masculino', label: 'Masculino', names: ['masculino'], color: '#2563eb' },
  { key: 'importados', label: 'Importados', names: ['importados', 'importado'], color: '#0f8a5f' },
  { key: 'unissex', label: 'Unissex', names: ['unissex', 'unisex'], color: '#9b3fd6' },
] as const

type CategoryKey = (typeof CATEGORIES)[number]['key']

function categoryTag(tags: OrganizerTag[], key: CategoryKey) {
  const names: readonly string[] = CATEGORIES.find((category) => category.key === key)?.names ?? []
  return tags.find((tag) => names.includes(normalizeOrganizerSearch(tag.name)))
}

function isCategoryTag(tag: OrganizerTag) {
  const name = normalizeOrganizerSearch(tag.name)
  return CATEGORIES.some((category) => (category.names as readonly string[]).includes(name))
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function isPublished(node: OrganizerNode) {
  return node.status !== 'draft'
}

/** Foto do celular chega com 3-5 MB; reduz para no maximo 1200px em JPEG
 * antes de guardar, senao a loja inteira fica pesada para todo cliente. */
function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('error', () => reject(reader.error))
    reader.addEventListener('load', () => {
      const original = String(reader.result)
      const image = new Image()
      image.addEventListener('error', () => resolve(original))
      image.addEventListener('load', () => {
        const scale = Math.min(1, 1200 / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.width * scale)
        canvas.height = Math.round(image.height * scale)
        const context = canvas.getContext('2d')
        if (!context) return resolve(original)
        context.fillStyle = '#fff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        const compressed = canvas.toDataURL('image/jpeg', 0.82)
        resolve(compressed.length < original.length ? compressed : original)
      })
      image.src = original
    })
    reader.readAsDataURL(file)
  })
}

type Props = {
  nodes: OrganizerNode[]
  tags: OrganizerTag[]
  onCreateNode: (input: CreateOrganizerNodeInput) => string
  onUpdateNode: (id: string, updates: Partial<OrganizerNode>) => void
  onDeleteNode: (id: string) => void
  onCreateTag: (name: string, color: string) => string
}

/** Todos os produtos da loja, separados por categoria, com cadastro rapido. */
export function ProductsManager({
  nodes,
  tags,
  onCreateNode,
  onUpdateNode,
  onDeleteNode,
  onCreateTag,
}: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<CategoryKey | 'all' | 'none' | 'featured'>('all')
  const [editing, setEditing] = useState<OrganizerNode | 'new' | null>(null)

  const products = useMemo(() => {
    const term = normalizeOrganizerSearch(query.trim())
    return nodes
      .filter((node) => node.type === 'item')
      .filter(
        (node) =>
          !term ||
          normalizeOrganizerSearch(`${node.name} ${node.brand ?? ''} ${node.sku ?? ''}`).includes(term),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [nodes, query])

  const groups = useMemo(() => {
    type Group = { key: CategoryKey | 'none'; label: string; color: string; items: OrganizerNode[] }
    const list: Group[] = CATEGORIES.map((category) => {
      const tag = categoryTag(tags, category.key)
      return {
        key: category.key,
        label: category.label,
        color: category.color,
        items: tag ? products.filter((node) => node.tagIds.includes(tag.id)) : [],
      }
    })
    const categoryIds = new Set(tags.filter(isCategoryTag).map((tag) => tag.id))
    list.push({
      key: 'none',
      label: 'Sem categoria',
      color: '#9b86a8',
      items: products.filter((node) => !node.tagIds.some((id) => categoryIds.has(id))),
    })
    return list
  }, [products, tags])

  const featuredCount = products.filter((node) => node.featured).length
  const visibleGroups =
    filter === 'featured'
      ? [
          {
            key: 'featured',
            label: 'Em destaque',
            color: '#d89a28',
            items: products.filter((node) => node.featured),
          },
        ]
      : groups.filter((group) => (filter === 'all' ? group.items.length > 0 : group.key === filter))

  const current =
    editing === 'new' ? null : editing ? (nodes.find((node) => node.id === editing.id) ?? null) : null

  return (
    <div className="space-y-4">
      <section className="organizer-surface space-y-3 bg-white p-4">
        <div className="flex gap-2">
          <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#ddc7ea] bg-[#fbf7fd] px-4 focus-within:border-[#9b3fd6]">
            <Search size={16} className="shrink-0 text-[#9b86a8]" />
            <span className="sr-only">Buscar produto</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome, marca ou código"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9b86a8]"
            />
          </label>
          <Button onClick={() => setEditing('new')} className="shrink-0">
            <Plus size={17} /> <span className="hidden sm:inline">Novo produto</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
            Todos ({products.length})
          </Chip>
          <Chip active={filter === 'featured'} onClick={() => setFilter('featured')}>
            <Star size={12} className="fill-current" /> Destaques ({featuredCount})
          </Chip>
          {groups.map((group) =>
            group.key === 'none' && group.items.length === 0 ? null : (
              <Chip key={group.key} active={filter === group.key} onClick={() => setFilter(group.key)}>
                {group.label} ({group.items.length})
              </Chip>
            ),
          )}
        </div>
      </section>

      {visibleGroups.map((group) => (
        <section key={group.key} className="organizer-surface overflow-hidden bg-white">
          <header className="flex items-center gap-2 border-b border-[#f3e9f7] px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: group.color }} />
            <h3 className="flex-1 text-base font-semibold text-[#2a0f3d]">{group.label}</h3>
            <span className="text-xs font-bold text-[#9b86a8]">{group.items.length}</span>
          </header>
          {group.items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[#9b86a8]">Nenhum produto aqui ainda.</p>
          ) : (
            <ul className="divide-y divide-[#f3e9f7]">
              {group.items.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  onOpen={() => setEditing(product)}
                  onToggleFeatured={() => onUpdateNode(product.id, { featured: !product.featured })}
                  onTogglePublished={() =>
                    onUpdateNode(product.id, {
                      status: isPublished(product)
                        ? 'draft'
                        : product.stock === 0
                          ? 'coming-soon'
                          : 'published',
                    })
                  }
                />
              ))}
            </ul>
          )}
        </section>
      ))}

      {products.length === 0 ? (
        <div className="rounded-[22px] bg-white p-8 text-center">
          <Package size={30} className="mx-auto text-[#c9a4e2]" />
          <p className="mt-2 text-sm text-[#6b665f]">
            {query ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado ainda.'}
          </p>
        </div>
      ) : null}

      {editing ? (
        <ProductEditor
          key={current?.id ?? 'new'}
          product={current}
          tags={tags}
          onClose={() => setEditing(null)}
          onCreateTag={onCreateTag}
          onSave={(values) => {
            if (current) onUpdateNode(current.id, values)
            else
              onCreateNode({
                ...values,
                name: values.name ?? '',
                type: 'item',
                parentId: 'itens',
                sku: generateItemSku(),
              })
            setEditing(null)
          }}
          onDelete={
            current
              ? () => {
                  onDeleteNode(current.id)
                  setEditing(null)
                }
              : undefined
          }
        />
      ) : null}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-xs font-bold transition ${
        active ? 'bg-[#2a0f3d] text-white' : 'bg-[#f6ecfc] text-[#5b247f] hover:bg-[#efdcf9]'
      }`}
    >
      {children}
    </button>
  )
}

function ProductRow({
  product,
  onOpen,
  onToggleFeatured,
  onTogglePublished,
}: {
  product: OrganizerNode
  onOpen: () => void
  onToggleFeatured: () => void
  onTogglePublished: () => void
}) {
  const published = isPublished(product)
  const stockText =
    typeof product.stock !== 'number'
      ? null
      : product.stock === 0
        ? 'Esgotado'
        : `${product.stock} em estoque`
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[#f6ecfc]">
          <img
            src={product.imageUrl || itemIcons.frascoGold}
            alt=""
            className={`h-full w-full ${product.imageUrl ? 'object-cover' : 'object-contain p-2.5'}`}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-sm font-semibold ${published ? 'text-[#2a0f3d]' : 'text-[#9b86a8]'}`}
          >
            {product.name}
          </span>
          <span className="block truncate text-xs text-[#6b665f]">
            {[product.brand, product.volumeMl ? `${product.volumeMl} ml` : ''].filter(Boolean).join(' · ') ||
              'Sem marca'}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-xs">
            <b className="text-[#5b247f]">{money(product.price)}</b>
            {stockText ? (
              <span className={product.stock === 0 ? 'font-bold text-rose-600' : 'text-[#9b86a8]'}>
                {stockText}
              </span>
            ) : null}
            {!published ? (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-500">
                Oculto
              </span>
            ) : null}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onToggleFeatured}
        aria-pressed={Boolean(product.featured)}
        aria-label={product.featured ? 'Tirar dos destaques' : 'Colocar nos destaques'}
        title={product.featured ? 'Em destaque na home' : 'Destacar na home'}
        className={`icon-pop flex h-10 w-10 items-center justify-center rounded-full ${
          product.featured ? 'bg-[#fff1d6] text-[#d89a28]' : 'text-[#d9c2e8] hover:bg-[#f6ecfc]'
        }`}
      >
        <Star size={18} className={product.featured ? 'fill-current' : ''} />
      </button>
      <button
        type="button"
        onClick={onTogglePublished}
        aria-label={published ? 'Esconder do site' : 'Mostrar no site'}
        title={published ? 'Visível no site' : 'Escondido do site'}
        className={`icon-pop flex h-10 w-10 items-center justify-center rounded-full ${
          published ? 'text-[#6a2a94] hover:bg-[#f6ecfc]' : 'text-[#c9a4e2]'
        }`}
      >
        {published ? <Eye size={18} /> : <EyeOff size={18} />}
      </button>
    </li>
  )
}

type EditorValues = Partial<OrganizerNode>

function ProductEditor({
  product,
  tags,
  onClose,
  onSave,
  onDelete,
  onCreateTag,
}: {
  product: OrganizerNode | null
  tags: OrganizerTag[]
  onClose: () => void
  onSave: (values: EditorValues) => void
  onDelete?: () => void
  onCreateTag: (name: string, color: string) => string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<string[]>(
    product ? (product.images?.length ? product.images : [product.imageUrl].filter(Boolean)) : [],
  )
  const [name, setName] = useState(product?.name ?? '')
  const [brand, setBrand] = useState(product?.brand ?? '')
  const [price, setPrice] = useState(product?.price ? String(product.price).replace('.', ',') : '')
  const [stock, setStock] = useState(typeof product?.stock === 'number' ? String(product.stock) : '')
  const [volume, setVolume] = useState(product?.volumeMl ? String(product.volumeMl) : '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [tagIds, setTagIds] = useState<string[]>(product?.tagIds ?? [])
  const [featured, setFeatured] = useState(Boolean(product?.featured))
  const [published, setPublished] = useState(product ? isPublished(product) : true)
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  const otherTags = tags.filter((tag) => !isCategoryTag(tag))

  const toggleCategory = (key: CategoryKey) => {
    const category = CATEGORIES.find((item) => item.key === key)!
    const existing = categoryTag(tags, key)
    // A categoria ainda nao tem tag: cria na hora com o nome da pagina.
    const id = existing?.id ?? onCreateTag(category.label, category.color)
    setTagIds((current) =>
      current.includes(id) ? current.filter((tagId) => tagId !== id) : [...current, id],
    )
  }
  const toggleTag = (id: string) =>
    setTagIds((current) =>
      current.includes(id) ? current.filter((tagId) => tagId !== id) : [...current, id],
    )

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    setLoadingPhotos(true)
    try {
      const added = await Promise.all(Array.from(files).map(readPhoto))
      setPhotos((current) => [...current, ...added])
    } catch {
      setError('Não foi possível ler a foto. Tente outra.')
    } finally {
      setLoadingPhotos(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = () => {
    const priceValue = Number(price.replace(/\./g, '').replace(',', '.'))
    if (!name.trim()) return setError('Dê um nome ao produto.')
    if (!Number.isFinite(priceValue) || priceValue <= 0) return setError('Informe o preço.')
    const stockValue = stock.trim() === '' ? undefined : Math.max(0, Math.floor(Number(stock) || 0))
    // Sem estoque o produto aparece como "Em breve" em vez de vender o que nao tem.
    const status = !published
      ? 'draft'
      : stockValue === 0
        ? 'coming-soon'
        : product && product.status !== 'draft' && product.status !== 'coming-soon'
          ? product.status
          : 'published'
    onSave({
      name: name.trim(),
      brand: brand.trim(),
      price: Math.round(priceValue * 100) / 100,
      stock: stockValue,
      volumeMl: Number(volume) || 0,
      description: description.trim(),
      tagIds,
      featured,
      status,
      imageUrl: photos[0] ?? '',
      images: photos,
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="rise-in flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-white sm:rounded-[28px]">
        <div className="flex items-center justify-between border-b border-[#f3e9f7] px-5 py-4">
          <div>
            <p className="organizer-eyebrow">{product ? 'Editar produto' : 'Novo produto'}</p>
            <h3 className="max-w-[16rem] truncate text-2xl text-[#2a0f3d] sm:max-w-sm">
              {name.trim() || 'Sem nome'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f6ecfc] text-[#5b247f]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div>
            <FieldLabel>Fotos</FieldLabel>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {photos.map((photo, index) => (
                <div key={`${index}-${photo.slice(-24)}`} className="relative h-24 w-24 shrink-0">
                  <img src={photo} alt="" className="h-full w-full rounded-2xl object-cover" />
                  {index === 0 ? (
                    <span className="absolute bottom-1 left-1 rounded-full bg-[#2a0f3d]/80 px-2 py-0.5 text-[9px] font-bold text-white">
                      Capa
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setPhotos((current) => [photo, ...current.filter((_, i) => i !== index)])
                      }
                      className="absolute bottom-1 left-1 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-bold text-[#5b247f]"
                    >
                      Usar de capa
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                    aria-label="Remover foto"
                    className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={loadingPhotos}
                className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[#d9c2e8] text-[11px] font-bold text-[#6a2a94] hover:border-[#9b3fd6] hover:bg-[#fbf7fd]"
              >
                {loadingPhotos ? (
                  'Carregando…'
                ) : photos.length ? (
                  <>
                    <ImagePlus size={20} /> Mais fotos
                  </>
                ) : (
                  <>
                    <Camera size={20} /> Tirar ou escolher
                  </>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => void addPhotos(event.target.files)}
              />
            </div>
          </div>

          <Field label="Nome">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Lattafa Asad 100ml"
              className="pos-input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço (R$)">
              <input
                value={price}
                onChange={(event) => setPrice(event.target.value.replace(/[^\d.,]/g, ''))}
                inputMode="decimal"
                placeholder="0,00"
                className="pos-input"
              />
            </Field>
            <Field label="Estoque">
              <input
                value={stock}
                onChange={(event) => setStock(event.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                placeholder="Qtd."
                className="pos-input"
              />
            </Field>
            <Field label="Marca">
              <input
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
                placeholder="Ex.: Lattafa"
                className="pos-input"
              />
            </Field>
            <Field label="Volume (ml)">
              <input
                value={volume}
                onChange={(event) => setVolume(event.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                placeholder="100"
                className="pos-input"
              />
            </Field>
          </div>

          <div>
            <FieldLabel>Categorias (páginas do site)</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => {
                const tag = categoryTag(tags, category.key)
                const active = Boolean(tag && tagIds.includes(tag.id))
                return (
                  <TagToggle key={category.key} active={active} onClick={() => toggleCategory(category.key)}>
                    {category.label}
                  </TagToggle>
                )
              })}
            </div>
          </div>

          {otherTags.length ? (
            <div>
              <FieldLabel>Outras etiquetas</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {otherTags.map((tag) => (
                  <TagToggle key={tag.id} active={tagIds.includes(tag.id)} onClick={() => toggleTag(tag.id)}>
                    {tag.name}
                    {tag.discountPercent ? ` (-${tag.discountPercent}%)` : ''}
                  </TagToggle>
                ))}
              </div>
            </div>
          ) : null}

          <Field label="Descrição">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Notas, família olfativa, ocasião…"
              className="pos-input resize-none font-normal"
            />
          </Field>

          <div className="grid gap-2 sm:grid-cols-2">
            <Switch
              checked={featured}
              onChange={setFeatured}
              title="Destaque"
              detail="Aparece no carrossel do topo da página inicial."
              icon={<Star size={16} className={featured ? 'fill-current' : ''} />}
            />
            <Switch
              checked={published}
              onChange={setPublished}
              title="Visível no site"
              detail="Desligado, o produto fica guardado e oculto."
              icon={published ? <Eye size={16} /> : <EyeOff size={16} />}
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {product ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f3e9f7] pt-4">
              <a
                href={`/produto/${product.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-sm font-semibold text-[#6a2a94]"
              >
                <ExternalLink size={15} /> Ver no site
              </a>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                <Trash2 size={15} /> Excluir
              </button>
            </div>
          ) : null}
        </div>

        <div className="border-t border-[#f3e9f7] p-4">
          <Button size="lg" fullWidth onClick={save} disabled={loadingPhotos}>
            <Check size={17} /> {product ? 'Salvar alterações' : 'Cadastrar produto'}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir produto?"
        confirmLabel="Excluir"
        onConfirm={() => onDelete?.()}
        onCancel={() => setConfirmDelete(false)}
      >
        “{product?.name}” sai do site e vai para a lixeira do editor avançado, de onde ainda dá para
        restaurar.
      </ConfirmDialog>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b665f]">{children}</p>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b665f]">
        {label}
      </span>
      {children}
    </label>
  )
}

function TagToggle({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1 rounded-full border px-3.5 py-2 text-xs font-bold transition ${
        active
          ? 'border-transparent bg-[image:var(--grad-brand)] text-white shadow-sm'
          : 'border-[#e3cfee] bg-white text-[#5b247f] hover:border-[#9b3fd6]'
      }`}
    >
      {active ? <Check size={12} /> : <Plus size={12} />}
      {children}
    </button>
  )
}

function Switch({
  checked,
  onChange,
  title,
  detail,
  icon,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  title: string
  detail: string
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 rounded-[18px] border px-4 py-3 text-left transition ${
        checked ? 'border-[#c9a4e2] bg-[#fbf7fd]' : 'border-[#efe3f6] bg-white'
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          checked ? 'bg-[image:var(--grad-brand)] text-white' : 'bg-[#f6ecfc] text-[#9b86a8]'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[#2a0f3d]">{title}</span>
        <span className="block text-[11px] leading-4 text-[#6b665f]">{detail}</span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#6a2a94]' : 'bg-stone-300'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}
