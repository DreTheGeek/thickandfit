// Inbound email -> support ticket. Point help@teamthickandfit.com at this URL in Resend.
//
// THE SIGNATURE CHECK IS THE ENTIRE SECURITY BOUNDARY. This is a public URL that inserts rows into
// the one board the team is supposed to trust during launch week. Unsigned, it is a spam funnel that
// also burns a model call per message. So it FAILS CLOSED: no secret configured means every request
// is rejected, because a webhook that silently accepts anything is worse than one that is switched
// off, and "we will add the secret later" is how it stays open forever.
//
// Resend signs with Svix headers (svix-id, svix-timestamp, svix-signature) over
// `${id}.${timestamp}.${rawBody}` using an hmac-sha256 whose key is the base64 part after `whsec_`.
// Verified by hand here rather than adding the svix dependency for one route.
import { createHmac, timingSafeEqual } from 'crypto';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { withApiLog } from '@/lib/telemetry/request-log';
import { createSupportTicket } from '@/lib/support/intake';
import { resolveTenantId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Reject anything older than this so a captured payload cannot be replayed indefinitely. */
const MAX_SKEW_S = 5 * 60;

function verify(raw: string, headers: Headers, secret: string): boolean {
  const id = headers.get('svix-id');
  const ts = headers.get('svix-timestamp');
  const sig = headers.get('svix-signature');
  if (!id || !ts || !sig) return false;

  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > MAX_SKEW_S) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${raw}`).digest('base64');

  // The header carries a space-separated list of `v1,<sig>` so keys can be rotated without downtime.
  for (const part of sig.split(' ')) {
    const got = part.split(',')[1];
    if (!got) continue;
    const a = Buffer.from(got);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

type InboundPayload = {
  type?: string;
  data?: {
    from?: string | { email?: string };
    subject?: string;
    text?: string;
    html?: string;
    message_id?: string;
    headers?: Record<string, string>;
  };
};

function addressOf(from: unknown): string | null {
  const s = typeof from === 'string' ? from : ((from as { email?: string } | null)?.email ?? '');
  // "Steph <steph@example.com>" -> steph@example.com
  const m = s.match(/<([^>]+)>/);
  const addr = (m ? m[1] : s).trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr) ? addr : null;
}

/** Strip tags so a marketing-heavy HTML reply does not become an unreadable wall in the board. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function POST_h(req: Request): Promise<Response> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('support/inbound: RESEND_WEBHOOK_SECRET unset, rejecting');
    return apiError('Not configured', 503);
  }

  const raw = await req.text();
  if (!verify(raw, req.headers, secret)) return apiError('Invalid signature', 401);

  let payload: InboundPayload;
  try {
    payload = JSON.parse(raw) as InboundPayload;
  } catch {
    return apiError('Invalid JSON');
  }

  const d = payload.data ?? {};
  const email = addressOf(d.from);
  const subject = (d.subject ?? '').trim() || '(no subject)';
  const body = (d.text?.trim() || (d.html ? htmlToText(d.html) : '')).slice(0, 20_000) || null;

  // The RFC Message-ID is the natural dedupe key: Resend retries a failed webhook, and a retry must
  // not become a second ticket.
  const messageId = d.message_id ?? d.headers?.['message-id'] ?? null;

  try {
    const companyId = await resolveTenantId();
    const res = await createSupportTicket({
      companyId,
      subject,
      body,
      email,
      source: 'email',
      dedupeKey: messageId ? `email:${messageId}` : null,
    });
    if (!res.ok) return apiError('Could not record message', 500);
    // 200 even for a duplicate: a non-2xx makes Resend retry, which would loop forever on a message
    // we have deliberately chosen not to store twice.
    return apiSuccess({ received: true, duplicate: Boolean(res.duplicate) });
  } catch (e) {
    console.error('support/inbound:', e instanceof Error ? e.message : e);
    return apiError('Could not record message', 500);
  }
}

export const POST = withApiLog(POST_h);
