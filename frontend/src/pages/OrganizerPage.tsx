import { useMemo, useRef, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronDown,
  CircleUserRound,
  Copy,
  Eye,
  FileText,
  FolderOpen,
  GripVertical,
  Image as ImageIcon,
  LayoutGrid,
  Layers3,
  Package,
  PanelLeft,
  PanelRight,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { OrganizerModal, type OrganizerModalMode } from '../components/organizer/OrganizerModal'
import { useOrganizerStore } from '../hooks/useOrganizerStore'
import {
  findOrganizerPage,
  organizerStatusLabels,
  organizerTypeLabels,
  normalizeOrganizerSearch,
} from '../types/organizer'
import type { OrganizerContentType, OrganizerNode, OrganizerTag } from '../types/organizer'

type DrawerName = 'left' | 'right'
type Selection = { kind: 'node'; id: string } | { kind: 'tag'; id: string } | { kind: 'trash' } | null
type SectionKey = 'upcoming' | 'recent' | 'organization' | 'tags'

interface DrawerItem {
  id: string
  label: string
  detail: string
  kind: 'node' | 'tag' | 'activity'
  targetId?: string | null
  depth?: number
  color?: string
  isPage?: boolean
  parentPageId?: string
  nodeType?: OrganizerContentType
}

const MIN_RIGHT_WIDTH = 210
const MAX_RIGHT_WIDTH = 460

const formatDate = (value?: string) => {
  if (!value) return 'Sem data definida'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

const nodeIcon = (type: OrganizerContentType, size = 17) => {
  if (type === 'page') return <FileText size={size} />
  if (type === 'folder') return <FolderOpen size={size} />
  if (type === 'carousel') return <Layers3 size={size} />
  if (type === 'catalog') return <LayoutGrid size={size} />
  if (type === 'highlight') return <Sparkles size={size} />
  return <Package size={size} />
}

export function OrganizerPage() {
  const {
    store,
    createNode,
    createTag,
    updateNode,
    updateTag,
    scheduleNode,
    recordAccess,
    duplicateNode,
    moveNode,
    moveNodeToTrash,
    moveTagToTrash,
    restoreTrash,
    deleteTrashPermanently,
    clearActivities,
  } = useOrganizerStore()

  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [rightWidth, setRightWidth] = useState(250)
  const [searchQuery, setSearchQuery] = useState('')
  const [selection, setSelection] = useState<Selection>({ kind: 'node', id: 'home' })
  const [modalMode, setModalMode] = useState<OrganizerModalMode | null>(null)
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    upcoming: true,
    recent: true,
    organization: true,
    tags: true,
  })
  const [openPages, setOpenPages] = useState<Record<string, boolean>>({})
  const shellRef = useRef<HTMLDivElement>(null)

  const selectedNode =
    selection?.kind === 'node' ? (store.nodes.find((node) => node.id === selection.id) ?? null) : null
  const detailNode = detailNodeId ? (store.nodes.find((node) => node.id === detailNodeId) ?? null) : null
  const selectedTag =
    selection?.kind === 'tag' ? (store.tags.find((tag) => tag.id === selection.id) ?? null) : null
  const selectedContainerId =
    selectedNode?.type === 'page' || selectedNode?.type === 'folder'
      ? selectedNode.id
      : (selectedNode?.parentId ?? 'home')

  const organizationItems = useMemo<DrawerItem[]>(() => {
    const pages = store.nodes.filter((node) => node.type === 'page')
    const descendants = (parentId: string, pageId: string, depth: number): DrawerItem[] =>
      store.nodes
        .filter((node) => node.parentId === parentId)
        .flatMap((child) => [
          {
            id: child.id,
            label: child.name,
            detail: organizerTypeLabels[child.type],
            kind: 'node' as const,
            depth,
            parentPageId: pageId,
            nodeType: child.type,
          },
          ...(child.type === 'folder' ? descendants(child.id, pageId, depth + 1) : []),
        ])
    return pages.flatMap((page) => {
      return [
        {
          id: page.id,
          label: page.name,
          detail: page.id === 'home' ? 'Página principal · /' : `Página existente · ${page.route ?? '/'}`,
          kind: 'node' as const,
          depth: 0,
          isPage: true,
          nodeType: 'page' as const,
        },
        ...descendants(page.id, page.id, 1),
      ]
    })
  }, [store.nodes])

  const allSections = useMemo<Record<SectionKey, DrawerItem[]>>(
    () => ({
      upcoming: store.nodes
        .filter((node) => node.type !== 'folder' && node.status === 'scheduled' && node.scheduledAt)
        .sort((a, b) => new Date(a.scheduledAt ?? '').getTime() - new Date(b.scheduledAt ?? '').getTime())
        .map((node) => ({
          id: `upcoming-${node.id}`,
          targetId: node.id,
          label: node.name,
          detail: formatDate(node.scheduledAt),
          kind: 'node' as const,
        })),
      recent: store.activities.slice(0, 7).map((activity) => ({
        id: activity.id,
        targetId: activity.targetId,
        label: activity.label,
        detail: `${activity.detail} · ${formatDate(activity.createdAt)}`,
        kind: 'activity' as const,
      })),
      organization: organizationItems,
      tags: store.tags.map((tag) => ({
        id: tag.id,
        label: tag.name,
        detail: `${store.nodes.filter((node) => node.tagIds.includes(tag.id)).length} item(ns)`,
        kind: 'tag' as const,
        color: tag.color,
      })),
    }),
    [organizationItems, store.activities, store.nodes, store.tags],
  )

  const filteredSections = useMemo(() => {
    const query = normalizeOrganizerSearch(searchQuery)
    if (!query) return allSections
    return Object.fromEntries(
      Object.entries(allSections).map(([key, items]) => {
        const matchingIds = new Set(
          items
            .filter((item) => normalizeOrganizerSearch(`${item.label} ${item.detail}`).includes(query))
            .map((item) => item.id),
        )
        if (key !== 'organization') {
          return [key, items.filter((item) => matchingIds.has(item.id))]
        }

        const matchingPages = new Set(
          items.filter((item) => item.isPage && matchingIds.has(item.id)).map((item) => item.id),
        )
        const parentPages = new Set(
          items
            .filter((item) => item.parentPageId && matchingIds.has(item.id))
            .map((item) => item.parentPageId as string),
        )
        return [
          key,
          items.filter(
            (item) =>
              matchingIds.has(item.id) ||
              (item.isPage && parentPages.has(item.id)) ||
              (item.parentPageId && matchingPages.has(item.parentPageId)),
          ),
        ]
      }),
    ) as Record<SectionKey, DrawerItem[]>
  }, [allSections, searchQuery])

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2800)
  }

  const isMobileViewport = () => window.matchMedia('(max-width: 1023px)').matches

  const toggleLeftDrawer = () => {
    setLeftOpen((value) => {
      const next = !value
      if (next && isMobileViewport()) setRightOpen(false)
      return next
    })
  }

  const toggleRightDrawer = () => {
    setRightOpen((value) => {
      const next = !value
      if (next && isMobileViewport()) setLeftOpen(false)
      return next
    })
  }

  const selectItem = (item: DrawerItem) => {
    const closeDrawersOnMobile = () => {
      if (isMobileViewport()) {
        setLeftOpen(false)
        setRightOpen(false)
      }
    }
    if (item.kind === 'tag') {
      setSelection({ kind: 'tag', id: item.id })
      recordAccess(item.id, item.label)
      closeDrawersOnMobile()
      return
    }
    const targetId = item.targetId ?? item.id
    const targetNode = store.nodes.find((node) => node.id === targetId)
    if (targetNode) {
      setSelection({ kind: 'node', id: targetId })
      setDetailNodeId(targetNode.type === 'page' || targetNode.type === 'folder' ? null : targetNode.id)
      if (item.kind !== 'activity') recordAccess(targetId, item.label)
      closeDrawersOnMobile()
    }
  }

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const shell = shellRef.current
    if (!shell) return
    const startX = event.clientX
    const startWidth = rightWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMove = (moveEvent: PointerEvent) => {
      const shellWidth = shell.getBoundingClientRect().width
      const maxAllowed = Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, shellWidth * 0.42))
      setRightWidth(Math.max(MIN_RIGHT_WIDTH, Math.min(maxAllowed, startWidth + startX - moveEvent.clientX)))
    }
    const handleEnd = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
  }

  const handleCreated = (kind: 'node' | 'tag', id: string) => {
    setSelection({ kind, id })
    if (modalMode === 'page') setModalMode('module-picker')
    showNotice(
      modalMode === 'schedule'
        ? 'Publicação agendada com sucesso.'
        : modalMode === 'page'
          ? 'Página criada. Escolha o primeiro módulo.'
          : kind === 'tag'
            ? 'Tag criada com sucesso.'
            : 'Conteúdo criado com sucesso.',
    )
  }

  const sectionConfig: Array<{
    key: SectionKey
    label: string
    empty: string
    onAdd: () => void
    addLabel: string
  }> = [
    {
      key: 'upcoming',
      label: 'Próximos eventos',
      empty: searchQuery ? 'Nenhum evento encontrado' : 'Não há eventos futuros',
      onAdd: () => setModalMode('schedule'),
      addLabel: 'Agendar conteúdo',
    },
    {
      key: 'recent',
      label: 'Recentes',
      empty: searchQuery ? 'Nenhum recente encontrado' : 'Não há nada de novo',
      onAdd: () => setOpenSections((current) => ({ ...current, recent: !current.recent })),
      addLabel: 'Mostrar ou ocultar recentes',
    },
    {
      key: 'organization',
      label: 'Organização',
      empty: searchQuery ? 'Nenhum conteúdo encontrado' : 'Não há páginas',
      onAdd: () => setModalMode('page'),
      addLabel: 'Criar nova página do site',
    },
    {
      key: 'tags',
      label: 'Tags',
      empty: searchQuery ? 'Nenhuma tag encontrada' : 'Não há tags',
      onAdd: () => setModalMode('tag'),
      addLabel: 'Criar tag',
    },
  ]

  return (
    <main className="h-dvh w-full overflow-hidden bg-[#f7f3eb] text-[#132f57]">
      <section
        ref={shellRef}
        className="flex h-full w-full min-h-0 flex-col overflow-hidden border-[3px] border-[#183861] bg-[#fdfbf7]"
      >
        <header className="flex h-14 shrink-0 items-center justify-between bg-[#122f55] px-3 sm:px-4">
          <DrawerToggle drawer="left" open={leftOpen} onToggle={toggleLeftDrawer} />
          <div className="flex items-center gap-2 text-[#f5ca74]">
            <Layers3 size={17} />
            <span className="hidden text-xs font-semibold uppercase tracking-[0.22em] sm:inline">
              Organizador do site
            </span>
          </div>
          <DrawerToggle drawer="right" open={rightOpen} onToggle={toggleRightDrawer} />
        </header>

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <aside
            aria-label="Gaveta de organização"
            className={`absolute inset-y-0 left-0 z-30 flex flex-col overflow-hidden bg-[#fdfbf7] shadow-2xl transition-[width,opacity] duration-300 lg:relative lg:inset-auto lg:z-auto lg:shrink-0 lg:shadow-none ${leftOpen ? 'w-full opacity-100 lg:w-[250px]' : 'pointer-events-none w-0 opacity-0'}`}
          >
            <div className="min-h-0 w-full flex-1 overflow-y-auto px-3 pt-3 sm:px-5 lg:w-[250px] lg:px-3">
              <label className="flex h-10 items-center border border-[#ded4c5] bg-white px-2 text-[#132f57] focus-within:border-[#c27a08]">
                <span className="sr-only">Buscar no organizador</span>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Busca"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#887f73]"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    aria-label="Limpar busca"
                    onClick={() => setSearchQuery('')}
                    className="rounded p-1 text-[#8c7b68] hover:bg-[#f3eadc] hover:text-[#b86b00]"
                  >
                    <X size={18} />
                  </button>
                ) : (
                  <Search size={22} className="text-[#b86b00]" />
                )}
              </label>

              <nav className="mt-3" aria-label="Seções do organizador">
                {sectionConfig.map((section) => {
                  const items = filteredSections[section.key]
                  return (
                    <div key={section.key} className="border-b border-[#e8ded0] py-2 last:border-0">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSections((current) => ({
                              ...current,
                              [section.key]: !current[section.key],
                            }))
                          }
                          className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium hover:text-[#b86b00]"
                        >
                          <ChevronDown
                            size={14}
                            className={`shrink-0 transition-transform ${openSections[section.key] ? '' : '-rotate-90'}`}
                          />
                          <span className="truncate">{section.label}</span>
                          <span className="ml-auto text-[10px] text-[#887f73]">{items.length}</span>
                        </button>
                        <button
                          type="button"
                          title={section.addLabel}
                          aria-label={section.addLabel}
                          onClick={section.onAdd}
                          className="rounded p-1 text-[#b86b00] hover:bg-[#f3eadc]"
                        >
                          <Plus size={17} />
                        </button>
                      </div>
                      {openSections[section.key] && (
                        <div className="mt-1 space-y-0.5">
                          {items.length === 0 ? (
                            <p className="px-5 py-1 text-[10px] text-[#766e64]">{section.empty}</p>
                          ) : (
                            items.map((item) => {
                              if (
                                section.key === 'organization' &&
                                item.parentPageId &&
                                !searchQuery &&
                                (openPages[item.parentPageId] ?? false) === false
                              ) {
                                return null
                              }
                              const isSelected =
                                (item.kind === 'tag' &&
                                  selection?.kind === 'tag' &&
                                  selection.id === item.id) ||
                                (item.kind !== 'tag' &&
                                  selection?.kind === 'node' &&
                                  selection.id === (item.targetId ?? item.id))
                              if (section.key === 'organization' && item.isPage) {
                                const pageOpen = openPages[item.id] ?? false
                                const childCount = organizationItems.filter(
                                  (candidate) => candidate.parentPageId === item.id,
                                ).length
                                return (
                                  <div
                                    key={item.id}
                                    className={`mt-1 flex items-stretch rounded-sm ${isSelected ? 'bg-[#e9decc] text-[#8b5200]' : 'bg-[#f7f2ea] hover:bg-[#f1e8dc]'}`}
                                  >
                                    <button
                                      type="button"
                                      aria-label={`${pageOpen ? 'Recolher' : 'Expandir'} módulos de ${item.label}`}
                                      onClick={() =>
                                        setOpenPages((current) => ({
                                          ...current,
                                          [item.id]: !pageOpen,
                                        }))
                                      }
                                      className="flex w-7 shrink-0 items-center justify-center text-[#9b6b2d]"
                                    >
                                      <ChevronDown
                                        size={13}
                                        className={`transition-transform ${pageOpen ? '' : '-rotate-90'}`}
                                      />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => selectItem(item)}
                                      className="min-w-0 flex-1 py-2 pr-2 text-left"
                                    >
                                      <span className="flex items-center gap-2 text-xs font-semibold">
                                        <FolderOpen size={14} className="shrink-0 text-[#b86b00]" />
                                        <span className="truncate">{item.label}</span>
                                        <span className="ml-auto text-[9px] font-normal text-[#887f73]">
                                          {childCount}
                                        </span>
                                      </span>
                                      <span className="mt-0.5 block truncate pl-[22px] text-[9px] text-[#766e64]">
                                        {item.detail}
                                      </span>
                                    </button>
                                  </div>
                                )
                              }

                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => selectItem(item)}
                                  className={`block w-full rounded-sm py-1.5 pr-1 text-left transition-colors ${isSelected ? 'bg-[#efe3d1] text-[#9d5b00]' : 'hover:bg-[#f5eee4]'} ${item.depth ? 'ml-3 w-[calc(100%-0.75rem)] border-l-2 border-[#d8c9b5] pl-5' : 'pl-5'}`}
                                >
                                  <span className="flex items-center gap-2 text-xs font-medium">
                                    {item.color && (
                                      <span
                                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                                        style={{ backgroundColor: item.color }}
                                      />
                                    )}
                                    {item.nodeType && !item.isPage ? nodeIcon(item.nodeType, 12) : null}
                                    <span className="truncate">{item.label}</span>
                                  </span>
                                  <span className="mt-0.5 block truncate pl-[18px] text-[9px] text-[#766e64]">
                                    {item.detail}
                                  </span>
                                </button>
                              )
                            })
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </nav>
            </div>

            <div className="relative flex h-14 w-full shrink-0 items-center gap-1 bg-[#fdfbf7] px-3 sm:px-5 lg:w-[250px] lg:px-3">
              {profileOpen && (
                <div className="absolute bottom-12 left-3 z-30 w-48 border border-[#d6cab9] bg-white p-1 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      window.open('/', '_blank', 'noopener,noreferrer')
                      setProfileOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[#f5eee4]"
                  >
                    <Eye size={15} /> Modo visitante
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalMode('settings')
                      setProfileOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[#f5eee4]"
                  >
                    <Settings size={15} /> Preferências
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setProfileOpen((value) => !value)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-2 text-sm hover:bg-[#f3eadc]"
              >
                <CircleUserRound size={23} />
                <span className="truncate border-b border-[#d0b377]">usuário</span>
              </button>
              <button
                type="button"
                title="Preferências"
                aria-label="Preferências"
                onClick={() => setModalMode('settings')}
                className="rounded p-2 hover:bg-[#f3eadc] hover:text-[#b86b00]"
              >
                <Settings size={19} />
              </button>
              <button
                type="button"
                title="Lixeira"
                aria-label="Abrir lixeira"
                onClick={() => setSelection({ kind: 'trash' })}
                className={`rounded p-2 hover:bg-[#f3eadc] hover:text-[#b86b00] ${selection?.kind === 'trash' ? 'bg-[#efe3d1] text-[#b86b00]' : ''}`}
              >
                <Trash2 size={19} />
              </button>
            </div>
          </aside>

          <section className="min-w-0 flex-1 bg-[#fbf8f2] p-0 lg:p-2">
            <div className="h-full overflow-y-auto bg-[#fffdfa] lg:border-[2px] lg:border-[#cdbfae]">
              <Workspace
                selection={selection}
                selectedNode={selectedNode}
                selectedTag={selectedTag}
                nodes={store.nodes}
                trash={store.trash}
                onSelectNode={(id) => {
                  setSelection({ kind: 'node', id })
                  setDetailNodeId(id)
                  recordAccess(id, store.nodes.find((node) => node.id === id)?.name ?? 'Conteúdo')
                }}
                onOpenModal={setModalMode}
                onNavigateBack={(parentId) => {
                  setDetailNodeId(null)
                  setSelection({ kind: 'node', id: parentId })
                  setRightOpen(false)
                }}
                onTrashNode={(id) => {
                  moveNodeToTrash(id)
                  setDetailNodeId(null)
                  showNotice('Conteúdo movido para a lixeira.')
                }}
                onRestore={restoreTrash}
                onDeletePermanently={deleteTrashPermanently}
              />
            </div>
          </section>

          {rightOpen && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Redimensionar gaveta direita"
              onPointerDown={handleResizeStart}
              className="group relative z-20 hidden w-0 cursor-col-resize lg:block"
            >
              <span className="absolute inset-y-0 -left-2 w-4" />
              <span className="absolute left-[-3px] top-1/2 flex h-14 w-[7px] -translate-y-1/2 items-center justify-center rounded-full bg-[#d8c8b2] opacity-0 transition-opacity group-hover:opacity-100">
                <GripVertical size={10} />
              </span>
            </div>
          )}

          <aside
            aria-label="Gaveta de propriedades"
            style={{ width: rightOpen ? rightWidth : 0 }}
            className="hidden shrink-0 overflow-hidden bg-[#fdfbf7] transition-[width] duration-300 lg:block"
          >
            <div className="h-full p-2" style={{ width: rightWidth }}>
              <div className="h-full overflow-y-auto border-[2px] border-[#cdbfae] bg-[#fffdfa]">
                <Inspector
                  key={`${selection?.kind ?? 'none'}-${selection && 'id' in selection ? selection.id : ''}-${selectedNode?.updatedAt ?? selectedTag?.updatedAt ?? ''}`}
                  node={selectedNode}
                  tag={selectedTag}
                  selection={selection}
                  nodes={store.nodes}
                  tags={store.tags}
                  onUpdateNode={updateNode}
                  onUpdateTag={updateTag}
                  onDuplicate={(id) => {
                    const copyId = duplicateNode(id)
                    if (copyId) {
                      setSelection({ kind: 'node', id: copyId })
                      showNotice('Cópia criada com sucesso.')
                    }
                  }}
                  onMoveNode={moveNode}
                  onTrashNode={(id) => {
                    moveNodeToTrash(id)
                    setSelection({ kind: 'node', id: 'home' })
                    showNotice('Conteúdo movido para a lixeira.')
                  }}
                  onTrashTag={(id) => {
                    moveTagToTrash(id)
                    setSelection({ kind: 'node', id: 'home' })
                    showNotice('Tag movida para a lixeira.')
                  }}
                  onOpenSchedule={() => setModalMode('schedule')}
                  onSaved={() => showNotice('Alterações salvas.')}
                />
              </div>
            </div>
          </aside>

          <aside
            aria-label="Gaveta de propriedades"
            className={`absolute inset-y-0 right-0 z-30 flex flex-col overflow-hidden bg-[#fdfbf7] shadow-2xl transition-[width,opacity] duration-300 lg:hidden ${rightOpen ? 'w-full opacity-100' : 'pointer-events-none w-0 opacity-0'}`}
          >
            <div className="min-h-0 w-full flex-1 overflow-y-auto">
              <div className="h-full overflow-y-auto bg-[#fffdfa]">
                <Inspector
                  key={`mobile-${selection?.kind ?? 'none'}-${selection && 'id' in selection ? selection.id : ''}-${selectedNode?.updatedAt ?? selectedTag?.updatedAt ?? ''}`}
                  node={selectedNode}
                  tag={selectedTag}
                  selection={selection}
                  nodes={store.nodes}
                  tags={store.tags}
                  onUpdateNode={updateNode}
                  onUpdateTag={updateTag}
                  onDuplicate={(id) => {
                    const copyId = duplicateNode(id)
                    if (copyId) setSelection({ kind: 'node', id: copyId })
                  }}
                  onMoveNode={moveNode}
                  onTrashNode={(id) => {
                    moveNodeToTrash(id)
                    setSelection({ kind: 'node', id: 'home' })
                  }}
                  onTrashTag={(id) => {
                    moveTagToTrash(id)
                    setSelection({ kind: 'node', id: 'home' })
                  }}
                  onOpenSchedule={() => setModalMode('schedule')}
                  onSaved={() => showNotice('Alterações salvas.')}
                />
              </div>
            </div>
          </aside>
        </div>
      </section>

      {notice && (
        <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 bg-[#122f55] px-4 py-2 text-sm text-white shadow-xl">
          {notice}
        </div>
      )}

      {modalMode && (
        <OrganizerModal
          mode={modalMode}
          store={store}
          parentId={selectedContainerId}
          selectedId={selectedNode?.id ?? null}
          onClose={() => setModalMode(null)}
          onCreateNode={createNode}
          onCreateTag={createTag}
          onSchedule={scheduleNode}
          onCreated={handleCreated}
          onClearActivities={() => {
            clearActivities()
            showNotice('Histórico de recentes limpo.')
          }}
          onChooseModule={(type) => setModalMode(type)}
        />
      )}
      {detailNode && (
        <OrganizerUsageModal node={detailNode} nodes={store.nodes} onClose={() => setDetailNodeId(null)} />
      )}
    </main>
  )
}

interface WorkspaceProps {
  selection: Selection
  selectedNode: OrganizerNode | null
  selectedTag: OrganizerTag | null
  nodes: OrganizerNode[]
  trash: ReturnType<typeof useOrganizerStore>['store']['trash']
  onSelectNode: (id: string) => void
  onOpenModal: (mode: OrganizerModalMode) => void
  onNavigateBack: (parentId: string) => void
  onTrashNode: (id: string) => void
  onRestore: (id: string) => void
  onDeletePermanently: (id: string) => void
}

function Workspace({
  selection,
  selectedNode,
  selectedTag,
  nodes,
  trash,
  onSelectNode,
  onOpenModal,
  onNavigateBack,
  onTrashNode,
  onRestore,
  onDeletePermanently,
}: WorkspaceProps) {
  if (selection?.kind === 'trash') {
    return (
      <div className="p-5 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-full bg-[#f1e6d5] p-3 text-[#b86b00]">
            <Trash2 size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Lixeira</h1>
            <p className="text-xs text-[#71685d]">Restaure conteúdos ou remova-os definitivamente.</p>
          </div>
        </div>
        {trash.length === 0 ? (
          <EmptyState icon={<Trash2 size={28} />} title="A lixeira está vazia" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {trash.map((entry) => (
              <article key={entry.id} className="border border-[#ddd1c1] bg-white p-4">
                <p className="text-xs font-semibold">{entry.payload.name}</p>
                <p className="mt-1 text-[10px] text-[#7d7367]">
                  {entry.kind === 'node' ? organizerTypeLabels[(entry.payload as OrganizerNode).type] : 'Tag'}{' '}
                  · excluído em {formatDate(entry.deletedAt)}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onRestore(entry.id)}
                    className="flex items-center gap-1 border border-[#183861] px-2 py-1.5 text-[11px] hover:bg-[#eef2f7]"
                  >
                    <RotateCcw size={13} /> Restaurar
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePermanently(entry.id)}
                    className="flex items-center gap-1 px-2 py-1.5 text-[11px] text-[#a0382f] hover:bg-[#fff0ed]"
                  >
                    <Trash2 size={13} /> Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (selectedTag) {
    const taggedNodes = nodes.filter((node) => node.tagIds.includes(selectedTag.id))
    return (
      <div className="p-5 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span
            className="h-8 w-8 rounded-full border-4 border-white shadow"
            style={{ backgroundColor: selectedTag.color }}
          />
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#a25f00]">Tag</p>
            <h1 className="text-2xl font-semibold">{selectedTag.name}</h1>
          </div>
        </div>
        {taggedNodes.length === 0 ? (
          <EmptyState icon={<Tag size={28} />} title="Nenhum item usa esta tag" />
        ) : (
          <ContentGrid nodes={taggedNodes} onSelectNode={onSelectNode} onDeleteNode={onTrashNode} />
        )}
      </div>
    )
  }

  if (!selectedNode)
    return (
      <EmptyState
        icon={<FolderOpen size={32} />}
        title="Selecione uma página ou conteúdo"
        detail="Use a gaveta esquerda para navegar pelo site."
      />
    )

  const workspaceNode =
    selectedNode.type === 'page' || selectedNode.type === 'folder'
      ? selectedNode
      : (nodes.find(
          (node) => node.id === selectedNode.parentId && (node.type === 'page' || node.type === 'folder'),
        ) ?? null)

  if (!workspaceNode)
    return (
      <EmptyState
        icon={<FolderOpen size={32} />}
        title="Conteúdo sem página vinculada"
        detail="Escolha uma página ou subpasta na gaveta esquerda."
      />
    )

  const childNodes = nodes.filter((node) => node.parentId === workspaceNode.id)
  const parent = nodes.find((node) => node.id === workspaceNode.parentId)
  const page = findOrganizerPage(nodes, workspaceNode)
  const previewRoute = page?.route

  return (
    <div className="p-5 sm:p-8">
      {workspaceNode.parentId && (
        <button
          type="button"
          onClick={() => onNavigateBack(workspaceNode.parentId as string)}
          className="mb-5 inline-flex items-center gap-2 border border-[#cfb78e] bg-white px-3 py-2 text-xs font-semibold text-[#183861] hover:border-[#b86b00] hover:bg-[#fbf2e3]"
        >
          <ArrowLeft size={15} />
          Voltar um nível
        </button>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-1 rounded-full bg-[#f1e6d5] p-3 text-[#b86b00]">
            {nodeIcon(workspaceNode.type, 22)}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#a25f00]">
              {organizerTypeLabels[workspaceNode.type]}
              {parent ? ` · ${parent.name}` : ''}
            </p>
            <h1 className="truncate text-2xl font-semibold sm:text-3xl">{workspaceNode.name}</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#71685d]">
              {workspaceNode.description || 'Sem descrição. Edite as propriedades na gaveta direita.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {workspaceNode.type === 'folder' ? (
            <span className="border border-[#cfb78e] bg-[#fbf2e3] px-3 py-2 text-xs text-[#8b5200]">
              Somente organização
            </span>
          ) : (
            <>
              <StatusPill status={workspaceNode.status} />
              <a
                href={previewRoute ?? '/'}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 border border-[#183861] bg-white px-3 py-2 text-xs hover:bg-[#eef2f7]"
              >
                <Eye size={15} /> Abrir no site
              </a>
              <button
                type="button"
                onClick={() => onOpenModal('schedule')}
                className="flex items-center gap-1.5 bg-[#122f55] px-3 py-2 text-xs text-white hover:bg-[#1b4677]"
              >
                <CalendarClock size={15} /> Agendar
              </button>
            </>
          )}
        </div>
      </div>

      {workspaceNode.scheduledAt && (
        <div className="mt-5 flex items-center gap-2 border-l-4 border-[#d89220] bg-[#fbf2e3] px-4 py-3 text-xs">
          <CalendarClock size={16} className="text-[#b86b00]" /> Publicação programada para{' '}
          {formatDate(workspaceNode.scheduledAt)}.
        </div>
      )}

      <section className="mt-8">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">
            {workspaceNode.type === 'folder' ? 'Adicionar à subpasta' : 'Adicionar à página'}
          </h2>
          <p className="text-[10px] text-[#7d7367]">Escolha o tipo de conteúdo que será exibido.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <QuickAction
            icon={<Layers3 size={20} />}
            title="Carrossel"
            detail="Selecione itens existentes para uma faixa deslizante."
            onClick={() => onOpenModal('carousel')}
          />
          <QuickAction
            icon={<LayoutGrid size={20} />}
            title="Catálogo"
            detail="Monte uma grade de produtos no modelo das páginas de categoria."
            onClick={() => onOpenModal('catalog')}
          />
          <QuickAction
            icon={<Sparkles size={20} />}
            title="Destaque"
            detail="Crie um banner com tamanho e imagem configuráveis."
            onClick={() => onOpenModal('highlight')}
          />
          <QuickAction
            icon={<Package size={20} />}
            title="Item"
            detail="Cadastre um produto com preço, imagem e tags."
            onClick={() => onOpenModal('item')}
          />
          <QuickAction
            icon={<FolderOpen size={20} />}
            title="Subpasta"
            detail="Organize módulos sem criar uma nova página no site."
            onClick={() => onOpenModal('folder')}
          />
        </div>
      </section>
      <section className="mt-8">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">
            {workspaceNode.type === 'folder' ? 'Conteúdo da subpasta' : 'Conteúdo da página'}
          </h2>
          <p className="text-[10px] text-[#7d7367]">{childNodes.length} bloco(s) organizado(s).</p>
        </div>
        {childNodes.length === 0 ? (
          <EmptyState
            icon={<Layers3 size={28} />}
            title={
              workspaceNode.type === 'folder'
                ? 'Esta subpasta ainda está vazia'
                : 'Esta página ainda está vazia'
            }
            detail="Use uma das opções acima para começar."
          />
        ) : (
          <ContentGrid nodes={childNodes} onSelectNode={onSelectNode} onDeleteNode={onTrashNode} />
        )}
      </section>
    </div>
  )
}

function ContentGrid({
  nodes,
  onSelectNode,
  onDeleteNode,
}: {
  nodes: OrganizerNode[]
  onSelectNode: (id: string) => void
  onDeleteNode: (id: string) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {nodes.map((node) => (
        <article
          key={node.id}
          className="group overflow-hidden border border-[#ddd1c1] bg-white hover:border-[#c27a08] hover:shadow-sm"
        >
          <button
            type="button"
            aria-label={`Abrir ${node.name}`}
            onClick={() => onSelectNode(node.id)}
            className="flex h-24 w-full items-center justify-center overflow-hidden bg-[#f4eee5] text-[#b86b00]"
          >
            {node.imageUrl ? (
              <img src={node.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              nodeIcon(node.type, 28)
            )}
          </button>
          <div className="p-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onSelectNode(node.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="truncate text-xs font-semibold">{node.name}</span>
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#d89220]" />
              </button>
              {!node.immutable && (
                <button
                  type="button"
                  aria-label={`Excluir ${node.name}`}
                  title="Mover para a lixeira"
                  onClick={() => onDeleteNode(node.id)}
                  className="shrink-0 rounded p-1 text-[#9b5a50] hover:bg-[#fff0ed] hover:text-[#a0382f]"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => onSelectNode(node.id)}
              className="mt-1 block w-full text-left text-[10px] text-[#7d7367]"
            >
              {organizerTypeLabels[node.type]} ·{' '}
              {node.type === 'folder' ? 'Somente organização' : organizerStatusLabels[node.status]}
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

function OrganizerUsageModal({
  node,
  nodes,
  onClose,
}: {
  node: OrganizerNode
  nodes: OrganizerNode[]
  onClose: () => void
}) {
  const parentPage = findOrganizerPage(nodes, node)
  const folderContents =
    node.type === 'folder' ? nodes.filter((candidate) => candidate.parentId === node.id) : []
  const selectedItems = node.itemIds
    .map((id) => nodes.find((candidate) => candidate.id === id && candidate.type === 'item'))
    .filter((item): item is OrganizerNode => Boolean(item))
  const itemUsages =
    node.type === 'item'
      ? nodes.filter(
          (candidate) =>
            (candidate.type === 'carousel' || candidate.type === 'catalog') &&
            candidate.itemIds.includes(node.id),
        )
      : []
  const quantityLabel =
    node.type === 'item'
      ? `${itemUsages.length} módulo(s)`
      : node.type === 'carousel' || node.type === 'catalog'
        ? `${node.itemIds.length} produto(s)`
        : node.type === 'folder'
          ? `${folderContents.length} conteúdo(s)`
          : parentPage
            ? '1 utilização'
            : '0 utilizações'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="usage-modal-title"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Fechar detalhes de uso"
        onClick={onClose}
        className="absolute inset-0 bg-[#081b32]/45 backdrop-blur-[2px]"
      />
      <section className="relative z-10 flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden border-[2px] border-[#183861] bg-[#fffdfa] shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 bg-[#122f55] px-5 py-4 text-white">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e2b04f]">
              Detalhes de uso
            </p>
            <h2 id="usage-modal-title" className="mt-1 text-lg font-semibold">
              {node.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded p-1.5 hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <UsageMetric label="Tipo" value={organizerTypeLabels[node.type]} />
            <UsageMetric label="Quantidade usada" value={quantityLabel} />
            <UsageMetric
              label="Status"
              value={node.type === 'folder' ? 'Somente organização' : organizerStatusLabels[node.status]}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <UsageDetail label="Página" value={parentPage?.name ?? 'Sem página vinculada'} />
            <UsageDetail label="Última atualização" value={formatDate(node.updatedAt)} />
          </div>

          {node.description ? (
            <div className="border border-[#ded2c2] bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b7963]">
                Descrição
              </p>
              <p className="mt-2 text-sm leading-6 text-[#302a24]">{node.description}</p>
            </div>
          ) : null}

          {(node.type === 'carousel' || node.type === 'catalog') && (
            <UsageProductCards
              title={node.type === 'catalog' ? 'Produtos utilizados' : 'Itens utilizados'}
              items={selectedItems}
              empty="Nenhum produto foi incluído neste módulo."
            />
          )}

          {node.type === 'item' && (
            <UsageList
              title="Onde este item é utilizado"
              items={itemUsages.map((usage) => {
                const page = nodes.find((candidate) => candidate.id === usage.parentId)
                return `${usage.name}${page ? ` · ${page.name}` : ''}`
              })}
              empty="Este item ainda não foi incluído em nenhum catálogo ou carrossel."
            />
          )}
        </div>

        <footer className="shrink-0 border-t border-[#ded2c2] bg-[#fffdfa] p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-[#122f55] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1b4677]"
          >
            Fechar detalhes
          </button>
        </footer>
      </section>
    </div>
  )
}

function UsageMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#d8c9b5] bg-[#f7efe3] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#846f56]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#122f55]">{value}</p>
    </div>
  )
}

function UsageDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[#ded2c2] pb-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b7963]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#302a24]">{value}</p>
    </div>
  )
}

function UsageProductCards({
  title,
  items,
  empty,
}: {
  title: string
  items: OrganizerNode[]
  empty: string
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[#122f55]">
        {title} · {items.length}
      </h3>
      {items.length > 0 ? (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="flex gap-3 border border-[#ded2c2] bg-white p-2.5">
              <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden bg-[#f3ece1] text-[#b86b00]">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package size={24} />
                )}
              </div>
              <div className="min-w-0 py-1">
                <p className="truncate text-sm font-semibold text-[#122f55]">{item.name}</p>
                <p className="mt-1 text-xs text-[#756a5d]">
                  {item.price > 0
                    ? item.price.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })
                    : 'Preço não informado'}
                </p>
                <span className="mt-2 inline-flex bg-[#f7efe3] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#9a6109]">
                  Em uso
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-2 border border-dashed border-[#d8c9b5] bg-[#fcfaf6] p-4 text-xs text-[#756a5d]">
          {empty}
        </p>
      )}
    </div>
  )
}

function UsageList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[#122f55]">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-2 divide-y divide-[#e8ded0] border border-[#ded2c2] bg-white">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex items-center gap-2 px-3 py-2.5 text-xs">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c27a08]" />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 border border-dashed border-[#d8c9b5] bg-[#fcfaf6] p-4 text-xs text-[#756a5d]">
          {empty}
        </p>
      )}
    </div>
  )
}

interface InspectorProps {
  node: OrganizerNode | null
  tag: OrganizerTag | null
  selection: Selection
  nodes: OrganizerNode[]
  tags: OrganizerTag[]
  onUpdateNode: (id: string, changes: Partial<OrganizerNode>) => void
  onUpdateTag: (id: string, changes: Partial<OrganizerTag>) => void
  onDuplicate: (id: string) => void
  onMoveNode: (id: string, direction: 'up' | 'down') => void
  onTrashNode: (id: string) => void
  onTrashTag: (id: string) => void
  onOpenSchedule: () => void
  onSaved: () => void
}

function Inspector({
  node,
  tag,
  selection,
  nodes,
  tags,
  onUpdateNode,
  onUpdateTag,
  onDuplicate,
  onMoveNode,
  onTrashNode,
  onTrashTag,
  onOpenSchedule,
  onSaved,
}: InspectorProps) {
  const [nodeDraft, setNodeDraft] = useState(() =>
    node
      ? {
          name: node.name,
          description: node.description,
          status: node.status,
          parentId: node.parentId ?? 'home',
          imageUrl: node.imageUrl ?? '',
          price: String(node.price || ''),
          size: node.size ?? 'medium',
          tagIds: node.tagIds,
          itemIds: node.itemIds,
        }
      : null,
  )
  const [tagDraft, setTagDraft] = useState(() => (tag ? { name: tag.name, color: tag.color } : null))

  if (selection?.kind === 'trash')
    return <InspectorEmpty title="Lixeira aberta" detail="Use o painel central para restaurar conteúdos." />
  if (!node && !tag)
    return <InspectorEmpty title="Propriedades" detail="Selecione um conteúdo para editar seus detalhes." />

  if (tag && tagDraft) {
    const submitTag = (event: FormEvent) => {
      event.preventDefault()
      if (!tagDraft.name.trim()) return
      onUpdateTag(tag.id, { name: tagDraft.name.trim(), color: tagDraft.color })
      onSaved()
    }
    return (
      <form onSubmit={submitTag} className="p-4">
        <InspectorHeading icon={<Tag size={18} />} title="Propriedades da tag" />
        <Field label="Nome">
          <input
            value={tagDraft.name}
            onChange={(event) => setTagDraft({ ...tagDraft, name: event.target.value })}
            className="organizer-input"
          />
        </Field>
        <Field label="Cor">
          <div className="flex gap-2">
            <input
              type="color"
              value={tagDraft.color}
              onChange={(event) => setTagDraft({ ...tagDraft, color: event.target.value })}
              className="h-10 w-12 border border-[#d8cdbc] bg-white p-1"
            />
            <input
              value={tagDraft.color}
              onChange={(event) => setTagDraft({ ...tagDraft, color: event.target.value })}
              className="organizer-input flex-1"
            />
          </div>
        </Field>
        <InspectorActions onSaveLabel="Salvar tag" onDelete={() => onTrashTag(tag.id)} />
      </form>
    )
  }

  if (!node || !nodeDraft) return null
  const invalidParentIds = new Set([node.id])
  let foundDescendant = true
  while (foundDescendant) {
    foundDescendant = false
    nodes.forEach((candidate) => {
      if (
        candidate.parentId &&
        invalidParentIds.has(candidate.parentId) &&
        !invalidParentIds.has(candidate.id)
      ) {
        invalidParentIds.add(candidate.id)
        foundDescendant = true
      }
    })
  }
  const containerOptions = nodes.filter(
    (candidate) =>
      (candidate.type === 'page' || candidate.type === 'folder') && !invalidParentIds.has(candidate.id),
  )
  const items = nodes.filter((candidate) => candidate.type === 'item')
  const protectedPage = node.type === 'page' && Boolean(node.immutable)
  const submitNode = (event: FormEvent) => {
    event.preventDefault()
    if (!nodeDraft.name.trim()) return
    onUpdateNode(node.id, {
      name: node.immutable ? node.name : nodeDraft.name.trim(),
      description: nodeDraft.description.trim(),
      status: nodeDraft.status,
      parentId: node.type === 'page' ? null : nodeDraft.parentId,
      imageUrl: nodeDraft.imageUrl.trim(),
      price: Number(nodeDraft.price) || 0,
      size: nodeDraft.size,
      tagIds: nodeDraft.tagIds,
      itemIds: nodeDraft.itemIds,
    })
    onSaved()
  }
  const toggleInList = (key: 'tagIds' | 'itemIds', id: string) => {
    const current = nodeDraft[key]
    setNodeDraft({
      ...nodeDraft,
      [key]: current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    })
  }

  const handleImageFile = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        setNodeDraft({ ...nodeDraft, imageUrl: reader.result })
      }
    })
    reader.readAsDataURL(file)
  }

  return (
    <form onSubmit={submitNode} className="p-4">
      <InspectorHeading icon={nodeIcon(node.type)} title="Propriedades" />
      <div className="mb-4 flex items-center justify-between gap-2 bg-[#f4eee5] px-3 py-2">
        <span className="text-[10px] uppercase tracking-wider text-[#7d7367]">
          {organizerTypeLabels[node.type]}
        </span>
        {node.type === 'folder' ? (
          <span className="text-[10px] font-semibold text-[#8b5200]">Somente organização</span>
        ) : (
          <StatusPill status={node.status} compact />
        )}
      </div>
      <Field label="Nome">
        <input
          value={nodeDraft.name}
          disabled={node.immutable}
          onChange={(event) => setNodeDraft({ ...nodeDraft, name: event.target.value })}
          className="organizer-input disabled:bg-[#eee8df] disabled:text-[#777067]"
        />
      </Field>
      <Field label="Descrição">
        <textarea
          value={nodeDraft.description}
          onChange={(event) => setNodeDraft({ ...nodeDraft, description: event.target.value })}
          rows={4}
          className="organizer-input resize-y"
        />
      </Field>
      {node.type !== 'folder' && (
        <Field label="Status">
          <select
            value={nodeDraft.status}
            onChange={(event) =>
              setNodeDraft({ ...nodeDraft, status: event.target.value as OrganizerNode['status'] })
            }
            className="organizer-input"
          >
            <option value="draft">Rascunho</option>
            <option value="published">Publicado</option>
            {node.scheduledAt && <option value="scheduled">Agendado</option>}
          </select>
        </Field>
      )}
      {node.type !== 'page' && (
        <Field label="Página ou subpasta">
          <select
            value={nodeDraft.parentId}
            onChange={(event) => setNodeDraft({ ...nodeDraft, parentId: event.target.value })}
            className="organizer-input"
          >
            {containerOptions.map((container) => (
              <option key={container.id} value={container.id}>
                {container.type === 'folder' ? '↳ ' : ''}
                {container.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {(node.type === 'item' || node.type === 'highlight') && (
        <div className="mb-4">
          <Field label="Endereço da imagem">
            <input
              value={nodeDraft.imageUrl.startsWith('data:') ? '' : nodeDraft.imageUrl}
              onChange={(event) => setNodeDraft({ ...nodeDraft, imageUrl: event.target.value })}
              placeholder="https://..."
              className="organizer-input"
            />
          </Field>
          <label className="flex cursor-pointer items-center justify-center gap-2 border border-[#cfb78e] px-3 py-2 text-xs hover:bg-[#f6eee2]">
            <ImageIcon size={15} /> Enviar arquivo
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => handleImageFile(event.target.files?.[0])}
            />
          </label>
          {nodeDraft.imageUrl && (
            <img src={nodeDraft.imageUrl} alt="Prévia" className="mt-2 h-24 w-full object-cover" />
          )}
        </div>
      )}
      {node.type === 'item' && (
        <Field label="Preço">
          <input
            value={nodeDraft.price}
            onChange={(event) => setNodeDraft({ ...nodeDraft, price: event.target.value })}
            placeholder="R$ 0,00"
            className="organizer-input"
          />
        </Field>
      )}
      {node.type === 'highlight' && (
        <Field label="Tamanho">
          <select
            value={nodeDraft.size}
            onChange={(event) =>
              setNodeDraft({ ...nodeDraft, size: event.target.value as OrganizerNode['size'] })
            }
            className="organizer-input"
          >
            <option value="small">Pequeno</option>
            <option value="medium">Médio</option>
            <option value="large">Grande</option>
          </select>
        </Field>
      )}
      {node.type === 'item' && tags.length > 0 && (
        <ChoiceList
          label="Tags"
          options={tags.map((item) => ({ id: item.id, label: item.name }))}
          selected={nodeDraft.tagIds}
          onToggle={(id) => toggleInList('tagIds', id)}
        />
      )}
      {(node.type === 'carousel' || node.type === 'catalog') && (
        <ItemCardChoiceList
          label={node.type === 'catalog' ? 'Produtos do catálogo' : 'Itens do carrossel'}
          items={items}
          selected={nodeDraft.itemIds}
          onToggle={(id) => toggleInList('itemIds', id)}
          empty={
            node.type === 'catalog'
              ? 'Crie itens antes de preencher o catálogo.'
              : 'Crie itens antes de preencher o carrossel.'
          }
        />
      )}
      {node.type !== 'folder' && (
        <button
          type="button"
          onClick={onOpenSchedule}
          className="mt-2 flex w-full items-center justify-center gap-2 border border-[#cfb78e] px-3 py-2 text-xs hover:bg-[#f6eee2]"
        >
          <CalendarClock size={15} />
          {node.scheduledAt ? formatDate(node.scheduledAt) : 'Agendar publicação'}
        </button>
      )}
      {!node.immutable && !protectedPage && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onMoveNode(node.id, 'up')}
            className="flex items-center justify-center gap-1 border border-[#d8cdbc] px-2 py-2 text-[10px] hover:bg-[#f6eee2]"
          >
            <ArrowUp size={13} /> Mover acima
          </button>
          <button
            type="button"
            onClick={() => onMoveNode(node.id, 'down')}
            className="flex items-center justify-center gap-1 border border-[#d8cdbc] px-2 py-2 text-[10px] hover:bg-[#f6eee2]"
          >
            <ArrowDown size={13} /> Mover abaixo
          </button>
        </div>
      )}
      <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
        <button
          type="submit"
          className="flex items-center justify-center gap-2 bg-[#122f55] px-3 py-2.5 text-xs font-medium text-white hover:bg-[#1b4677]"
        >
          <Save size={15} /> Salvar alterações
        </button>
        {!node.immutable && !protectedPage && (
          <button
            type="button"
            title="Duplicar"
            aria-label="Duplicar conteúdo"
            onClick={() => onDuplicate(node.id)}
            className="border border-[#183861] p-2.5 hover:bg-[#eef2f7]"
          >
            <Copy size={16} />
          </button>
        )}
      </div>
      {!node.immutable && !protectedPage && (
        <button
          type="button"
          onClick={() => onTrashNode(node.id)}
          className="mt-2 flex w-full items-center justify-center gap-2 px-3 py-2 text-xs text-[#a0382f] hover:bg-[#fff0ed]"
        >
          <Trash2 size={15} /> Mover para a lixeira
        </button>
      )}
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#766e64]">
        {label}
      </span>
      {children}
    </label>
  )
}

function ChoiceList({
  label,
  options,
  selected,
  onToggle,
  empty = 'Nenhuma opção disponível.',
}: {
  label: string
  options: Array<{ id: string; label: string }>
  selected: string[]
  onToggle: (id: string) => void
  empty?: string
}) {
  return (
    <fieldset className="mb-4">
      <legend className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#766e64]">
        {label}
      </legend>
      <div className="max-h-32 overflow-y-auto border border-[#d8cdbc] bg-white p-2">
        {options.length === 0 ? (
          <p className="text-[10px] text-[#7d7367]">{empty}</p>
        ) : (
          options.map((option) => (
            <label key={option.id} className="flex items-center gap-2 py-1 text-xs">
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={() => onToggle(option.id)}
                className="accent-[#b86b00]"
              />
              <span className="truncate">{option.label}</span>
            </label>
          ))
        )}
      </div>
    </fieldset>
  )
}

function ItemCardChoiceList({
  label,
  items,
  selected,
  onToggle,
  empty,
}: {
  label: string
  items: OrganizerNode[]
  selected: string[]
  onToggle: (id: string) => void
  empty: string
}) {
  return (
    <fieldset className="mb-4">
      <legend className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#766e64]">
        {label} · {selected.length} selecionado(s)
      </legend>
      {items.length === 0 ? (
        <p className="border border-dashed border-[#d8cdbc] bg-[#fcfaf6] p-3 text-[10px] text-[#7d7367]">
          {empty}
        </p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {items.map((item) => {
            const checked = selected.includes(item.id)
            return (
              <label
                key={item.id}
                className={`flex cursor-pointer gap-3 border p-2 transition ${
                  checked
                    ? 'border-[#c27a08] bg-[#fff7e8] shadow-sm'
                    : 'border-[#d8cdbc] bg-white hover:border-[#cfad76]'
                }`}
              >
                <span className="flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden bg-[#f3ece1] text-[#b86b00]">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package size={22} />
                  )}
                </span>
                <span className="min-w-0 flex-1 py-0.5">
                  <span className="block truncate text-xs font-semibold text-[#122f55]">{item.name}</span>
                  <span className="mt-1 block text-[10px] text-[#7d7367]">
                    {item.price > 0
                      ? item.price.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })
                      : 'Preço não informado'}
                  </span>
                  <span className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-[#9a6109]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(item.id)}
                      className="accent-[#b86b00]"
                    />
                    {checked ? 'Usando neste módulo' : 'Adicionar ao módulo'}
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

function InspectorActions({ onSaveLabel, onDelete }: { onSaveLabel: string; onDelete: () => void }) {
  return (
    <div className="mt-6 space-y-2">
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 bg-[#122f55] px-3 py-2.5 text-xs text-white hover:bg-[#1b4677]"
      >
        <Save size={15} /> {onSaveLabel}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex w-full items-center justify-center gap-2 px-3 py-2 text-xs text-[#a0382f] hover:bg-[#fff0ed]"
      >
        <Trash2 size={15} /> Mover para a lixeira
      </button>
    </div>
  )
}

function InspectorHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-2 border-b border-[#e8ded0] pb-3">
      <span className="text-[#b86b00]">{icon}</span>
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
  )
}

function InspectorEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center p-6 text-center">
      <Settings size={28} className="mb-3 text-[#b9a991]" />
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-[10px] leading-relaxed text-[#7d7367]">{detail}</p>
    </div>
  )
}

function QuickAction({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group border border-[#d9cebf] bg-white p-4 text-left hover:border-[#c27a08] hover:bg-[#fffbf4]"
    >
      <span className="mb-3 inline-flex rounded-full bg-[#f1e6d5] p-2.5 text-[#b86b00] group-hover:bg-[#ead6b7]">
        {icon}
      </span>
      <span className="block text-sm font-semibold">{title}</span>
      <span className="mt-1 block text-[10px] leading-relaxed text-[#71685d]">{detail}</span>
    </button>
  )
}

function EmptyState({ icon, title, detail }: { icon: React.ReactNode; title: string; detail?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center border border-dashed border-[#d8cdbc] bg-[#fcfaf6] p-6 text-center text-[#9d8f7c]">
      {icon}
      <p className="mt-3 text-sm font-medium text-[#334969]">{title}</p>
      {detail && <p className="mt-1 text-[10px]">{detail}</p>}
    </div>
  )
}

function StatusPill({ status, compact = false }: { status: OrganizerNode['status']; compact?: boolean }) {
  const colors = {
    draft: 'bg-[#eee8df] text-[#665e54]',
    scheduled: 'bg-[#fff0ce] text-[#8b5700]',
    published: 'bg-[#e5f0e8] text-[#27633a]',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full ${colors[status]} ${compact ? 'px-2 py-1 text-[9px]' : 'px-3 py-2 text-[10px]'}`}
    >
      {organizerStatusLabels[status]}
    </span>
  )
}

function DrawerToggle({
  drawer,
  open,
  onToggle,
}: {
  drawer: DrawerName
  open: boolean
  onToggle: () => void
}) {
  const isLeft = drawer === 'left'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${open ? 'Fechar' : 'Abrir'} gaveta ${isLeft ? 'esquerda' : 'direita'}`}
      title={`${open ? 'Fechar' : 'Abrir'} gaveta ${isLeft ? 'esquerda' : 'direita'}`}
      className="flex h-8 w-8 items-center justify-center rounded border border-[#e0a83f] bg-[#fffaf0] text-[#17365e] shadow-sm transition hover:bg-[#f7e9cf] focus:outline-none focus:ring-2 focus:ring-[#e0a83f]"
    >
      {isLeft ? <PanelLeft size={18} /> : <PanelRight size={18} />}
    </button>
  )
}

export default OrganizerPage
