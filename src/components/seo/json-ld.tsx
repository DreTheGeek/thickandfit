// Renders a JSON-LD graph with the per-request CSP nonce, the same way layout.tsx stamps its
// Organization+WebSite schema. Server component: reading headers() is what lets the nonce be applied
// at SSR time. Compose the `data` with the builders in @/lib/seo/schema.
import type { ReactElement } from 'react';
import { headers } from 'next/headers';

export async function JsonLd({ data }: { data: Record<string, unknown> }): Promise<ReactElement> {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
