import type { MetadataRoute } from 'next';

// Allow crawlers on the public marketing surface; keep the authed app, auth flow, API and internal
// docs out of the index. Base URL matches metadataBase in layout.tsx.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://thicknfit.kaldrtech.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
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
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
