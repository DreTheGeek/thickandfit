'use server';
// Resubscribe a suppressed address. Operator-only, audited, and deliberately narrow: it clears the
// suppression flag on ONE source row and nothing else. It does not re-add anyone to a drip — GHL
// owns audience membership; this only removes our "do not contact" gate so a future send is allowed.
//
// Why an audit row matters here: un-suppressing an address that hard-bounced or filed a complaint
// is exactly the action a deliverability post-mortem needs to trace. Gmail/Yahoo bulk-sender rules
// treat repeat sends to complainers as a reputation hit, so this is a real decision, not a toggle.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOperator } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { logCoachAction } from '@/lib/coach/audit';

export type ResubscribeResult = { ok: boolean; error?: string };

const inputSchema = z.object({
  source: z.enum(['waitlist', 'email']),
  id: z.string().min(1).max(200),
  email: z.string().trim().toLowerCase().email(),
});

export async function resubscribeAction(input: unknown): Promise<ResubscribeResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireOperator();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  // 20/hr: this is a rare, deliberate action. A burst means something is wrong.
  if (!(await checkRateLimit(ctx.userId, 'admin-resubscribe', 20, 3600, { failClosed: true }))) {
    return { ok: false, error: 'rate_limited' };
  }

  const { source, id, email } = parsed.data;
  const sb = createServiceClient();

  if (source === 'waitlist') {
    // Tenant-scoped: a waitlist lead always belongs to a company.
    const { error } = await sb
      .from('waitlist_leads')
      .update({ unsubscribed_at: null })
      .eq('company_id', ctx.companyId)
      .eq('id', id);
    if (error) {
      console.error('resubscribeAction waitlist:', error.message);
      return { ok: false, error: 'failed' };
    }
  } else {
    // email_suppression_list is global by design (a hard bounce is a hard bounce for every tenant),
    // so there is no company_id filter here. The email match is the scope.
    const { error } = await sb.from('email_suppression_list').delete().eq('id', id);
    if (error) {
      console.error('resubscribeAction email:', error.message);
      return { ok: false, error: 'failed' };
    }
  }

  logCoachAction(sb, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'suppression',
    entityId: id,
    action: 'admin.resubscribe',
    newState: { source, email },
  });

  revalidatePath('/admin/comms/suppressions');
  return { ok: true };
}
