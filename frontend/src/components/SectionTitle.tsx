export function SectionTitle({
  eyebrow,
  title,
  description,
  align = 'left',
}: {
  eyebrow: string
  title: string
  description: string
  align?: 'left' | 'center'
}) {
  return (
    <div className={['space-y-3', align === 'center' ? 'mx-auto text-center' : ''].filter(Boolean).join(' ')}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="text-4xl leading-none text-[#171412] md:text-5xl">{title}</h2>
      <p className={['text-sm leading-7 text-[#6b665f]', align === 'center' ? 'mx-auto max-w-3xl' : 'max-w-2xl'].join(' ')}>
        {description}
      </p>
    </div>
  )
}
