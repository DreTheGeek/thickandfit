// Reusable JSON-LD builders for the marketing surface. Pure functions (no server deps) so any page
// can compose the exact schema its visible content supports.
//
// Why this exists: SEO is only one layer. AEO (be the direct answer), GEO (get cited by ChatGPT /
// Perplexity / Gemini) and AIO all lean on structured data to verify claims, resolve entities, and
// decide whether to cite a source. Before this, the only schema was an inline Organization+WebSite
// graph in layout.tsx, so no page could declare an FAQ, a how-to, the app itself, or Stephanie as an
// entity.
//
// HARD RULE: schema must describe what is actually visible on the page. Never emit an FAQ node for
// questions the page does not show, or offers a page does not state. Injecting hidden schema is a
// spam violation and gets the whole domain distrusted.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.teamthickandfit.com').replace(/\/+$/, '');

export const ORG_ID = `${SITE_URL}/#organization`;
export const PERSON_ID = `${SITE_URL}/#stephanie`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const APP_ID = `${SITE_URL}/#app`;

export type JsonLdNode = Record<string, unknown>;

/** Wrap nodes into a single @graph document (one script tag per page). */
export function graph(nodes: JsonLdNode[]): JsonLdNode {
  return { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) };
}

export function organizationNode(): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'Thick & Fit',
    url: SITE_URL,
    logo: `${SITE_URL}/brand/logo-black.svg`,
    description:
      'Creator-led, bilingual (English/Spanish) fitness coaching for women: structured workouts with filmed demos, low-friction nutrition tracking, community, and coaching in Stephanie\'s method.',
    founder: { '@id': PERSON_ID },
    knowsLanguage: ['en', 'es'],
  };
}

/** Stephanie as a first-class entity. This is the GEO/AIO play: answer engines resolve and cite
 *  people, so naming her explicitly (and consistently) builds the entity models remember. */
export function personNode(): JsonLdNode {
  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: 'Stephanie Pantoja',
    jobTitle: 'Fitness Coach',
    description:
      'Bilingual fitness coach for women across the US and Latin America, founder of Thick & Fit.',
    knowsLanguage: ['en', 'es'],
    worksFor: { '@id': ORG_ID },
    // sameAs is how an answer engine resolves "Stephanie Pantoja" to one real person instead of
    // guessing. Only verified URLs go in here: an invented profile link would attach her entity to
    // an account she does not own. Add her Instagram/TikTok/YouTube here once the handles are
    // confirmed, and mirror them as visible footer links (sameAs alone is not a citation signal).
    sameAs: ['https://www.solin.stream/stephsblessedd'],
  };
}

export function websiteNode(opts: { published?: string; modified?: string } = {}): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_URL,
    name: 'Thick & Fit',
    publisher: { '@id': ORG_ID },
    inLanguage: ['en', 'es'],
    // No potentialAction/SearchAction here on purpose. An audit will score its absence as a missing
    // completeness property, but this site has no PUBLIC search endpoint: /exercises 307s to
    // /auth/sign-in, so a declared SearchAction would point answer engines at a login wall and
    // claim a capability visitors do not have. Add it if a public search page ever ships.
    ...(opts.published ? { datePublished: opts.published } : {}),
    ...(opts.modified ? { dateModified: opts.modified } : {}),
  };
}

/** The app itself. Use ONLY on a page that visibly states these features/price (e.g. /pricing). */
export function softwareApplicationNode(opts: {
  priceUSD?: string;
  features?: string[];
} = {}): JsonLdNode {
  return {
    '@type': 'SoftwareApplication',
    '@id': APP_ID,
    name: 'Thick & Fit',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'iOS, Android, Web',
    inLanguage: ['en', 'es'],
    publisher: { '@id': ORG_ID },
    ...(opts.features?.length ? { featureList: opts.features } : {}),
    ...(opts.priceUSD
      ? {
          offers: {
            '@type': 'Offer',
            price: opts.priceUSD,
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
          },
        }
      : {}),
  };
}

export type FaqItem = { question: string; answer: string };

/** AEO's highest-leverage node: lets an answer engine lift a question and its answer verbatim.
 *  Every item MUST be visibly rendered on the page. */
export function faqPageNode(items: FaqItem[]): JsonLdNode | null {
  const clean = items.filter((i) => i.question.trim() && i.answer.trim());
  if (!clean.length) return null;
  return {
    '@type': 'FAQPage',
    mainEntity: clean.map((i) => ({
      '@type': 'Question',
      name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
  };
}

/** For step-based explainers (how photo-to-macro works, how to start). */
export function howToNode(opts: { name: string; description?: string; steps: string[] }): JsonLdNode | null {
  const steps = opts.steps.filter((s) => s.trim());
  if (!steps.length) return null;
  return {
    '@type': 'HowTo',
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })),
  };
}

export function breadcrumbNode(items: { name: string; path: string }[]): JsonLdNode | null {
  if (!items.length) return null;
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path.startsWith('/') ? it.path : `/${it.path}`}`,
    })),
  };
}

/** A content page (article/guide) in the content hub. Dated + authored, which answer engines weight. */
export function articleNode(opts: {
  headline: string;
  description?: string;
  path: string;
  published: string;
  modified?: string;
  locale?: 'en' | 'es';
}): JsonLdNode {
  return {
    '@type': 'Article',
    headline: opts.headline,
    ...(opts.description ? { description: opts.description } : {}),
    mainEntityOfPage: `${SITE_URL}${opts.path}`,
    author: { '@id': PERSON_ID },
    publisher: { '@id': ORG_ID },
    datePublished: opts.published,
    dateModified: opts.modified ?? opts.published,
    inLanguage: opts.locale ?? 'en',
  };
}
