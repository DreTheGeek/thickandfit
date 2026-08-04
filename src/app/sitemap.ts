import type { MetadataRoute } from 'next';
import { esPathFor } from '@/lib/seo/locale-alternates';

// Public, indexable routes only. Base URL matches metadataBase in layout.tsx.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.teamthickandfit.com';

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
  // About is the entity/authority surface: it is what an engine reads to decide who Stephanie is.
  { path: '/about', changeFrequency: 'monthly', priority: 0.6, bilingual: true },
  // Both legal pages DO have real /es twins (src/app/es/terms, src/app/es/privacy) and are in
  // BILINGUAL_PATHS. Flagged false, the Spanish legal URLs were never advertised and never carried
  // an alternates map, which matters beyond SEO: App Store Connect takes one privacy-policy URL and
  // a Spanish reviewer needs the Spanish page to be a discoverable URL, not a cookie state.
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3, bilingual: true },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3, bilingual: true },
  // The /vs comparison pages exist to win searches for a competitor's name, which is the highest
  // intent traffic on the site: someone typing "MyFitnessPal alternative" is already shopping. They
  // were absent here AND unlinked from the nav and footer, so nothing on the internet pointed at
  // them and no crawler had a route in. The sitemap is that route, and each page links to its two
  // siblings and its Spanish twin, so discovering one discovers all six.
  { path: '/vs/myfitnesspal', changeFrequency: 'monthly', priority: 0.7, bilingual: true },
  { path: '/vs/cal-ai', changeFrequency: 'monthly', priority: 0.7, bilingual: true },
  { path: '/vs/fitia', changeFrequency: 'monthly', priority: 0.7, bilingual: true },
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
