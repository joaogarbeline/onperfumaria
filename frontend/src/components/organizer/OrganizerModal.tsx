import {
  CalendarClock,
  Eye,
  FolderOpen,
  Layers3,
  LayoutGrid,
  Package,
  Settings,
  Sparkles,
  X,
} from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import type { CreateOrganizerNodeInput } from '../../hooks/useOrganizerStore'
import {
  organizerSizeLabels,
  organizerStatusLabels,
  organizerTypeLabels,
  findOrganizerPage,
  getOrganizerPageModules,
  isOrganizerNodeVisible,
  type OrganizerContentType,
  type OrganizerNode,
  type OrganizerStore,
} from '../../types/organizer'

export type OrganizerModalMode =
  | OrganizerContentType
  | 'tag'
  | 'schedule'
  | 'preview'
  | 'settings'
  | 'module-picker'
  | null

type OrganizerModalProps = {
  mode: Exclude<OrganizerModalMode, null>
  store: OrganizerStore
  parentId: string
  selectedId: string | null
  onClose: () => void
  onCreateNode: (input: CreateOrganizerNodeInput) => string
  onCreateTag: (name: string, color: string) => string
  onSchedule: (id: string, date: string) => void
  onCreated: (kind: 'node' | 'tag', id: string) => void
  onClearActivities: () => void
  onChooseModule: (type: 'folder' | 'carousel' | 'highlight' | 'catalog' | 'item') => void
}

const fieldClass =
  'w-full rounded-lg border border-[#d9d0c4] bg-white px-3 py-2.5 text-sm text-[#171412] outline-none focus:border-[#b77717] focus:ring-2 focus:ring-[#fff1d6]'

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-[#6b665f]">
      {children}
    </span>
  )
}

function tomorrowAtNine() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(9, 0, 0, 0)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

