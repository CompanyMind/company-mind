import type { MetadataRoute } from 'next'
import { brand } from '@/content/brand'

/**
 * robots.txt — Next.js serves the default export at `/robots.txt`.
 *
 * The site is pre-launch marketing with nothing to hide: every route is meant
 * to be found, so every crawler is allowed everywhere. The only job left is
 * pointing them at the sitemap so they do not have to guess the eight routes.
 *
 * `host` emits a `Host:` line. Note what this does NOT do: it is a non-standard
 * extension that only Yandex ever honored, and it does no canonicalization for
 * Google or Bing. Real canonicalization comes from the per-page `alternates.canonical`
 * metadata and from redirecting www -> apex at the host. It is kept only because
 * it is harmless and correct for the crawlers that read it — do not rely on it.
 */

const BASE_URL = `https://${brand.domain}`

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
