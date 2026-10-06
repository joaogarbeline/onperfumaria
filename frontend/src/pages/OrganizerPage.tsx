import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  CircleUserRound,
  Copy,
  Eye,
  FileText,
  FolderOpen,
  GripVertical,
  History,
  Image as ImageIcon,
  LayoutGrid,
  Layers3,
  LogOut,
  Package,
  PanelLeft,
  PanelRight,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { OrganizerModal, type OrganizerModalMode } from '../components/organizer/OrganizerModal'
import { ItemWizard } from '../components/organizer/ItemWizard'
import { useAuth } from '../contexts/AuthContext'
import { useOrganizerStore } from '../hooks/useOrganizerStore'
import { useCurrency } from '../hooks/useCurrency'
import { api } from '../services/api'
import { getOrderStatusPresentation } from '../utils/orders'
import type { CustomerOrder } from '../types'
import {
  emptyItemWizardDraft,
  findOrganizerPage,
  organizerItemStatusOptions,
  organizerStatusLabels,
  organizerTypeLabels,
  normalizeOrganizerSearch,
  withOrganizerPreview,
} from '../types/organizer'
import type {
  ItemWizardDraft,
  ItemWizardStep,
  OrganizerActivity,
  OrganizerContentType,
  OrganizerNode,
  OrganizerTag,
  OrganizerTrashEntry,
} from '../types/organizer'

