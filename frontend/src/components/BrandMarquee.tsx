export function BrandMarquee({ brands }: { brands: string[] }) {
  const loop = [...brands, ...brands]

  return (
    <section className="surface-soft overflow-hidden px-5 py-5">
      <div className="marquee-track flex items-center gap-4">
        {loop.map((brand, index) => (
          <div
            key={`${brand}-${index}`}
            className="rounded-full border border-stone-200 bg-white/90 px-5 py-3 text-sm font-semibold uppercase tracking-[0.24em] text-[#6b665f]"
          >
            {brand}
          </div>
        ))}
      </div>
    </section>
  )
}
