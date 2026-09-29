import { Star } from 'lucide-react'
import { useState } from 'react'

export function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={size}
          className={index < Math.round(rating) ? 'fill-[#d89a28] text-[#d89a28]' : 'text-stone-300'}
        />
      ))}
    </div>
  )
}

export function StarPicker({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  const [hover, setHover] = useState(0)

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const starValue = index + 1
        const filled = (hover || value) >= starValue

        return (
          <button
            key={starValue}
            type="button"
            onMouseEnter={() => setHover(starValue)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(starValue)}
            aria-label={`${starValue} estrelas`}
            className="p-0.5"
          >
            <Star size={22} className={filled ? 'fill-[#d89a28] text-[#d89a28]' : 'text-stone-300'} />
          </button>
        )
      })}
    </div>
  )
}