export function OrganizerModal({
  mode,
  store,
  parentId,
  selectedId,
  onClose,
  onCreateNode,
  onCreateTag,
  onSchedule,
  onCreated,
  onClearActivities,
  onChooseModule,
}: OrganizerModalProps) {
  const containers = store.nodes.filter((node) => node.type === 'page' || node.type === 'folder')
  const items = store.nodes.filter((node) => node.type === 'item')
  const schedulableNodes = store.nodes.filter((node) => node.type !== 'folder')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [route, setRoute] = useState('')
  const [publicationStatus, setPublicationStatus] = useState<OrganizerNode['status']>('published')
  const [selectedParent, setSelectedParent] = useState(parentId || 'home')
  const [imageUrl, setImageUrl] = useState('')
  const [price, setPrice] = useState('')
  const [size, setSize] = useState<OrganizerNode['size']>('medium')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [itemIds, setItemIds] = useState<string[]>([])
  const [color, setColor] = useState('#d89a28')
  const [scheduleTarget, setScheduleTarget] = useState(
    schedulableNodes.some((node) => node.id === selectedId)
      ? (selectedId ?? '')
      : (schedulableNodes[0]?.id ?? ''),
  )
  const [scheduledAt, setScheduledAt] = useState(tomorrowAtNine)
  const suggestedRoute = `/pagina/${
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'nova-pagina'
  }`

  const title =
    mode === 'tag'
      ? 'Criar tag'
      : mode === 'schedule'
        ? 'Agendar publicação'
        : mode === 'preview'
          ? 'Pré-visualização do site'
          : mode === 'settings'
            ? 'Configurações do organizador'
            : mode === 'module-picker'
              ? 'Escolha o primeiro módulo'
              : `Criar ${organizerTypeLabels[mode].toLocaleLowerCase('pt-BR')}`

  function toggleValue(values: string[], value: string, setter: (next: string[]) => void) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (mode === 'preview' || mode === 'settings' || mode === 'module-picker') return

    if (mode === 'tag') {
      if (!name.trim()) return
      const id = onCreateTag(name, color)
      onClose()
      onCreated('tag', id)
      return
    }

    if (mode === 'schedule') {
      if (!scheduleTarget || !scheduledAt) return
      onSchedule(scheduleTarget, new Date(scheduledAt).toISOString())
      onClose()
      onCreated('node', scheduleTarget)
      return
    }

    if (!name.trim()) return
    const id = onCreateNode({
      name,
      type: mode,
      parentId: mode === 'page' ? null : selectedParent,
      description,
      imageUrl,
      price: Number(price) || 0,
      size,
      tagIds,
      itemIds,
      route: mode === 'page' ? route || suggestedRoute : undefined,
      status: mode === 'folder' ? 'published' : publicationStatus,
    })
    onClose()
    onCreated('node', id)
  }

  function handleImageFile(file?: File) {
    if (!file) return
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') setImageUrl(reader.result)
    })
    reader.readAsDataURL(file)
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Fechar janela"
        className="absolute inset-0 bg-[#0a1a33]/35 backdrop-blur-sm"
        onClick={onClose}
      />
      <section className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#24457a] bg-[#fafaf8] shadow-2xl">
        <header className="flex items-center justify-between bg-[linear-gradient(135deg,#142d52,#0a1a33)] px-5 py-4 text-[#fafaf8]">
          <div className="flex items-center gap-3">
            {mode === 'preview' ? <Eye size={19} className="text-[#f0c977]" /> : null}
            {mode === 'schedule' ? <CalendarClock size={19} className="text-[#f0c977]" /> : null}
            {mode === 'settings' ? <Settings size={19} className="text-[#f0c977]" /> : null}
            <h2 className="font-sans text-base font-semibold tracking-normal">{title}</h2>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </header>

        {mode === 'preview' ? (
          <PreviewContent store={store} selectedId={selectedId} />
        ) : mode === 'settings' ? (
          <div className="space-y-5 overflow-y-auto p-5">
            <div className="rounded-xl border border-[#d9d0c4] bg-white p-4">
              <h3 className="font-sans text-sm font-semibold text-[#142d52]">Salvamento automático</h3>
              <p className="mt-1 text-xs leading-5 text-[#6b665f]">
                Páginas, itens, tags, agendamentos e lixeira ficam salvos neste navegador.
              </p>
            </div>
            <div className="rounded-xl border border-[#d9d0c4] bg-white p-4">
              <h3 className="font-sans text-sm font-semibold text-[#142d52]">Histórico de recentes</h3>
              <p className="mt-1 text-xs leading-5 text-[#6b665f]">
                {store.activities.length} registro(s) armazenado(s).
              </p>
              <button
                type="button"
                onClick={() => {
                  onClearActivities()
                  onClose()
                }}
                className="mt-3 rounded-lg border border-[#d9d0c4] px-3 py-2 text-xs font-semibold text-[#142d52] hover:border-[#b77717] hover:bg-[#fff1d6]"
              >
                Limpar recentes
              </button>
            </div>
          </div>
        ) : mode === 'module-picker' ? (
          <div className="grid gap-3 overflow-y-auto p-5 sm:grid-cols-2 lg:grid-cols-5">
            <ModuleChoice
              icon={<Layers3 size={22} />}
              title="Carrossel"
              detail="Uma faixa deslizante com itens da loja."
              onClick={() => {
                onClose()
                onChooseModule('carousel')
              }}
            />
            <ModuleChoice
              icon={<Sparkles size={22} />}
              title="Destaque"
              detail="Um banner visual com imagem e descrição."
              onClick={() => {
                onClose()
                onChooseModule('highlight')
              }}
            />
            <ModuleChoice
              icon={<Package size={22} />}
              title="Item"
              detail="Um produto com preço, imagem e tags."
              onClick={() => {
                onClose()
                onChooseModule('item')
              }}
            />
            <ModuleChoice
              icon={<LayoutGrid size={22} />}
              title="Catálogo"
              detail="Uma grade paginada no modelo das categorias."
              onClick={() => {
                onClose()
                onChooseModule('catalog')
              }}
            />
            <ModuleChoice
              icon={<FolderOpen size={22} />}
              title="Subpasta"
              detail="Organiza módulos dentro da página sem criar outra rota no site."
              onClick={() => {
                onClose()
                onChooseModule('folder')
              }}
            />
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-4 py-2 text-sm text-[#6b665f] hover:bg-[#f4efe8] sm:col-span-2 lg:col-span-5"
            >
              Criar apenas a página
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto p-5">
            <div className="grid gap-4">
              {mode === 'schedule' ? (
                <>
                  <label>
                    <FieldLabel>Conteúdo</FieldLabel>
                    <select
                      value={scheduleTarget}
                      onChange={(event) => setScheduleTarget(event.target.value)}
                      className={fieldClass}
                      required
                    >
                      {schedulableNodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.name} - {organizerTypeLabels[node.type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <FieldLabel>Data e horário</FieldLabel>
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(event) => setScheduledAt(event.target.value)}
                      className={fieldClass}
                      required
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    <FieldLabel>Nome</FieldLabel>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={fieldClass}
                      autoFocus
                      required
                    />
                  </label>

                  {mode !== 'tag' ? (
                    <label>
                      <FieldLabel>Descrição</FieldLabel>
                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        className={`${fieldClass} min-h-24 resize-y`}
                      />
                    </label>
                  ) : null}

                  {mode === 'page' ? (
                    <>
                      <label>
                        <FieldLabel>Endereço da página</FieldLabel>
                        <input
                          value={route || suggestedRoute}
                          onChange={(event) => setRoute(event.target.value)}
                          className={fieldClass}
                          placeholder="/pagina/nome-da-pagina"
                          required
                        />
                        <span className="mt-1 block text-[10px] text-[#777067]">
                          A página será aberta neste endereço dentro do site existente.
                        </span>
                      </label>
                      <label>
                        <FieldLabel>Exibição na navegação</FieldLabel>
                        <select
                          value={publicationStatus}
                          onChange={(event) =>
                            setPublicationStatus(event.target.value as OrganizerNode['status'])
                          }
                          className={fieldClass}
                        >
                          <option value="published">Publicar e adicionar ao carrossel</option>
                          <option value="draft">Salvar como rascunho oculto</option>
                        </select>
                        <span className="mt-1 block text-[10px] text-[#777067]">
                          Páginas publicadas entram automaticamente na navegação do site.
                        </span>
                      </label>
                    </>
                  ) : null}

                  {mode !== 'page' && mode !== 'tag' ? (
                    <>
                      <label>
                        <FieldLabel>Página ou subpasta de destino</FieldLabel>
                        <select
                          value={selectedParent}
                          onChange={(event) => setSelectedParent(event.target.value)}
                          className={fieldClass}
                          required
                        >
                          {containers.map((container) => (
                            <option key={container.id} value={container.id}>
                              {container.type === 'folder' ? '↳ ' : ''}
                              {container.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {mode !== 'folder' ? (
                        <label>
                          <FieldLabel>Publicação no site</FieldLabel>
                          <select
                            value={publicationStatus}
                            onChange={(event) =>
                              setPublicationStatus(event.target.value as OrganizerNode['status'])
                            }
                            className={fieldClass}
                          >
                            <option value="published">Publicar e mostrar agora</option>
                            <option value="draft">Salvar como rascunho oculto</option>
                          </select>
                        </label>
                      ) : (
                        <p className="rounded-lg border border-[#d9d0c4] bg-[#fff9ee] px-3 py-2.5 text-xs leading-5 text-[#6b665f]">
                          A subpasta serve somente para organização. Ela não cria endereço nem aparece na
                          navegação do site.
                        </p>
                      )}
                    </>
                  ) : null}

                  {mode === 'tag' ? (
                    <label>
                      <FieldLabel>Cor</FieldLabel>
                      <input
                        type="color"
                        value={color}
                        onChange={(event) => setColor(event.target.value)}
                        className="h-11 w-full rounded-lg border border-[#d9d0c4] bg-white p-1"
                      />
                    </label>
                  ) : null}

                  {mode === 'highlight' || mode === 'item' ? (
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <label>
                        <FieldLabel>Imagem por endereço</FieldLabel>
                        <input
                          type="text"
                          value={imageUrl.startsWith('data:') ? '' : imageUrl}
                          onChange={(event) => setImageUrl(event.target.value)}
                          className={fieldClass}
                          placeholder="https://..."
                        />
                      </label>
                      <label className="cursor-pointer rounded-lg border border-[#d9d0c4] bg-white px-4 py-2.5 text-center text-xs font-semibold text-[#142d52] hover:border-[#b77717] hover:bg-[#fff1d6]">
                        Enviar arquivo
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(event) => handleImageFile(event.target.files?.[0])}
                        />
                      </label>
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt="Prévia"
                          className="h-24 w-full rounded-lg object-cover sm:col-span-2"
                        />
                      ) : null}
                    </div>
                  ) : null}

                  {mode === 'highlight' ? (
                    <label>
                      <FieldLabel>Tamanho do destaque</FieldLabel>
                      <select
                        value={size}
                        onChange={(event) => setSize(event.target.value as OrganizerNode['size'])}
                        className={fieldClass}
                      >
                        {Object.entries(organizerSizeLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {mode === 'item' ? (
                    <>
                      <label>
                        <FieldLabel>Preço</FieldLabel>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={price}
                          onChange={(event) => setPrice(event.target.value)}
                          className={fieldClass}
                        />
                      </label>
                      <CheckboxGrid
                        title="Tags"
                        empty="Crie uma tag antes de associá-la."
                        entries={store.tags.map((tag) => ({ id: tag.id, label: tag.name }))}
                        selected={tagIds}
                        onToggle={(id) => toggleValue(tagIds, id, setTagIds)}
                      />
                    </>
                  ) : null}

                  {mode === 'carousel' || mode === 'catalog' ? (
                    <ProductCheckboxGrid
                      title={mode === 'catalog' ? 'Produtos do catálogo' : 'Itens do carrossel'}
                      empty={`Crie itens antes de adicioná-los ao ${mode === 'catalog' ? 'catálogo' : 'carrossel'}.`}
                      items={items}
                      selected={itemIds}
                      onToggle={(id) => toggleValue(itemIds, id, setItemIds)}
                    />
                  ) : null}
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-[#e9e2d9] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#6b665f] hover:bg-[#f4efe8]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#142d52] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#24457a]"
              >
                {mode === 'schedule' ? 'Agendar' : 'Criar'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

function ModuleChoice({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: ReactNode
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-[#d9d0c4] bg-white p-5 text-left hover:border-[#b77717] hover:bg-[#fff9ee]"
    >
      <span className="mb-3 inline-flex rounded-full bg-[#f4e9d7] p-3 text-[#b77717]">{icon}</span>
      <span className="block text-sm font-semibold text-[#142d52]">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-[#6b665f]">{detail}</span>
    </button>
  )
}

function CheckboxGrid({
  title,
  empty,
  entries,
  selected,
  onToggle,
}: {
  title: string
  empty: string
  entries: Array<{ id: string; label: string }>
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <fieldset>
      <legend>
        <FieldLabel>{title}</FieldLabel>
      </legend>
      {entries.length === 0 ? (
        <p className="text-xs text-[#6b665f]">{empty}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {entries.map((entry) => (
            <label
              key={entry.id}
              className="flex items-center gap-2 rounded-lg border border-[#d9d0c4] bg-white px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(entry.id)}
                onChange={() => onToggle(entry.id)}
              />
              {entry.label}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}

function ProductCheckboxGrid({
  title,
  empty,
  items,
  selected,
  onToggle,
}: {
  title: string
  empty: string
  items: OrganizerNode[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <fieldset>
      <legend>
        <FieldLabel>
          {title} · {selected.length} selecionado(s)
        </FieldLabel>
      </legend>
      {items.length === 0 ? (
        <p className="text-xs text-[#6b665f]">{empty}</p>
      ) : (
        <div className="grid max-h-80 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {items.map((item) => {
            const checked = selected.includes(item.id)
            return (
              <label
                key={item.id}
                className={`flex cursor-pointer gap-3 border p-2.5 transition ${
                  checked
                    ? 'border-[#b77717] bg-[#fff7e8] shadow-sm'
                    : 'border-[#d9d0c4] bg-white hover:border-[#cfad76]'
                }`}
              >
                <span className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden bg-[#f4efe8] text-[#b77717]">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package size={24} />
                  )}
                </span>
                <span className="min-w-0 flex-1 py-1">
                  <span className="block truncate text-sm font-semibold text-[#142d52]">{item.name}</span>
                  <span className="mt-1 block text-xs text-[#6b665f]">
                    {item.price > 0
                      ? item.price.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })
                      : 'Preço não informado'}
                  </span>
                  <span className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-[#9a6109]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(item.id)}
                      className="accent-[#b77717]"
                    />
                    {checked ? 'Em uso' : 'Selecionar'}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      )}
    </fieldset>
  )
}

function PreviewContent({ store, selectedId }: { store: OrganizerStore; selectedId: string | null }) {
  const selected = store.nodes.find((node) => node.id === selectedId)
  const page = selected ? findOrganizerPage(store.nodes, selected) : store.nodes[0]
  const contents = page
    ? getOrganizerPageModules(store.nodes, page.id).filter((node) => isOrganizerNodeVisible(node))
    : []

  return (
    <div className="min-h-0 overflow-y-auto bg-[#f7f2eb] p-5">
      <div className="mx-auto max-w-xl rounded-2xl border border-[#d9d0c4] bg-white p-5 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#b77717]">
          Visualização do visitante
        </p>
        <h3 className="mt-2 text-3xl font-semibold text-[#171412]">{page?.name ?? 'Home'}</h3>
        <p className="mt-1 text-sm text-[#6b665f]">{page?.description || 'Página do site'}</p>

        <div className="mt-6 grid gap-4">
          {contents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d9d0c4] p-8 text-center text-sm text-[#6b665f]">
              Nenhum conteúdo publicado nesta página.
            </div>
          ) : (
            contents.map((node) => (
              <article key={node.id} className="rounded-xl border border-[#e9e2d9] bg-[#fcfbf8] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b77717]">
                      {organizerTypeLabels[node.type]}
                    </p>
                    <h4 className="font-sans text-base font-semibold text-[#142d52]">{node.name}</h4>
                  </div>
                  <span className="rounded-full bg-[#e7edf7] px-2 py-1 text-[10px] font-semibold text-[#142d52]">
                    {organizerStatusLabels[node.status]}
                  </span>
                </div>
                {node.description ? (
                  <p className="mt-2 text-xs leading-5 text-[#6b665f]">{node.description}</p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