type DrawerName = 'left' | 'right'
type Selection = { kind: 'node'; id: string } | { kind: 'tag'; id: string } | null
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
const MAX_RIGHT_WIDTH = 760

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
  const { isCustomer, isAdmin, token, logout } = useAuth()
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
  } = useOrganizerStore(token ?? undefined)

  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [rightWidth, setRightWidth] = useState(250)
  const [rightResizing, setRightResizing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selection, setSelection] = useState<Selection>({ kind: 'node', id: 'home' })
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<OrganizerModalMode | null>(null)
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [customersOpen, setCustomersOpen] = useState(false)
  const [wizardDraft, setWizardDraft] = useState<ItemWizardDraft | null>(null)
  const [wizardStep, setWizardStep] = useState<ItemWizardStep>(1)
  const [visitorPreview, setVisitorPreview] = useState<{ name: string; route: string } | null>(null)
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
  const isItemPageFocused = Boolean(
    selectedNode && selectedNode.type === 'item' && focusedItemId === selectedNode.id,
  )

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
    closeOpenSession()
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
      setDetailNodeId(
        targetNode.type === 'page' || targetNode.type === 'folder' || targetNode.type === 'item'
          ? null
          : targetNode.id,
      )
      if (item.kind !== 'activity') recordAccess(targetId, item.label)
      closeDrawersOnMobile()
    }
  }

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const shell = shellRef.current
    if (!shell) return
    const handle = event.currentTarget
    const pointerId = event.pointerId
    const startX = event.clientX
    const startWidth = rightWidth
    setRightResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    handle.setPointerCapture(pointerId)

    const handleMove = (moveEvent: PointerEvent) => {
      const shellWidth = shell.getBoundingClientRect().width
      const maxAllowed = Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, shellWidth * 0.7))
      setRightWidth(Math.max(MIN_RIGHT_WIDTH, Math.min(maxAllowed, startWidth + startX - moveEvent.clientX)))
    }
    const handleEnd = () => {
      setRightResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (handle.hasPointerCapture(pointerId)) {
        handle.releasePointerCapture(pointerId)
      }
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleEnd)
  }

  const openItemWizard = (parentId: string) => {
    setWizardDraft(emptyItemWizardDraft(parentId))
    setWizardStep(1)
  }

  const closeItemWizard = () => {
    setWizardDraft(null)
    setWizardStep(1)
  }

  const closeOpenSession = () => {
    setSettingsOpen(false)
    setTrashOpen(false)
    setHistoryOpen(false)
    setCustomersOpen(false)
    setVisitorPreview(null)
    setFocusedItemId(null)
    closeItemWizard()
  }

  const finishItemWizard = () => {
    if (!wizardDraft || !wizardDraft.name.trim()) return
    const id = createNode({
      name: wizardDraft.name,
      type: 'item',
      parentId: wizardDraft.parentId,
      description: wizardDraft.description,
      imageUrl: wizardDraft.photos[0] ?? '',
      price: Number(wizardDraft.price) || 0,
      tagIds: wizardDraft.tagId ? [wizardDraft.tagId] : [],
      status: wizardDraft.status,
    })
    closeItemWizard()
    setSelection({ kind: 'node', id })
    setFocusedItemId(id)
    showNotice('Item criado com sucesso.')
  }

  const handleLogoff = () => {
    logout()
    window.location.href = '/'
  }

  const openTagFromSettings = (tagId: string) => {
    setSelection({ kind: 'tag', id: tagId })
    recordAccess(tagId, store.tags.find((tag) => tag.id === tagId)?.name ?? 'Tag')
    setSettingsOpen(false)
  }

  const openActivityFromHistory = (targetId: string | null) => {
    if (!targetId) return
    const targetNode = store.nodes.find((node) => node.id === targetId)
    if (!targetNode) return
    setSelection({ kind: 'node', id: targetId })
    setDetailNodeId(
      targetNode.type === 'page' || targetNode.type === 'folder' || targetNode.type === 'item'
        ? null
        : targetNode.id,
    )
    setFocusedItemId(null)
    setHistoryOpen(false)
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
      key: 'organization',
      label: 'Organização',
      empty: searchQuery ? 'Nenhum conteúdo encontrado' : 'Não há páginas',
      onAdd: () => setModalMode('page'),
      addLabel: 'Criar nova página do site',
    },
  ]

  const handleOpenModal = (mode: OrganizerModalMode) => {
    if (mode === 'item') {
      openItemWizard(selectedContainerId)
      return
    }
    setModalMode(mode)
  }

  const workspaceElement = (
    <Workspace
      selectedNode={selectedNode}
      selectedTag={selectedTag}
      nodes={store.nodes}
      focusedItemId={focusedItemId}
      onSelectNode={(id) => {
        const node = store.nodes.find((candidate) => candidate.id === id)
        const alreadySelected = selection?.kind === 'node' && selection.id === id
        if (node?.type === 'item' && alreadySelected) {
          setFocusedItemId(id)
          return
        }
        setSelection({ kind: 'node', id })
        setDetailNodeId(null)
        setFocusedItemId(null)
        recordAccess(id, node?.name ?? 'Conteúdo')
      }}
      onOpenModal={handleOpenModal}
      onNavigateBack={(parentId) => {
        setDetailNodeId(null)
        setFocusedItemId(null)
        setSelection({ kind: 'node', id: parentId })
        setRightOpen(false)
      }}
      onTrashNode={(id) => {
        moveNodeToTrash(id)
        setDetailNodeId(null)
        showNotice('Conteúdo movido para a lixeira.')
      }}
    />
  )

  const wizardPages = store.nodes.filter((node) => node.type === 'page')
  const wizardDiscountTags = store.tags.filter((tag) => (tag.discountPercent ?? 0) > 0)
  const rightDrawerVisible = rightOpen && !settingsOpen && !wizardDraft

  if (!isCustomer) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return (
      <main className="organizer-font flex h-dvh w-full items-center justify-center bg-[var(--color-organizer-bg)] p-6 text-[#2a0f3d]">
        <div className="organizer-surface max-w-sm space-y-4 p-8 text-center">
          <ShieldAlert size={32} className="mx-auto text-[#a0382f]" />
          <h1 className="text-lg font-semibold">Acesso restrito</h1>
          <p className="text-sm text-[#6b665f]">Sua conta nao tem permissao de administrador.</p>
          <Link to="/">
            <Button variant="secondary" fullWidth>
              Voltar ao site
            </Button>
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="organizer-font h-dvh w-full overflow-hidden bg-[var(--color-organizer-bg)] text-[#2a0f3d]">
      <section
        ref={shellRef}
        className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-[var(--color-organizer-bg)]"
      >
        <header className="flex h-14 shrink-0 items-center justify-between bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)] px-3 shadow-[var(--shadow-organizer)] sm:px-4">
          <DrawerToggle drawer="left" open={leftOpen} onToggle={toggleLeftDrawer} />
          <div className="flex items-center gap-2 text-[#f5ca74]">
            <Layers3 size={17} />
            <span className="hidden text-xs font-semibold uppercase tracking-[0.22em] sm:inline">Admin</span>
          </div>
          {settingsOpen ? (
            <span className="h-8 w-8" aria-hidden="true" />
          ) : (
            <DrawerToggle drawer="right" open={rightOpen} onToggle={toggleRightDrawer} />
          )}
        </header>

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <aside
            aria-label="Gaveta de organização"
            className={`absolute inset-y-0 left-0 z-30 flex flex-col overflow-hidden bg-[#fdfbf7] shadow-2xl transition-[width,opacity] duration-300 lg:relative lg:inset-auto lg:z-auto lg:shrink-0 lg:shadow-none ${leftOpen ? 'w-full opacity-100 lg:w-[250px]' : 'pointer-events-none w-0 opacity-0'}`}
          >
            <div className="min-h-0 w-full flex-1 overflow-y-auto px-3 pt-3 sm:px-5 lg:w-[250px] lg:px-3">
              <label className="flex h-10 items-center rounded-xl border border-stone-200 bg-white px-3 text-[#2a0f3d] focus-within:border-[#d89a28] focus-within:ring-4 focus-within:ring-[#f7dfb1]">
                <span className="sr-only">Buscar no organizador</span>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Busca"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    aria-label="Limpar busca"
                    onClick={() => setSearchQuery('')}
                    className="rounded-full p-1 text-[#6b665f] hover:bg-[#fff1d6] hover:text-[#b77717]"
                  >
                    <X size={18} />
                  </button>
                ) : (
                  <Search size={18} className="text-[#b77717]" />
                )}
              </label>

              <nav className="mt-3" aria-label="Seções do organizador">
                {sectionConfig.map((section) => {
                  const items = filteredSections[section.key]
                  return (
                    <div key={section.key} className="border-b border-stone-200/80 py-2 last:border-0">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSections((current) => ({
                              ...current,
                              [section.key]: !current[section.key],
                            }))
                          }
                          className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium hover:text-[#b77717]"
                        >
                          <ChevronDown
                            size={14}
                            className={`shrink-0 transition-transform ${openSections[section.key] ? '' : '-rotate-90'}`}
                          />
                          <span className="truncate">{section.label}</span>
                          <span className="ml-auto text-[10px] text-[#6b665f]">{items.length}</span>
                        </button>
                        <button
                          type="button"
                          title={section.addLabel}
                          aria-label={section.addLabel}
                          onClick={section.onAdd}
                          className="rounded-full p-1 text-[#b77717] hover:bg-[#fff1d6]"
                        >
                          <Plus size={17} />
                        </button>
                      </div>
                      {openSections[section.key] && (
                        <div className="mt-1 space-y-0.5">
                          {items.length === 0 ? (
                            <p className="px-5 py-1 text-[10px] text-[#6b665f]">{section.empty}</p>
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
                                    className={`mt-1 flex items-stretch rounded-xl ${isSelected ? 'bg-[#fff1d6] text-[#8b5200]' : 'bg-stone-50 hover:bg-[#fff8ea]'}`}
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
                                      className="flex w-7 shrink-0 items-center justify-center text-[#b77717]"
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
                                        <FolderOpen size={14} className="shrink-0 text-[#b77717]" />
                                        <span className="truncate">{item.label}</span>
                                        <span className="ml-auto text-[9px] font-normal text-[#6b665f]">
                                          {childCount}
                                        </span>
                                      </span>
                                      <span className="mt-0.5 block truncate pl-[22px] text-[9px] text-[#6b665f]">
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
                                  className={`block w-full rounded-xl py-1.5 pr-1 text-left transition-colors ${isSelected ? 'bg-[#fff1d6] text-[#b77717]' : 'hover:bg-stone-50'} ${item.depth ? 'ml-3 w-[calc(100%-0.75rem)] border-l-2 border-stone-200 pl-5' : 'pl-5'}`}
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
                                  <span className="mt-0.5 block truncate pl-[18px] text-[9px] text-[#6b665f]">
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

            <div className="relative flex h-16 w-full shrink-0 items-center gap-1 border-t border-stone-200/70 bg-[var(--color-organizer-bg)] px-3 sm:px-5 lg:w-[250px] lg:px-3">
              <div
                aria-hidden={!profileOpen}
                className={`organizer-surface absolute bottom-[4.25rem] left-3 right-3 z-30 overflow-hidden lg:right-auto lg:w-52 ${profileOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    const wasVisitorPreview = Boolean(visitorPreview)
                    closeOpenSession()
                    if (!wasVisitorPreview) {
                      const visitorPage = selectedNode ? findOrganizerPage(store.nodes, selectedNode) : null
                      setVisitorPreview({
                        name: visitorPage?.name ?? 'Home',
                        route: withOrganizerPreview(visitorPage?.route ?? '/', true),
                      })
                    }
                    setProfileOpen(false)
                  }}
                  className="flex w-full items-center gap-2 border-b border-stone-100 px-3 py-2.5 text-left text-xs hover:bg-[#fff8ea]"
                >
                  <Eye size={15} /> {visitorPreview ? 'Modo administrador' : 'Modo visitante'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeOpenSession()
                    setSettingsOpen(true)
                    setProfileOpen(false)
                  }}
                  className="flex w-full items-center gap-2 border-b border-stone-100 px-3 py-2.5 text-left text-xs hover:bg-[#fff8ea]"
                >
                  <Settings size={15} /> Configurações
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeOpenSession()
                    setTrashOpen(true)
                    setProfileOpen(false)
                  }}
                  className="flex w-full items-center gap-2 border-b border-stone-100 px-3 py-2.5 text-left text-xs hover:bg-[#fff8ea]"
                >
                  <Trash2 size={15} /> Lixeira
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeOpenSession()
                    setHistoryOpen(true)
                    setProfileOpen(false)
                  }}
                  className="flex w-full items-center gap-2 border-b border-stone-100 px-3 py-2.5 text-left text-xs hover:bg-[#fff8ea]"
                >
                  <History size={15} /> Histórico
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeOpenSession()
                    setCustomersOpen(true)
                    setProfileOpen(false)
                  }}
                  className="flex w-full items-center gap-2 border-b border-stone-100 px-3 py-2.5 text-left text-xs hover:bg-[#fff8ea]"
                >
                  <Users size={15} /> Clientes
                </button>
                <button
                  type="button"
                  onClick={handleLogoff}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-[#a0382f] hover:bg-[#fff0ed]"
                >
                  <LogOut size={15} /> Logoff
                </button>
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen((value) => !value)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-[#fff1d6]"
              >
                <CircleUserRound size={23} />
                <span className="truncate border-b border-[#d89a28]">usuário</span>
              </button>
            </div>
          </aside>

          <section className="min-w-0 flex-1 bg-[var(--color-organizer-bg)] lg:p-3">
            <div
              className={`organizer-container h-full bg-[var(--color-organizer-bg)] lg:rounded-2xl lg:border lg:border-stone-200/80 lg:shadow-[var(--shadow-float)] ${visitorPreview ? 'overflow-hidden' : 'overflow-y-auto'}`}
            >
              {visitorPreview ? (
                <VisitorPreview name={visitorPreview.name} route={visitorPreview.route} />
              ) : wizardDraft ? (
                <ItemWizard
                  step={wizardStep}
                  draft={wizardDraft}
                  onDraftChange={(changes) =>
                    setWizardDraft((current) => (current ? { ...current, ...changes } : current))
                  }
                  onStepChange={setWizardStep}
                  pages={wizardPages}
                  discountTags={wizardDiscountTags}
                  onCancel={closeItemWizard}
                  onFinish={finishItemWizard}
                />
              ) : settingsOpen ? (
                <SettingsPanel
                  store={store}
                  token={token}
                  onClose={() => setSettingsOpen(false)}
                  onCreateTag={() => setModalMode('tag')}
                  onOpenTag={openTagFromSettings}
                  onTrashTag={(id) => {
                    moveTagToTrash(id)
                    showNotice('Tag movida para a lixeira.')
                  }}
                />
              ) : (
                workspaceElement
              )}
            </div>
          </section>

          {rightDrawerVisible && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Redimensionar gaveta direita"
              onPointerDown={handleResizeStart}
              className="group relative z-20 hidden w-0 cursor-col-resize lg:block"
            >
              <span className="absolute inset-y-0 -left-3 w-6" />
              <span className="absolute left-[-3px] top-1/2 flex h-14 w-[7px] -translate-y-1/2 items-center justify-center rounded-full bg-[#d8c8b2] opacity-0 transition-opacity group-hover:opacity-100">
                <GripVertical size={10} />
              </span>
            </div>
          )}

          <aside
            aria-label="Gaveta de propriedades"
            style={{ width: rightDrawerVisible ? rightWidth : 0 }}
            className={`relative hidden shrink-0 overflow-hidden bg-[var(--color-organizer-bg)] lg:block ${rightResizing ? '' : 'transition-[width] duration-300'}`}
          >
            <div className="absolute inset-y-0 right-0 h-full py-3 pr-3" style={{ width: rightWidth }}>
              <div className="organizer-container h-full overflow-y-auto rounded-2xl border border-stone-200/80 bg-[var(--color-organizer-bg)] shadow-[var(--shadow-float)]">
                {visitorPreview ? (
                  workspaceElement
                ) : (
                  <Inspector
                    key={`${selection?.kind ?? 'none'}-${selection && 'id' in selection ? selection.id : ''}-${selectedNode?.updatedAt ?? selectedTag?.updatedAt ?? ''}`}
                    node={selectedNode}
                    tag={selectedTag}
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
                    liveSync={isItemPageFocused}
                  />
                )}
              </div>
            </div>
          </aside>

          <aside
            aria-label="Gaveta de propriedades"
            className={`absolute inset-y-0 right-0 z-30 flex flex-col overflow-hidden bg-[var(--color-organizer-bg)] shadow-2xl transition-[width,opacity] duration-300 lg:hidden ${rightDrawerVisible ? 'w-full opacity-100' : 'pointer-events-none w-0 opacity-0'}`}
          >
            <div className="min-h-0 w-full flex-1 overflow-y-auto">
              <div className="organizer-container h-full overflow-y-auto bg-[var(--color-organizer-bg)]">
                {visitorPreview ? (
                  workspaceElement
                ) : (
                  <Inspector
                    key={`mobile-${selection?.kind ?? 'none'}-${selection && 'id' in selection ? selection.id : ''}-${selectedNode?.updatedAt ?? selectedTag?.updatedAt ?? ''}`}
                    node={selectedNode}
                    tag={selectedTag}
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
                    liveSync={isItemPageFocused}
                  />
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {notice && (
        <div className="organizer-surface-trust fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full px-5 py-2.5 text-sm">
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
          onChooseModule={(type) =>
            type === 'item' ? openItemWizard(selectedContainerId) : setModalMode(type)
          }
        />
      )}
      {detailNode && (
        <OrganizerUsageModal node={detailNode} nodes={store.nodes} onClose={() => setDetailNodeId(null)} />
      )}
      {trashOpen && (
        <TrashModal
          trash={store.trash}
          onClose={() => setTrashOpen(false)}
          onRestore={restoreTrash}
          onDeletePermanently={deleteTrashPermanently}
        />
      )}
      {historyOpen && (
        <HistoryModal
          activities={store.activities}
          onClose={() => setHistoryOpen(false)}
          onClearActivities={() => {
            clearActivities()
            showNotice('Histórico de recentes limpo.')
          }}
          onOpenActivity={openActivityFromHistory}
        />
      )}
      {customersOpen && <CustomersModal token={token} onClose={() => setCustomersOpen(false)} />}
    </main>
  )
}

interface VisitorPreviewProps {
  name: string
  route: string
}

function VisitorPreview({ name, route }: VisitorPreviewProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex shrink-0 items-center bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)] px-3 py-3 text-white sm:px-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#e2b04f]">Modo visitante</p>
      </header>
      <iframe
        key={route}
        src={route}
        title={`Visualização de ${name}`}
        className="min-h-0 w-full flex-1 border-0 bg-white"
      />
    </div>
  )
}

function SettingsPanel({
  store,
  token,
  onClose,
  onCreateTag,
  onOpenTag,
  onTrashTag,
}: {
  store: ReturnType<typeof useOrganizerStore>['store']
  token: string | null
  onClose: () => void
  onCreateTag: () => void
  onOpenTag: (tagId: string) => void
  onTrashTag: (tagId: string) => void
}) {
  return (
    <div className="p-5">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-[#fff1d6] p-3 text-[#b77717]">
            <Settings size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Configurações</h1>
            <p className="text-xs text-[#6b665f]">Preferências do organizador.</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Fechar configurações"
          onClick={onClose}
          className="rounded-full p-2 hover:bg-[#fff1d6] hover:text-[#b77717]"
        >
          <X size={18} />
        </button>
      </div>
      <div className="space-y-6">
        <SettingsTopic title="Geral">
          <div className="organizer-surface p-4">
            <h3 className="text-sm font-semibold text-[#3a164f]">Salvamento automático</h3>
            <p className="mt-1 text-xs leading-5 text-[#6b665f]">
              Páginas, itens, tags, agendamentos e lixeira ficam salvos neste navegador.
            </p>
          </div>
        </SettingsTopic>

        <SettingsTopic title="Ferramentas">
          <div className="organizer-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#3a164f]">Tags · {store.tags.length}</h3>
              <button
                type="button"
                onClick={onCreateTag}
                className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#b77717] hover:underline"
              >
                <Plus size={12} /> Nova tag
              </button>
            </div>
            {store.tags.length === 0 ? (
              <p className="text-xs text-[#6b665f]">Não há tags. Crie uma para organizar itens.</p>
            ) : (
              <ul className="max-h-80 space-y-1 overflow-y-auto">
                {store.tags.map((tag) => (
                  <li key={tag.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenTag(tag.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs hover:bg-[#fff8ea]"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-[#3a164f]">{tag.name}</span>
                      {tag.discountPercent ? (
                        <span className="shrink-0 text-[10px] font-semibold text-[#b77717]">
                          -{tag.discountPercent}%
                        </span>
                      ) : null}
                      <span className="shrink-0 text-[10px] text-[#6b665f]">
                        {store.nodes.filter((node) => node.tagIds.includes(tag.id)).length} item(ns)
                      </span>
                    </button>
                    <button
                      type="button"
                      title="Mover tag para a lixeira"
                      aria-label={`Excluir tag ${tag.name}`}
                      onClick={() => onTrashTag(tag.id)}
                      className="shrink-0 rounded-full p-1.5 text-[#9b5a50] hover:bg-[#fff0ed] hover:text-[#a0382f]"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SettingsTopic>

        <SettingsTopic title="Contas">
          <AdminAssignment token={token} />
        </SettingsTopic>
      </div>
    </div>
  )
}

type AdminCandidate = {
  id: string
  name: string
  email: string
  phone: string
  cpf: string
  isAdmin: boolean
  isFixedAdmin: boolean
}

function AdminAssignment({ token }: { token: string | null }) {
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<AdminCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmTarget, setConfirmTarget] = useState<AdminCandidate | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''
      setLoading(true)
      api
        .get<AdminCandidate[]>(`/customers${query}`, token ?? undefined)
        .then(setCandidates)
        .catch(() => setCandidates([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [search, token])

  async function confirmToggle() {
    if (!confirmTarget) return
    setSaving(true)
    try {
      await api.put(
        `/customers/${confirmTarget.id}/admin`,
        { isAdmin: !confirmTarget.isAdmin },
        token ?? undefined,
      )
      setCandidates((current) =>
        current.map((candidate) =>
          candidate.id === confirmTarget.id ? { ...candidate, isAdmin: !candidate.isAdmin } : candidate,
        ),
      )
      setNotice(
        confirmTarget.isAdmin
          ? `${confirmTarget.name} nao e mais administrador.`
          : `${confirmTarget.name} agora e administrador.`,
      )
      setConfirmTarget(null)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Nao foi possivel concluir.')
    } finally {
      setSaving(false)
    }
  }

  // Sem busca, a lista mostra so quem ja e admin (o "quadro" atual de
  // acesso); buscar entra em qualquer cliente para conceder o cargo.
  const visibleCandidates = search.trim() ? candidates : candidates.filter((candidate) => candidate.isAdmin)

  return (
    <div className="organizer-surface p-4">
      <h3 className="text-sm font-semibold text-[#3a164f]">Acesso ao Admin</h3>
      <p className="mt-1 text-xs leading-5 text-[#6b665f]">
        Quem tiver o cargo de administrador consegue entrar aqui e editar o site inteiro. Busque um cliente ja
        cadastrado para conceder o acesso; a lista abaixo mostra quem ja e administrador.
      </p>

      <label className="mt-3 flex h-9 items-center rounded-xl border border-stone-200 bg-white px-3 text-[#2a0f3d] focus-within:border-[#d89a28] focus-within:ring-4 focus-within:ring-[#f7dfb1]">
        <span className="sr-only">Buscar cliente por nome, e-mail ou CPF</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome, e-mail ou CPF"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-stone-400"
        />
        <Search size={14} className="text-[#b77717]" />
      </label>

      {notice ? <p className="mt-2 text-xs font-medium text-[#0f8a5f]">{notice}</p> : null}

      <div className="mt-3 max-h-72 overflow-y-auto">
        {loading ? (
          <p className="px-2 py-3 text-center text-xs text-[#6b665f]">Carregando...</p>
        ) : visibleCandidates.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-[#6b665f]">
            {search.trim() ? 'Nenhum cliente encontrado.' : 'Nenhum administrador alem do fixo.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {visibleCandidates.map((candidate) => (
              <li
                key={candidate.id}
                className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-[#fff8ea]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[#2a0f3d]">{candidate.name}</p>
                  <p className="mt-0.5 truncate text-[10px] text-[#6b665f]">
                    {[candidate.email, candidate.phone, candidate.cpf].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {candidate.isFixedAdmin ? null : (
                  <button
                    type="button"
                    onClick={() => setConfirmTarget(candidate)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                      candidate.isAdmin
                        ? 'bg-[#fff0ed] text-[#a0382f] hover:bg-[#ffe3de]'
                        : 'bg-[#eadcf0] text-[#5b247f] hover:bg-[#ddc7ea]'
                    }`}
                  >
                    {candidate.isAdmin ? 'Remover acesso' : 'Tornar admin'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirmTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label="Cancelar"
            onClick={() => (!saving ? setConfirmTarget(null) : undefined)}
            className="absolute inset-0 bg-[#081b32]/45 backdrop-blur-[2px]"
          />
          <div className="relative z-10 w-full max-w-sm space-y-4 rounded-2xl border border-[#5b247f]/40 bg-white p-5 shadow-[var(--shadow-organizer)]">
            <div className="flex items-center gap-2 text-[#a0382f]">
              <ShieldAlert size={18} />
              <h3 className="text-sm font-semibold uppercase tracking-[0.1em]">Confirmar</h3>
            </div>
            <p className="text-sm leading-6 text-[#2a0f3d]">
              {confirmTarget.isAdmin ? (
                <>
                  Remover o acesso de administrador de <strong>{confirmTarget.name}</strong>? A conta deixa de
                  conseguir entrar no Admin.
                </>
              ) : (
                <>
                  Tornar <strong>{confirmTarget.name}</strong> administrador? A conta passa a poder entrar no
                  Admin e editar o site inteiro.
                </>
              )}
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => setConfirmTarget(null)}
              >
                Cancelar
              </Button>
              <Button type="button" disabled={saving} onClick={confirmToggle}>
                {saving ? 'Salvando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SettingsTopic({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="organizer-eyebrow mb-2 flex w-full items-center gap-1.5 text-left"
      >
        <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
        <span>{title}</span>
      </button>
      {open && <div className="space-y-3">{children}</div>}
    </section>
  )
}

function TrashModal({
  trash,
  onClose,
  onRestore,
  onDeletePermanently,
}: {
  trash: OrganizerTrashEntry[]
  onClose: () => void
  onRestore: (id: string) => void
  onDeletePermanently: (id: string) => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trash-modal-title"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Fechar lixeira"
        onClick={onClose}
        className="absolute inset-0 bg-[#081b32]/45 backdrop-blur-[2px]"
      />
      <section className="relative z-10 flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#5b247f]/40 bg-[var(--color-organizer-bg)] shadow-[var(--shadow-organizer)]">
        <header className="flex shrink-0 items-center justify-between gap-3 bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)] px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <Trash2 size={17} className="text-[#e2b04f]" />
            <h2 id="trash-modal-title" className="text-sm font-semibold uppercase tracking-[0.14em]">
              Lixeira
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1 hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {trash.length === 0 ? (
            <EmptyState icon={<Trash2 size={28} />} title="A lixeira está vazia" />
          ) : (
            <ul className="divide-y divide-stone-100">
              {trash.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-[#fff1d6] text-[#b77717]">
                    {entry.kind === 'node' && (entry.payload as OrganizerNode).imageUrl ? (
                      <img
                        src={(entry.payload as OrganizerNode).imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package size={16} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{entry.payload.name}</p>
                    <p className="mt-0.5 truncate text-[10px] text-[#6b665f]">
                      {entry.kind === 'node'
                        ? organizerTypeLabels[(entry.payload as OrganizerNode).type]
                        : 'Tag'}
                      {' · excluído em '}
                      {formatDate(entry.deletedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    title="Restaurar"
                    aria-label={`Restaurar ${entry.payload.name}`}
                    onClick={() => onRestore(entry.id)}
                    className="rounded-full p-1.5 text-[#3a164f] hover:bg-[#eadcf0]"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    type="button"
                    title="Excluir permanentemente"
                    aria-label={`Excluir ${entry.payload.name} permanentemente`}
                    onClick={() => onDeletePermanently(entry.id)}
                    className="rounded-full p-1.5 text-[#a0382f] hover:bg-[#fff0ed]"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

function HistoryModal({
  activities,
  onClose,
  onClearActivities,
  onOpenActivity,
}: {
  activities: OrganizerActivity[]
  onClose: () => void
  onClearActivities: () => void
  onOpenActivity: (targetId: string | null) => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Fechar histórico"
        onClick={onClose}
        className="absolute inset-0 bg-[#081b32]/45 backdrop-blur-[2px]"
      />
      <section className="relative z-10 flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#5b247f]/40 bg-[var(--color-organizer-bg)] shadow-[var(--shadow-organizer)]">
        <header className="flex shrink-0 items-center justify-between gap-3 bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)] px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <History size={17} className="text-[#e2b04f]" />
            <h2 id="history-modal-title" className="text-sm font-semibold uppercase tracking-[0.14em]">
              Histórico
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {activities.length > 0 && (
              <button
                type="button"
                onClick={onClearActivities}
                className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#e2b04f] hover:bg-white/10"
              >
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-full p-1 hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activities.length === 0 ? (
            <EmptyState icon={<History size={28} />} title="Não há nada de novo" />
          ) : (
            <ul className="divide-y divide-stone-100">
              {activities.map((activity) => (
                <li key={activity.id}>
                  <button
                    type="button"
                    disabled={!activity.targetId}
                    onClick={() => onOpenActivity(activity.targetId)}
                    className="block w-full px-4 py-3 text-left hover:bg-[#fff8ea] disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span className="block truncate text-xs font-semibold text-[#3a164f]">
                      {activity.label}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-[#6b665f]">
                      {activity.detail} · {formatDate(activity.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

type CustomerSummary = {
  id: string
  name: string
  email: string
  phone: string
  cpf: string
  isFixedAdmin: boolean
}

type CustomerDetail = {
  name: string
  email: string
  phone: string
  cpf: string
  addresses: Array<{
    street: string
    number: string
    city: string
    state: string
  }>
  orders: CustomerOrder[]
}

type OrderPublicDetail = {
  id: string
  total: number
  paymentStatus: string
  orderStatus: string
  origin: string
  createdAt: string
  shipping: number
  discount: number
  items: Array<{ name: string; price: number; quantity: number }>
}

function CustomersModal({ token, onClose }: { token: string | null; onClose: () => void }) {
  const format = useCurrency()
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [loadingList, setLoadingList] = useState(true)

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null)

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [orderDetail, setOrderDetail] = useState<OrderPublicDetail | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''
      setLoadingList(true)
      api
        .get<CustomerSummary[]>(`/customers${query}`, token ?? undefined)
        // A conta fixa de administrador nao e um cliente de verdade: so
        // aparece na gestao de Administradores, nunca aqui.
        .then((data) => setCustomers(data.filter((customer) => !customer.isFixedAdmin)))
        .catch(() => setCustomers([]))
        .finally(() => setLoadingList(false))
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [search, token])

  useEffect(() => {
    if (!selectedCustomerId) return
    let cancelled = false
    api
      .get<CustomerDetail>(`/customers/${selectedCustomerId}`, token ?? undefined)
      .then((data) => {
        if (!cancelled) setCustomerDetail(data)
      })
      .catch(() => {
        if (!cancelled) setCustomerDetail(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedCustomerId, token])

  useEffect(() => {
    if (!selectedOrderId) return
    let cancelled = false
    api
      .get<OrderPublicDetail>(`/order/${selectedOrderId}`)
      .then((data) => {
        if (!cancelled) setOrderDetail(data)
      })
      .catch(() => {
        if (!cancelled) setOrderDetail(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedOrderId])

  function openCustomer(id: string) {
    setCustomerDetail(null)
    setSelectedCustomerId(id)
  }

  function openOrder(id: string) {
    setOrderDetail(null)
    setSelectedOrderId(id)
  }

  const view = selectedOrderId ? 'order' : selectedCustomerId ? 'customer' : 'list'
  const title =
    view === 'order' ? 'Pedido' : view === 'customer' ? (customerDetail?.name ?? 'Cliente') : 'Clientes'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="customers-modal-title"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Fechar clientes"
        onClick={onClose}
        className="absolute inset-0 bg-[#081b32]/45 backdrop-blur-[2px]"
      />
      <section className="relative z-10 flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#5b247f]/40 bg-[var(--color-organizer-bg)] shadow-[var(--shadow-organizer)]">
        <header className="flex shrink-0 items-center justify-between gap-3 bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)] px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-2">
            {view !== 'list' ? (
              <button
                type="button"
                aria-label="Voltar"
                onClick={() => (view === 'order' ? setSelectedOrderId(null) : setSelectedCustomerId(null))}
                className="shrink-0 rounded-full p-1 hover:bg-white/10"
              >
                <ChevronLeft size={18} />
              </button>
            ) : (
              <Users size={17} className="shrink-0 text-[#e2b04f]" />
            )}
            <h2
              id="customers-modal-title"
              className="truncate text-sm font-semibold uppercase tracking-[0.14em]"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-full p-1 hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </header>

        {view === 'list' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 p-3">
              <label className="flex h-10 items-center rounded-xl border border-stone-200 bg-white px-3 text-[#2a0f3d] focus-within:border-[#d89a28] focus-within:ring-4 focus-within:ring-[#f7dfb1]">
                <span className="sr-only">Buscar cliente por nome, e-mail ou CPF</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome, e-mail ou CPF"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
                />
                <Search size={16} className="text-[#b77717]" />
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loadingList ? (
                <p className="px-4 py-6 text-center text-xs text-[#6b665f]">Carregando...</p>
              ) : customers.length === 0 ? (
                <EmptyState icon={<Users size={28} />} title="Nenhum cliente encontrado" />
              ) : (
                <ul className="divide-y divide-stone-100">
                  {customers.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        onClick={() => openCustomer(customer.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#fff8ea]"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-[#fff1d6] text-[#b77717]">
                          <CircleUserRound size={20} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-[#2a0f3d]">{customer.name}</p>
                          <p className="mt-0.5 truncate text-[10px] text-[#6b665f]">
                            {[customer.email, customer.phone, customer.cpf].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : view === 'customer' ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!customerDetail ? (
              <p className="px-4 py-6 text-center text-xs text-[#6b665f]">Carregando...</p>
            ) : (
              <>
                <div className="space-y-1 border-b border-stone-100 px-4 py-3">
                  <p className="text-[10px] text-[#6b665f]">{customerDetail.email}</p>
                  <p className="text-[10px] text-[#6b665f]">
                    {customerDetail.phone} · {customerDetail.cpf}
                  </p>
                  {customerDetail.addresses[0] ? (
                    <p className="text-[10px] text-[#6b665f]">
                      {customerDetail.addresses[0].street}
                      {customerDetail.addresses[0].number
                        ? `, ${customerDetail.addresses[0].number}`
                        : ''} - {customerDetail.addresses[0].city}/{customerDetail.addresses[0].state}
                    </p>
                  ) : null}
                </div>
                <p className="organizer-eyebrow px-4 pt-3">Pedidos</p>
                {customerDetail.orders.length === 0 ? (
                  <EmptyState icon={<Package size={28} />} title="Nenhum pedido ainda" />
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {customerDetail.orders.map((order) => {
                      const presentation = getOrderStatusPresentation(order)
                      return (
                        <li key={order.id}>
                          <button
                            type="button"
                            onClick={() => openOrder(order.id)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#fff8ea]"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-[#fff1d6] text-[#b77717]">
                              {order.previewImageUrl ? (
                                <img
                                  src={order.previewImageUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Package size={16} />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-[#2a0f3d]">
                                {format(order.total)}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-[#6b665f]">
                                {order.previewName}
                                {order.itemCount && order.itemCount > 1 ? ` +${order.itemCount - 1}` : ''}
                                {' · '}
                                {formatDate(order.createdAt)}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ring-1 ring-inset ${presentation.className}`}
                            >
                              {presentation.label}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!orderDetail ? (
              <p className="px-4 py-6 text-center text-xs text-[#6b665f]">Carregando...</p>
            ) : (
              <div className="space-y-4 p-4">
                <div>
                  <p className="organizer-eyebrow">Itens</p>
                  <ul className="mt-2 space-y-2">
                    {orderDetail.items.map((item, index) => (
                      <li key={index} className="flex items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate text-[#2a0f3d]">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="shrink-0 font-semibold text-[#2a0f3d]">
                          {format(item.price * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-1 border-t border-stone-100 pt-3 text-xs">
                  <div className="flex items-center justify-between text-[#6b665f]">
                    <span>Frete</span>
                    <span>{format(orderDetail.shipping)}</span>
                  </div>
                  {orderDetail.discount > 0 ? (
                    <div className="flex items-center justify-between text-[#6b665f]">
                      <span>Desconto</span>
                      <span>- {format(orderDetail.discount)}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between text-sm font-semibold text-[#2a0f3d]">
                    <span>Total</span>
                    <span>{format(orderDetail.total)}</span>
                  </div>
                </div>
                <p className="text-[10px] text-[#6b665f]">
                  {formatDate(orderDetail.createdAt)} ·{' '}
                  {orderDetail.origin === 'pdv' ? 'Venda no balcão' : 'Pedido online'}
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

interface WorkspaceProps {
  selectedNode: OrganizerNode | null
  selectedTag: OrganizerTag | null
  nodes: OrganizerNode[]
  focusedItemId: string | null
  onSelectNode: (id: string) => void
  onOpenModal: (mode: OrganizerModalMode) => void
  onNavigateBack: (parentId: string) => void
  onTrashNode: (id: string) => void
}

function Workspace({
  selectedNode,
  selectedTag,
  nodes,
  focusedItemId,
  onSelectNode,
  onOpenModal,
  onNavigateBack,
  onTrashNode,
}: WorkspaceProps) {
  if (selectedTag) {
    const taggedNodes = nodes.filter((node) => node.tagIds.includes(selectedTag.id))
    return (
      <div className="p-5">
        <div className="mb-6 flex items-center gap-3">
          <span
            className="h-8 w-8 rounded-full border-4 border-white shadow"
            style={{ backgroundColor: selectedTag.color }}
          />
          <div>
            <p className="organizer-eyebrow">Tag</p>
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

  if (selectedNode.type === 'item' && focusedItemId === selectedNode.id) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-white">
        <header className="flex shrink-0 items-center justify-between bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)] px-3 py-3 text-white sm:px-4">
          <button
            type="button"
            onClick={() => onNavigateBack(selectedNode.parentId ?? 'home')}
            className="flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
          >
            <ArrowLeft size={14} />
            Voltar um nível
          </button>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#e2b04f]">
            Página do item
          </p>
        </header>
        <iframe
          key={selectedNode.id}
          src={withOrganizerPreview(`/produto/${selectedNode.id}`, true)}
          title={`Página de ${selectedNode.name}`}
          className="min-h-0 w-full flex-1 border-0 bg-white"
        />
      </div>
    )
  }

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

  return (
    <div className="p-5">
      {workspaceNode.parentId && (
        <button
          type="button"
          onClick={() => onNavigateBack(workspaceNode.parentId as string)}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#3a164f] hover:border-[#d89a28] hover:bg-[#fff8ea]"
        >
          <ArrowLeft size={15} />
          Voltar um nível
        </button>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-1 rounded-full bg-[#fff1d6] p-3 text-[#b77717]">
            {nodeIcon(workspaceNode.type, 22)}
          </div>
          <div className="min-w-0">
            <p className="organizer-eyebrow">
              {organizerTypeLabels[workspaceNode.type]}
              {parent ? ` · ${parent.name}` : ''}
            </p>
            <h1 className="truncate text-2xl font-semibold sm:text-3xl">{workspaceNode.name}</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#6b665f]">
              {workspaceNode.description || 'Sem descrição. Edite as propriedades na gaveta direita.'}
            </p>
          </div>
        </div>
        {workspaceNode.type === 'folder' && (
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-stone-200 bg-[#fff8ea] px-3.5 py-2 text-xs text-[#8b5200]">
              Somente organização
            </span>
          </div>
        )}
      </div>

      {workspaceNode.scheduledAt && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border-l-4 border-[#d89a28] bg-[#fff8ea] px-4 py-3 text-xs">
          <CalendarClock size={16} className="text-[#b77717]" /> Publicação programada para{' '}
          {formatDate(workspaceNode.scheduledAt)}.
        </div>
      )}

      <section className="mt-8">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">
            {workspaceNode.type === 'folder' ? 'Adicionar à subpasta' : 'Adicionar à página'}
          </h2>
          <p className="text-[10px] text-[#6b665f]">Escolha o tipo de conteúdo que será exibido.</p>
        </div>
        <div className="organizer-grid-actions grid gap-3">
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
          <p className="text-[10px] text-[#6b665f]">{childNodes.length} bloco(s) organizado(s).</p>
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
    <div className="organizer-grid-content grid gap-3">
      {nodes.map((node) => (
        <article
          key={node.id}
          className="interactive-card group overflow-hidden rounded-2xl border border-stone-200/80 bg-[#eadcf0] shadow-[var(--shadow-float)] hover:border-[#d89a28]"
        >
          <button
            type="button"
            aria-label={`Abrir ${node.name}`}
            onClick={() => onSelectNode(node.id)}
            className="flex h-24 w-full items-center justify-center overflow-hidden bg-[#fff1d6] text-[#b77717]"
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
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#d89a28]" />
              </button>
              {!node.immutable && (
                <button
                  type="button"
                  aria-label={`Excluir ${node.name}`}
                  title="Mover para a lixeira"
                  onClick={() => onDeleteNode(node.id)}
                  className="shrink-0 rounded-full p-1 text-[#9b5a50] hover:bg-[#fff0ed] hover:text-[#a0382f]"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => onSelectNode(node.id)}
              className="mt-1 block w-full text-left text-[10px] text-[#6b665f]"
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
      <section className="relative z-10 flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#5b247f]/40 bg-[var(--color-organizer-bg)] shadow-[var(--shadow-organizer)]">
        <header className="flex shrink-0 items-start justify-between gap-4 bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)] px-5 py-4 text-white">
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
            className="rounded-full p-1.5 hover:bg-white/10"
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
            <div className="organizer-surface p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6b665f]">
                Descrição
              </p>
              <p className="mt-2 text-sm leading-6 text-[#2a0f3d]">{node.description}</p>
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

        <footer className="shrink-0 border-t border-stone-200/80 bg-[var(--color-organizer-bg)] p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-organizer)] hover:brightness-110"
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
    <div className="rounded-xl border border-stone-200/80 bg-[#fff8ea] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b665f]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#3a164f]">{value}</p>
    </div>
  )
}

function UsageDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-stone-200/80 pb-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#6b665f]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#2a0f3d]">{value}</p>
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
      <h3 className="text-sm font-semibold text-[#3a164f]">
        {title} · {items.length}
      </h3>
      {items.length > 0 ? (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex gap-3 rounded-xl border border-[#5b247f]/15 bg-[#eadcf0] p-2.5"
            >
              <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#fff1d6] text-[#b77717]">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package size={24} />
                )}
              </div>
              <div className="min-w-0 py-1">
                <p className="truncate text-sm font-semibold text-[#3a164f]">{item.name}</p>
                <p className="mt-1 text-xs text-[#6b665f]">
                  {item.price > 0
                    ? item.price.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })
                    : 'Preço não informado'}
                </p>
                <span className="mt-2 inline-flex rounded-full bg-[#fff1d6] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#b77717]">
                  Em uso
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-2 rounded-xl border border-dashed border-stone-200 bg-[#fff8ea] p-4 text-xs text-[#6b665f]">
          {empty}
        </p>
      )}
    </div>
  )
}

function UsageList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[#3a164f]">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200/80 bg-white">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex items-center gap-2 px-3 py-2.5 text-xs">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#d89a28]" />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 rounded-xl border border-dashed border-stone-200 bg-[#fff8ea] p-4 text-xs text-[#6b665f]">
          {empty}
        </p>
      )}
    </div>
  )
}

interface InspectorProps {
  node: OrganizerNode | null
  tag: OrganizerTag | null
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
  liveSync?: boolean
}

function Inspector({
  node,
  tag,
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
  liveSync = false,
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
          sku: node.sku ?? '',
        }
      : null,
  )
  const [tagDraft, setTagDraft] = useState(() => (tag ? { name: tag.name, color: tag.color } : null))

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
              className="h-10 w-12 rounded-xl border border-stone-200 bg-white p-1"
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
  const syncLive = (changes: Partial<OrganizerNode>) => {
    if (liveSync) onUpdateNode(node.id, changes)
  }
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
  const items = nodes.filter((candidate) => candidate.type === 'item' && findOrganizerPage(nodes, candidate))
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
      sku: nodeDraft.sku.trim(),
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
        syncLive({ imageUrl: reader.result })
      }
    })
    reader.readAsDataURL(file)
  }

  return (
    <form onSubmit={submitNode} className="p-4">
      <InspectorHeading icon={nodeIcon(node.type)} title="Propriedades" />
      <div className="mb-4 flex items-center justify-between gap-2 rounded-xl bg-[#fff1d6] px-3 py-2">
        <span className="text-[10px] uppercase tracking-wider text-[#8b5200]">
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
          onChange={(event) => {
            setNodeDraft({ ...nodeDraft, name: event.target.value })
            syncLive({ name: event.target.value })
          }}
          className="organizer-input disabled:bg-stone-100 disabled:text-[#6b665f]"
        />
      </Field>
      <Field label="Descrição">
        <textarea
          value={nodeDraft.description}
          onChange={(event) => {
            setNodeDraft({ ...nodeDraft, description: event.target.value })
            syncLive({ description: event.target.value })
          }}
          rows={4}
          className="organizer-input resize-y"
        />
      </Field>
      {node.type !== 'folder' && (
        <Field label="Status">
          <select
            value={nodeDraft.status}
            onChange={(event) => {
              const status = event.target.value as OrganizerNode['status']
              setNodeDraft({ ...nodeDraft, status })
              syncLive({ status })
            }}
            className="organizer-input"
          >
            <option value="draft">Rascunho</option>
            <option value="published">Publicado</option>
            {node.scheduledAt && <option value="scheduled">Agendado</option>}
            {node.type === 'item' &&
              organizerItemStatusOptions
                .filter((value) => value !== 'published')
                .map((value) => (
                  <option key={value} value={value}>
                    {organizerStatusLabels[value]}
                  </option>
                ))}
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
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b665f]">
            Imagem
          </span>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs hover:border-[#d89a28] hover:bg-[#fff8ea]">
            <ImageIcon size={15} /> Enviar arquivo
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => handleImageFile(event.target.files?.[0])}
            />
          </label>
          {nodeDraft.imageUrl && (
            <img src={nodeDraft.imageUrl} alt="Prévia" className="mt-2 h-24 w-full rounded-xl object-cover" />
          )}
        </div>
      )}
      {node.type === 'item' && (
        <Field label="Preço">
          <input
            value={nodeDraft.price}
            onChange={(event) => {
              setNodeDraft({ ...nodeDraft, price: event.target.value })
              syncLive({ price: Number(event.target.value) || 0 })
            }}
            placeholder="R$ 0,00"
            className="organizer-input"
          />
        </Field>
      )}
      {node.type === 'item' && (
        <Field label="Código">
          <input
            value={nodeDraft.sku}
            onChange={(event) => {
              setNodeDraft({ ...nodeDraft, sku: event.target.value })
              syncLive({ sku: event.target.value })
            }}
            placeholder="Código interno do item"
            className="organizer-input"
          />
          <p className="mt-1 text-[10px] text-[#6b665f]">
            Uso interno: nunca aparece na página pública do item.
          </p>
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
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs hover:border-[#d89a28] hover:bg-[#fff8ea]"
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
            className="flex items-center justify-center gap-1 rounded-xl border border-stone-200 px-2 py-2 text-[10px] hover:border-[#d89a28] hover:bg-[#fff8ea]"
          >
            <ArrowUp size={13} /> Mover acima
          </button>
          <button
            type="button"
            onClick={() => onMoveNode(node.id, 'down')}
            className="flex items-center justify-center gap-1 rounded-xl border border-stone-200 px-2 py-2 text-[10px] hover:border-[#d89a28] hover:bg-[#fff8ea]"
          >
            <ArrowDown size={13} /> Mover abaixo
          </button>
        </div>
      )}
      <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
        <button
          type="submit"
          className="flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)] px-3 py-2.5 text-xs font-medium text-white shadow-[var(--shadow-organizer)] hover:brightness-110"
        >
          <Save size={15} /> Salvar alterações
        </button>
        {!node.immutable && !protectedPage && (
          <button
            type="button"
            title="Duplicar"
            aria-label="Duplicar conteúdo"
            onClick={() => onDuplicate(node.id)}
            className="rounded-full border border-stone-200 p-2.5 hover:border-[#5b247f]/40 hover:bg-[#eadcf0]"
          >
            <Copy size={16} />
          </button>
        )}
      </div>
      {!node.immutable && !protectedPage && (
        <button
          type="button"
          onClick={() => onTrashNode(node.id)}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs text-[#a0382f] hover:bg-[#fff0ed]"
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
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b665f]">
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
      <legend className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b665f]">
        {label}
      </legend>
      <div className="max-h-32 overflow-y-auto rounded-xl border border-stone-200 bg-white p-2">
        {options.length === 0 ? (
          <p className="text-[10px] text-[#6b665f]">{empty}</p>
        ) : (
          options.map((option) => (
            <label key={option.id} className="flex items-center gap-2 py-1 text-xs">
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={() => onToggle(option.id)}
                className="accent-[#d89a28]"
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
      <legend className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b665f]">
        {label} · {selected.length} selecionado(s)
      </legend>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-[#fff8ea] p-3 text-[10px] text-[#6b665f]">
          {empty}
        </p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {items.map((item) => {
            const checked = selected.includes(item.id)
            return (
              <label
                key={item.id}
                className={`flex cursor-pointer gap-3 rounded-xl border p-2 transition ${
                  checked
                    ? 'border-[#d89a28] bg-[#fff8ea] shadow-sm'
                    : 'border-stone-200 bg-white hover:border-[#d89a28]'
                }`}
              >
                <span className="flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#fff1d6] text-[#b77717]">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package size={22} />
                  )}
                </span>
                <span className="min-w-0 flex-1 py-0.5">
                  <span className="block truncate text-xs font-semibold text-[#3a164f]">{item.name}</span>
                  <span className="mt-1 block text-[10px] text-[#6b665f]">
                    {item.price > 0
                      ? item.price.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })
                      : 'Preço não informado'}
                  </span>
                  <span className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-[#b77717]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(item.id)}
                      className="accent-[#d89a28]"
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
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)] px-3 py-2.5 text-xs text-white shadow-[var(--shadow-organizer)] hover:brightness-110"
      >
        <Save size={15} /> {onSaveLabel}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs text-[#a0382f] hover:bg-[#fff0ed]"
      >
        <Trash2 size={15} /> Mover para a lixeira
      </button>
    </div>
  )
}

function InspectorHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-2 border-b border-stone-200/80 pb-3">
      <span className="text-[#b77717]">{icon}</span>
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
  )
}

function InspectorEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center p-6 text-center">
      <Settings size={28} className="mb-3 text-[#6b665f]" />
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-[10px] leading-relaxed text-[#6b665f]">{detail}</p>
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
      className="interactive-card group rounded-2xl border border-stone-200/80 bg-[#eadcf0] p-4 text-left shadow-[var(--shadow-float)] hover:border-[#d89a28]"
    >
      <span className="mb-3 inline-flex rounded-full bg-[#fff1d6] p-2.5 text-[#b77717] group-hover:bg-[#ffe2a8]">
        {icon}
      </span>
      <span className="block text-sm font-semibold">{title}</span>
      <span className="mt-1 block text-[10px] leading-relaxed text-[#6b665f]">{detail}</span>
    </button>
  )
}

function EmptyState({ icon, title, detail }: { icon: React.ReactNode; title: string; detail?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-[#fff8ea] p-6 text-center text-[#6b665f]">
      {icon}
      <p className="mt-3 text-sm font-medium text-[#3a164f]">{title}</p>
      {detail && <p className="mt-1 text-[10px]">{detail}</p>}
    </div>
  )
}

function StatusPill({ status, compact = false }: { status: OrganizerNode['status']; compact?: boolean }) {
  const colors: Record<OrganizerNode['status'], string> = {
    draft: 'bg-stone-100 text-[#6b665f]',
    scheduled: 'bg-[#fff1d6] text-[#8b5700]',
    published: 'bg-[#e5f0e8] text-[#27633a]',
    'coming-soon': 'bg-[#eadcf0] text-[#5b247f]',
    'out-of-stock': 'bg-[#fde3e0] text-[#a0382f]',
    'low-stock': 'bg-[#fff1d6] text-[#8b5700]',
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
      className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e0a83f] bg-[#fff8ea] text-[#3a164f] shadow-sm transition hover:bg-[#fff1d6] focus:outline-none focus:ring-2 focus:ring-[#e0a83f]"
    >
      {isLeft ? <PanelLeft size={18} /> : <PanelRight size={18} />}
    </button>
  )
}

export default OrganizerPage
