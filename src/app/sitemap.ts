import type { MetadataRoute } from 'next';

// Public, indexable routes only. /about is intentionally omitted (it carries robots noindex as an
// unlinked pre-launch page). Base URL matches metadataBase in layout.tsx.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://thickandfitcoaching.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/join`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
