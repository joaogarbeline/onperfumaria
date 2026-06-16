import { useEffect } from 'react'

export function SEO({
  title,
  description,
  image,
}: {
  title: string
  description?: string
  image?: string
}) {
  useEffect(() => {
    document.title = `${title} | On Perfumaria`
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription && description) metaDescription.setAttribute('content', description)
    if (image) {
      let ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null
      if (!ogImage) {
        ogImage = document.createElement('meta')
        ogImage.setAttribute('property', 'og:image')
        document.head.appendChild(ogImage)
      }
      ogImage.setAttribute('content', image)
    }
  }, [title, description, image])

  return null
}
