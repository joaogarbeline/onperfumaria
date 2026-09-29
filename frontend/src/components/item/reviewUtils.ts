export type DemoReview = {
  id: string
  author: string
  rating: number
  daysAgo: number
  hasPhoto: boolean
  photos: string[]
  text: string
}

export type ReviewPhoto = {
  id: string
  previewUrl: string
}

export type SortMode = 'recent' | 'photo' | 'rated' | 'oldest'

export const SORT_LABELS: Record<SortMode, string> = {
  recent: 'Mais recente',
  photo: 'Com foto',
  rated: 'Mais avaliado',
  oldest: 'Mais antiga',
}

export function sortReviews(reviews: DemoReview[], mode: SortMode) {
  const sortedReviews = [...reviews]

  switch (mode) {
    case 'oldest':
      return sortedReviews.sort((a, b) => b.daysAgo - a.daysAgo)
    case 'photo':
      return sortedReviews.sort((a, b) => Number(b.hasPhoto) - Number(a.hasPhoto) || a.daysAgo - b.daysAgo)
    case 'rated':
      return sortedReviews.sort((a, b) => b.rating - a.rating || a.daysAgo - b.daysAgo)
    default:
      return sortedReviews.sort((a, b) => a.daysAgo - b.daysAgo)
  }
}

export function formatDaysAgo(daysAgo: number) {
  if (daysAgo <= 0) return 'Hoje'
  if (daysAgo < 30) return `Ha ${daysAgo} dias`

  const months = Math.round(daysAgo / 30)
  return months <= 1 ? 'Ha 1 mes' : `Ha ${months} meses`
}
