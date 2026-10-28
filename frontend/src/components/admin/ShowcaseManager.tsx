import { Check, ChevronRight, Eye, EyeOff, LayoutGrid, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  getOrganizerPageModules,
  type OrganizerAutoFill,
  type OrganizerNode,
  type OrganizerTag,
} from '../../types/organizer'
import { Button } from '../Button'
import {
  AUTO_FILL_FILTER_LABELS,
  AUTO_FILL_SORT_LABELS,
  autoFillItems,
  effectiveAutoFill,
  SELF_ORDERED_FILTERS,
} from '../site/autoFill'

const LIMITS = [0, 4, 6, 8, 12, 20]

const DEFAULT_RULE: OrganizerAutoFill = { enabled: true, tagIds: [], filter: 'all', sort: 'newest', limit: 0 }

type Props = {
  nodes: OrganizerNode[]
  tags: OrganizerTag[]
  onUpdateNode: (id: string, updates: Partial<OrganizerNode>) => void
}

/** Vitrines do dono: so os carrosseis de produto da home, cada um com a
 * sua regra (novidades, ofertas, mais procurados...). */
export function ShowcaseManager(props: Props) {
  return <BlocksView {...props} />
}

function isProductBlock(node: OrganizerNode) {
  return node.variant === 'product-carousel'
}

