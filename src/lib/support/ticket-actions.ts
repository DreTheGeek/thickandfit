'use server';
// Member-facing support: submit a ticket from inside the app.
//
// ROUTES THROUGH createSupportTicket, and that is why this file is worth reading. It previously wrote
// to support_tickets with a raw insert, so a ticket filed from the app got NO PII scan, NO triage, NO
// Telegram alert and NO email, while the identical ticket filed from the public form got all four.
// That is the exact drift intake.ts's header warns about ("we fixed it for the form but not for
// email"), and the only durable fix is one way in.
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { createSupportTicket } from '@/lib/support/intake';
import { storeAttachment } from '@/lib/support/attachment';

export type TicketSubmit = { ok: boolean; error?: string };

const Input = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().max(5000).optional(),
  category: z.enum(['question', 'bug', 'feature_request', 'billing', 'other']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  // A screenshot OF THE BUG, as a data URL from the file input. Bounded at ~14MB of base64 to cover
  // the bucket's 10MB binary limit plus encoding overhead; storeAttachment enforces the real cap and
  // the mime allowlist.
  attachment: z.string().max(14_000_000).optional(),
  videoUrl: z.string().trim().url().max(500).optional(),
});

// Map the member-facing priority (medium) onto the ticket table's scale (normal).
const PRIORITY: Record<string, 'low' | 'normal' | 'high' | 'urgent'> = {
  low: 'low', medium: 'normal', high: 'high', urgent: 'urgent',
};

export async function submitSupportTicketAction(input: unknown): Promise<TicketSubmit> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  if (!(await checkRateLimit(ctx.userId, 'support-ticket', 10, 3600))) return { ok: false, error: 'rate_limited' };

  const svc = createServiceClient();
  const { data: me } = await svc
    .from('profiles')
    .select('email, full_name')
    .eq('id', ctx.userId)
    .maybeSingle();
  const profile = me as { email: string | null; full_name: string | null } | null;

  // Stored BEFORE the ticket so the path goes in with the row. A failed upload returns null and the
  // ticket is created anyway: a bug report without its screenshot is still worth having.
  const attachmentPath = parsed.data.attachment
    ? await storeAttachment(parsed.data.attachment, ctx.userId)
    : null;

  const res = await createSupportTicket({
    companyId: ctx.companyId,
    subject: parsed.data.subject,
    body: parsed.data.body || null,
    email: profile?.email ?? null,
    source: 'app',
    profileId: ctx.userId,
    category: parsed.data.category ?? 'question',
    priority: PRIORITY[parsed.data.priority ?? 'medium'] ?? 'normal',
    repName: profile?.full_name ?? null,
    attachmentUrl: attachmentPath,
    videoUrl: parsed.data.videoUrl ?? null,
  });

  if (!res.ok) return { ok: false, error: 'failed' };
  return { ok: true };
}
