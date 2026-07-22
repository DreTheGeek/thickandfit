import type { MetadataRoute } from 'next';

// Public, indexable routes only. /about is intentionally omitted (it carries robots noindex as an
// unlinked pre-launch page). Base URL matches metadataBase in layout.tsx.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://thicknfit.kaldrtech.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/join`, changeFrequency: 'weekly', priority: 0.8 },
    // High priority: the FAQ is the answer-engine surface (AEO/GEO), the page most likely to be
    // lifted verbatim into an AI answer about pricing, Spanish support, or how the photo scan works.
    { url: `${SITE_URL}/faq`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
