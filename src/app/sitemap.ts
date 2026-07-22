import type { MetadataRoute } from 'next';
import { esPathFor } from '@/lib/seo/locale-alternates';

// Public, indexable routes only. Base URL matches metadataBase in layout.tsx.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://thicknfit.kaldrtech.com';

type Entry = {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
  /** Whether the route has a Spanish twin at /es<path>. */
  bilingual: boolean;
};

const ROUTES: Entry[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1, bilingual: true },
  { path: '/join', changeFrequency: 'weekly', priority: 0.8, bilingual: false },
  // High priority: the FAQ is the answer-engine surface (AEO/GEO), the page most likely to be
  // lifted verbatim into an AI answer about pricing, Spanish support, or how the photo scan works.
  { path: '/faq', changeFrequency: 'monthly', priority: 0.8, bilingual: true },
  // Pricing carries the SoftwareApplication + Offer schema, so it is what answer engines resolve
  // for cost questions.
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.9, bilingual: true },
  // /about is deliberately absent until its noindex comes off in the rebuild. Listing a noindexed
  // URL in the sitemap is a contradictory signal, so the two land in the same change or not at all.
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3, bilingual: false },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3, bilingual: false },
];

/**
 * Both language versions are listed as their own entries, each carrying the SAME alternates map.
 * That reciprocity is the part Google actually requires: annotations that only point one way are
 * discarded, so a Spanish page listed without the English twin pointing back buys nothing.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const out: MetadataRoute.Sitemap = [];
  for (const r of ROUTES) {
    const languages = r.bilingual
      ? { en: `${SITE_URL}${r.path}`, es: `${SITE_URL}${esPathFor(r.path)}` }
      : undefined;

    out.push({
      url: `${SITE_URL}${r.path}`,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
      ...(languages ? { alternates: { languages } } : {}),
    });

    if (r.bilingual) {
      out.push({
        url: `${SITE_URL}${esPathFor(r.path)}`,
        changeFrequency: r.changeFrequency,
        priority: r.priority,
        alternates: { languages },
      });
    }
  }
  return out;
}