function BlocksView({ nodes, tags, onUpdateNode }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const pages = nodes.filter((node) => node.id === 'home')
  const editing = editingId ? nodes.find((node) => node.id === editingId) : undefined

  return (
    <div className="space-y-4">
      <p className="rounded-[18px] bg-[#fff6e3] px-4 py-3 text-xs leading-5 text-[#8a5a0b]">
        <Sparkles size={13} className="mr-1 inline" />
        Os carrosséis da página inicial se enchem sozinhos. O <b>Destaques</b> do topo mostra os produtos com
        a chave “Destaque” ligada na área Produtos. “Visto recentemente”, “Recomendado” e “Mais procurados”
        usam o que cada cliente abriu no celular e o que a loja mais vende.
      </p>

      {pages.map((page) => {
        const blocks = getOrganizerPageModules(nodes, page.id).filter(isProductBlock)
        if (blocks.length === 0) return null
        return (
          <section key={page.id} className="organizer-surface overflow-hidden bg-white">
            <p className="organizer-eyebrow border-b border-[#f3e9f7] px-4 py-3">{page.name}</p>
            <ul className="divide-y divide-[#f3e9f7]">
              {blocks.map((block) => {
                const rule = effectiveAutoFill(block, tags)
                const count = rule ? autoFillItems(rule, nodes, tags, false).length : 0
                const hidden = block.status === 'draft'
                return (
                  <li key={block.id} className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setEditingId(block.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                          rule ? 'bg-[image:var(--grad-brand)] text-white' : 'bg-[#f6ecfc] text-[#9b86a8]'
                        }`}
                      >
                        {rule ? <Sparkles size={17} /> : <LayoutGrid size={17} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-sm font-semibold ${hidden ? 'text-[#9b86a8] line-through' : 'text-[#2a0f3d]'}`}
                        >
                          {block.name}
                        </span>
                        <span className="block truncate text-xs text-[#6b665f]">
                          {rule
                            ? isPerCustomer(rule)
                              ? `Automático · ${ruleSummary(rule, tags)}`
                              : `Automático · ${ruleSummary(rule, tags)} · ${count} produto(s)`
                            : `Manual · ${block.itemIds.length} escolhido(s)`}
                        </span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-[#c9a4e2]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateNode(block.id, { status: hidden ? 'published' : 'draft' })}
                      aria-label={hidden ? 'Mostrar no site' : 'Esconder do site'}
                      title={hidden ? 'Escondido do site' : 'Visível no site'}
                      className={`rounded-full p-2 ${hidden ? 'text-[#c9a4e2]' : 'text-[#6a2a94] hover:bg-[#f6ecfc]'}`}
                    >
                      {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      {editing ? (
        <BlockEditor
          key={editing.id}
          block={editing}
          nodes={nodes}
          tags={tags}
          onClose={() => setEditingId(null)}
          onSave={(updates) => {
            onUpdateNode(editing.id, updates)
            setEditingId(null)
          }}
        />
      ) : null}
    </div>
  )
}

function isPerCustomer(rule: OrganizerAutoFill) {
  return SELF_ORDERED_FILTERS.includes(rule.filter) || rule.filter === 'recommended'
}

function ruleSummary(rule: OrganizerAutoFill, tags: OrganizerTag[]) {
  if (isPerCustomer(rule)) return AUTO_FILL_FILTER_LABELS[rule.filter]
  const names = rule.tagIds.map((id) => tags.find((tag) => tag.id === id)?.name).filter(Boolean)
  const base = names.length ? names.join(', ') : 'todos os produtos'
  return rule.filter === 'all' ? base : `${base} (${AUTO_FILL_FILTER_LABELS[rule.filter].toLowerCase()})`
}

function BlockEditor({
  block,
  nodes,
  tags,
  onClose,
  onSave,
}: {
  block: OrganizerNode
  nodes: OrganizerNode[]
  tags: OrganizerTag[]
  onClose: () => void
  onSave: (updates: Partial<OrganizerNode>) => void
}) {
  const current = effectiveAutoFill(block, tags)
  const [enabled, setEnabled] = useState(Boolean(current))
  const [rule, setRule] = useState<OrganizerAutoFill>(current ?? DEFAULT_RULE)
  const [keepManual, setKeepManual] = useState(true)

  const preview = useMemo(
    () => (enabled ? autoFillItems({ ...rule, enabled: true }, nodes, tags, false) : []),
    [enabled, rule, nodes, tags],
  )
  const toggleTag = (id: string) =>
    setRule((value) => ({
      ...value,
      tagIds: value.tagIds.includes(id)
        ? value.tagIds.filter((tagId) => tagId !== id)
        : [...value.tagIds, id],
    }))

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="rise-in flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-white sm:rounded-[28px]">
        <div className="flex items-center justify-between border-b border-[#f3e9f7] px-5 py-4">
          <div>
            <p className="organizer-eyebrow">Vitrine</p>
            <h3 className="text-2xl text-[#2a0f3d]">{block.name}</h3>
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
          <label className="choice-card flex cursor-pointer items-center justify-between gap-3 rounded-[18px] border border-[#efe3f6] px-4 py-3">
            <span>
              <span className="block text-sm font-bold text-[#2a0f3d]">Encher automaticamente</span>
              <span className="block text-xs text-[#6b665f]">
                Os produtos entram e saem sozinhos pelas tags.
              </span>
            </span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="radio-fx"
            />
          </label>

          {enabled ? (
            <>
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b665f]">
                  Mostrar produtos com as tags
                </p>
                {tags.length === 0 ? (
                  <p className="text-xs text-[#9b86a8]">Crie categorias na área Produtos.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const active = rule.tagIds.includes(tag.id)
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                            active
                              ? 'border-transparent bg-[image:var(--grad-brand)] text-white'
                              : 'border-[#e3cfee] bg-white text-[#5b247f]'
                          }`}
                        >
                          {active ? <Check size={12} /> : null}
                          {tag.name}
                        </button>
                      )
                    })}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-[#9b86a8]">
                  Nenhuma tag marcada = todos os produtos publicados.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <EditorSelect
                  label="Quais"
                  value={rule.filter}
                  options={AUTO_FILL_FILTER_LABELS}
                  onChange={(filter) => setRule((value) => ({ ...value, filter }))}
                />
                <EditorSelect
                  label="Ordem"
                  value={rule.sort}
                  options={AUTO_FILL_SORT_LABELS}
                  onChange={(sort) => setRule((value) => ({ ...value, sort }))}
                />
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b665f]">
                  Quantidade
                </p>
                <div className="flex flex-wrap gap-2">
                  {LIMITS.map((limit) => (
                    <button
                      key={limit}
                      type="button"
                      onClick={() => setRule((value) => ({ ...value, limit }))}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                        rule.limit === limit ? 'bg-[#2a0f3d] text-white' : 'bg-[#f6ecfc] text-[#5b247f]'
                      }`}
                    >
                      {limit === 0 ? 'Todos' : `Até ${limit}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[18px] bg-[#fbf7fd] p-3">
                <p className="text-xs font-bold text-[#2a0f3d]">
                  {isPerCustomer(rule)
                    ? 'Muda para cada cliente, conforme o que ele abriu e o que mais se procura na loja.'
                    : `Prévia: ${preview.length} produto(s) vão aparecer`}
                </p>
                <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
                  {preview.slice(0, 12).map((item) => (
                    <div key={item.id} className="w-20 shrink-0">
                      <div className="aspect-square overflow-hidden rounded-xl bg-[#efe3f6]">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-3 text-[#6b665f]">{item.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {block.itemIds.length > 0 ? (
            <label className="flex cursor-pointer items-center gap-3 text-xs text-[#6b665f]">
              <input
                type="checkbox"
                checked={keepManual}
                onChange={(event) => setKeepManual(event.target.checked)}
                className="radio-fx"
              />
              Manter os {block.itemIds.length} produto(s) escolhidos à mão{' '}
              {enabled ? '(aparecem primeiro)' : ''}
            </label>
          ) : null}
        </div>

        <div className="border-t border-[#f3e9f7] p-4">
          <Button
            size="lg"
            fullWidth
            onClick={() =>
              onSave({
                autoFill: { ...rule, enabled },
                ...(keepManual ? {} : { itemIds: [] }),
              })
            }
          >
            <Check size={17} /> Salvar vitrine
          </Button>
        </div>
      </div>
    </div>
  )
}

function EditorSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Record<T, string>
  onChange: (value: T) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b665f]">
        {label}
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)} className="pos-input">
        {(Object.keys(options) as T[]).map((key) => (
          <option key={key} value={key}>
            {options[key]}
          </option>
        ))}
      </select>
    </label>
  )
}
