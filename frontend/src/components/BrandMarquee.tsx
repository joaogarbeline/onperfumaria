export function BrandMarquee({ brands }: { brands: string[] }) {
  const loop = [...brands, ...brands]

  return (
    <section
      className="surface-soft relative overflow-hidden px-5 py-5"
      style={{ maskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)' }}
    >
      <div className="marquee-track flex items-center gap-4">
        {loop.map((brand, index) => (
          <div
            key={`${brand}-${index}`}
            className="rounded-full border border-stone-200 bg-white/90 px-5 py-3 text-sm font-semibold uppercase tracking-[0.24em] text-[#6b665f] transition duration-300 hover:-translate-y-0.5 hover:border-[#d89a28] hover:text-[#171412] hover:shadow-[0_16px_30px_-20px_rgba(216,154,40,0.5)]"
          >
            {brand}
          </div>
        ))}
      </div>
    </section>
  )
}
