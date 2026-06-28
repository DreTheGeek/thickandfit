// Internal API + MCP docs (Build Profile D: internal use only). This page describes the internal
// REST/MCP surface and its auth scheme, so it is gated to coach/operator: noindex alone stops
// crawlers, not humans, and an unauthenticated visitor should not see the internal architecture.
import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { requireCoach } from '@/lib/auth/guards';

export const metadata: Metadata = {
  title: 'Internal API & MCP, Thick & Fit',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ApiDocsPage(): Promise<ReactElement> {
  await requireCoach();
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-black">
      <h1 className="text-3xl font-bold uppercase tracking-tight">Internal API and MCP</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Internal surface for Stephanie&apos;s automation and integrations. No end-user API keys
        (Build Profile D). Authenticate with a SHA-256 API key as a Bearer token.
      </p>

      <h2 className="mt-8 text-xl font-semibold">REST</h2>
      <ul className="mt-2 space-y-1 text-sm">
        <li>
          <code>GET /api/v1/ping</code>: health check, no auth. Returns{' '}
          <code>{'{ ok, data }'}</code>.
        </li>
        <li>
          <code>GET /api/v1/me</code>: Bearer API key. Returns the key&apos;s company scope. 401 on
          missing/invalid key.
        </li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">MCP</h2>
      <p className="mt-2 text-sm text-neutral-600">
        JSON-RPC 2.0 at <code>POST /api/mcp</code>. <code>initialize</code>, <code>tools/list</code>,
        and <code>tools/call</code>. Every <code>tools/call</code> requires a Bearer API key; reads
        are scoped to that key&apos;s company (no cross-tenant access).
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        <li>
          <code>get_company</code>: the authenticated key&apos;s company.
        </li>
        <li>
          <code>list_recent_api_usage</code>: recent API usage for the company.
        </li>
      </ul>
    </main>
  );
}
