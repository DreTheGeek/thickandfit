// The one door out of the Lenus tab.
//
// Their CSP restricts connect-src to their own origin, so the extractor running in their tab cannot
// POST anywhere, not even to a CORS-enabled endpoint (tested: api.github.com/zen is blocked too).
// postMessage is not governed by connect-src, so the extractor opens THIS page and posts each
// client's payload to it. This page is same-origin with us, so it can do the ordinary thing and
// POST to our API, carrying the coach's own session cookie.
//
// Deliberately outside the (app) group: no shell, no nav, no translations. It is a pipe, and it is
// open in a background window for an hour while 265 clients come through.
import type { ReactElement } from 'react';
import { LenusBridge } from '@/components/dev/lenus-bridge';

export const dynamic = 'force-dynamic';

export default function LenusBridgePage(): ReactElement {
  return <LenusBridge />;
}
