import type { MetadataRoute } from 'next';

// Allow crawlers on the public marketing surface; keep the authed app, auth flow, API and internal
// docs out of the index. Base URL matches metadataBase in layout.tsx.
//
// AI crawlers are named EXPLICITLY and allowed. SEO is only one layer: GEO (getting cited by
// ChatGPT, Perplexity, Gemini, Claude) and AIO (being present in what the models know) require those
// agents to actually read the marketing pages. A bare `*` allow technically permits them, but naming
// them is unambiguous, survives future default-deny changes, and is the standard signal that this
// brand WANTS to be cited. The authed app stays disallowed for every agent.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.teamthickandfit.com';

const DISALLOW = [
  '/auth/',
  '/api/',
  '/api-docs',
  '/coach/',
  '/dashboard',
  '/onboarding',
  '/nutrition',
  '/workout',
  '/workouts',
  '/exercises',
  '/history',
  '/progress',
  '/you',
  '/account',
  '/messages',
  '/checkin',
  '/checkout',
  '/forms/',
];

// Answer/generative engines plus their training and retrieval agents.
const AI_AGENTS = [
  'GPTBot', // OpenAI training
  'OAI-SearchBot', // ChatGPT search
  'ChatGPT-User', // ChatGPT browsing for a user
  'ClaudeBot', // Anthropic
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot', // Perplexity
  'Perplexity-User',
  'Google-Extended', // Gemini / Vertex grounding
  'Applebot-Extended', // Apple Intelligence
  'CCBot', // Common Crawl (feeds many models)
  'cohere-ai',
  'meta-externalagent',
  'Bytespider', // ByteDance / Doubao. Big in LATAM reach, and half her audience is there.
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      ...AI_AGENTS.map((userAgent) => ({ userAgent, allow: '/', disallow: DISALLOW })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
