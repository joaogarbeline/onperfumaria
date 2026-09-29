import { FileText } from 'lucide-react'
import { useState } from 'react'
import { useOrganizerStore } from '../../hooks/useOrganizerStore'
import {
  getOrganizerPageModules,
  isOrganizerNodeVisible,
  normalizeOrganizerSearch,
} from '../../types/organizer'
import { SiteModuleRenderer } from '../site/SiteModuleRenderer'
import { CategoryFilterDrawer } from './CategoryFilterDrawer'

const pageIds: Record<string, string> = {
  comercial: 'comercial',
  arabes: 'arabes',
  feminino: 'feminino',
  masculino: 'masculino',
  importados: 'importados',
  unisex: 'unisex',
}

export function CategoryWindow({ title }: { title: string }) {
  const [filterOpen, setFilterOpen] = useState(false)
  const { store } = useOrganizerStore()
  const pageId = pageIds[normalizeOrganizerSearch(title)] ?? normalizeOrganizerSearch(title)
  const page = store.nodes.find((node) => node.id === pageId && node.type === 'page')
  const modules = getOrganizerPageModules(store.nodes, pageId).filter((node) => isOrganizerNodeVisible(node))

  if (!page || !isOrganizerNodeVisible(page)) {
    return (
      <section className="surface-panel mx-auto max-w-2xl p-8 text-center">
        <FileText size={34} className="mx-auto text-[#d89a28]" />
        <h1 className="mt-4 font-serif text-3xl font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-[#6b665f]">
          Esta página foi removida ou ainda não está publicada no organizador.
        </p>
      </section>
    )
  }

  return (
    <div className="space-y-8 lg:space-y-12">
      {modules.map((module) => (
        <SiteModuleRenderer
          key={module.id}
          module={module}
          nodes={store.nodes}
          tags={store.tags}
          onOpenFilters={module.variant === 'product-grid' ? () => setFilterOpen(true) : undefined}
        />
      ))}

      <CategoryFilterDrawer open={filterOpen} onClose={() => setFilterOpen(false)} />
    </div>
  )
}
