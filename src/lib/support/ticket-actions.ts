'use server';
// Member-facing support: submit a ticket that flows into the operator admin portal (/admin/support).
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';

export type TicketSubmit = { ok: boolean; error?: string };

const Input = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().max(5000).optional(),
  category: z.enum(['question', 'bug', 'feature_request', 'billing', 'other']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

// Map the member-facing priority (medium) onto the ticket table's scale (normal).
const PRIORITY: Record<string, string> = { low: 'low', medium: 'normal', high: 'high', urgent: 'urgent' };

export async function submitSupportTicketAction(input: unknown): Promise<TicketSubmit> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  if (!(await checkRateLimit(ctx.userId, 'support-ticket', 10, 3600))) return { ok: false, error: 'rate_limited' };

  const svc = createServiceClient();
  const { data: me } = await svc.from('profiles').select('email').eq('id', ctx.userId).maybeSingle();
  const { error } = await svc.from('support_tickets').insert({
    company_id: ctx.companyId,
    profile_id: ctx.userId,
    email: (me as { email: string | null } | null)?.email ?? null,
    subject: parsed.data.subject,
    body: parsed.data.body || null,
    category: parsed.data.category ?? 'question',
    priority: PRIORITY[parsed.data.priority ?? 'medium'] ?? 'normal',
    source: 'app',
  });
  if (error) { console.error('submitSupportTicketAction:', error.message); return { ok: false, error: 'failed' }; }
  return { ok: true };
}
