import 'server-only';
// One way in for every support ticket: the public form, inbound email, and the operator's manual
// log all land here. Single path so dedupe, triage and the GitHub hand-off cannot drift between
// sources, which is exactly how "we fixed it for the form but not for email" happens.
import { createHash } from 'crypto';
import { after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { triageTicket } from '@/lib/support/triage';
import { openIssueForTicket } from '@/lib/support/github';

export type IntakeInput = {
  companyId: string;
  subject: string;
  body: string | null;
  email: string | null;
  source: 'web' | 'email' | 'manual';
  /** Stable per-source identity (email Message-ID, or a content hash for the form). */
  dedupeKey?: string | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  category?: string | null;
};

export type IntakeResult = { ok: boolean; ticketId?: string; duplicate?: boolean };

/**
 * Content hash for sources with no natural id. Deliberately includes the body: a member writing a
 * second, different message with the same subject is a NEW ticket, not a duplicate.
 */
export function contentDedupeKey(email: string | null, subject: string, body: string | null): string {
  return createHash('sha256')
    .update(`${(email ?? '').toLowerCase()}|${subject.trim().toLowerCase()}|${(body ?? '').trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 40);
}

/**
 * Create a ticket, then triage it in the background.
 *
 * Triage runs inside after(): it makes a model call plus several queries, and on Vercel a bare void
 * after the response races the freezing lambda (the funnel lost every GHL contact to exactly that).
 * The ticket is committed BEFORE triage runs, so a triage failure can never cost us the ticket.
 */
export async function createSupportTicket(input: IntakeInput): Promise<IntakeResult> {
  const svc = createServiceClient();
  const subject = input.subject.trim().slice(0, 200) || '(no subject)';
  const body = input.body?.trim().slice(0, 20_000) || null;
  const email = input.email?.trim().toLowerCase() || null;
  const dedupeKey = input.dedupeKey ?? contentDedupeKey(email, subject, body);

  const { data, error } = await svc
    .from('support_tickets')
    .insert({
      company_id: input.companyId,
      subject,
      body,
      email,
      source: input.source,
      priority: input.priority ?? 'normal',
      category: input.category ?? null,
      dedupe_key: dedupeKey,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    // 23505 = the partial unique index on (company_id, dedupe_key). A webhook retry or a double-tap
    // on Send is normal traffic, not an error: report success so the caller does not tell a member
    // their message failed and prompt a third copy.
    if (error.code === '23505') return { ok: true, duplicate: true };
    console.error('createSupportTicket:', error.message);
    return { ok: false };
  }

  const ticketId = (data as { id: string } | null)?.id;
  if (!ticketId) return { ok: false };

  const enrich = async (): Promise<void> => {
    const triage = await triageTicket({ ticketId, companyId: input.companyId, subject, body, email, source: input.source });
    if (!triage) return;
    // Let triage refine priority/category, since the member picking "other/normal" on a form tells us
    // very little. The operator can still override from the board.
    await svc
      .from('support_tickets')
      .update({
        triage,
        triaged_at: new Date().toISOString(),
        priority: triage.priority,
        category: triage.category,
      })
      .eq('id', ticketId);
    await openIssueForTicket({ ticketId, companyId: input.companyId, subject, body, email, triage });
  };

  try {
    after(enrich);
  } catch {
    // Outside a request scope (a script or a test): run it inline rather than dropping it.
    void enrich();
  }

  return { ok: true, ticketId };
}
