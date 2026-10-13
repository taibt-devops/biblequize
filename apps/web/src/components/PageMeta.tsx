import { Helmet } from 'react-helmet-async'

interface PageMetaProps {
  title: string
  description?: string
  ogImage?: string
  canonicalPath?: string
  /** Emit <meta robots="noindex, follow"> — for error/utility pages (e.g. 404). */
  noindex?: boolean
}

const BASE_URL = 'https://quiz.forbible.org'
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`

export default function PageMeta({ title, description, ogImage, canonicalPath, noindex }: PageMetaProps) {
  const fullTitle = `${title} — BibleQuiz`
  const image = ogImage ?? DEFAULT_OG_IMAGE
  const url = canonicalPath ? `${BASE_URL}${canonicalPath}` : undefined

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {noindex && <meta name="robots" content="noindex, follow" />}
      {description && <meta name="description" content={description} />}

      {/* Open Graph — overrides the site-wide defaults in index.html per page */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:image" content={image} />
      {url && <meta property="og:url" content={url} />}

      {/* Twitter card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={image} />

      {canonicalPath && <link rel="canonical" href={url} />}
    </Helmet>
  )
}
