import { Link } from 'react-router-dom'

const categoryIcons: Record<string, string> = {
  arabes: 'Oud',
  importados: 'Global',
  femininos: 'Feminino',
  masculinos: 'Masculino',
}

export function CategoryCard({
  name,
  total,
}: {
  name: string
  total: number
}) {
  const slug = name.toLowerCase()

  return (
    <Link
      to={`/catalogo?categoria=${encodeURIComponent(name)}`}
      className="surface-soft interactive-card flex min-h-[220px] flex-col justify-between px-6 py-6"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#fff1d6] text-sm font-bold uppercase tracking-[0.18em] text-[#9b6110]">
        {categoryIcons[slug] || name.slice(0, 3)}
      </div>
      <div className="space-y-2">
        <p className="eyebrow">Categoria</p>
        <h3 className="text-3xl text-[#171412]">{name}</h3>
        <p className="text-sm leading-6 text-[#6b665f]">
          {total} fragrancias ativas com estoque e condicoes atualizadas em tempo real.
        </p>
      </div>
    </Link>
  )
}
