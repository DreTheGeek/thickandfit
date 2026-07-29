import 'server-only';
// Unified suppression read. Merges the two places we track "do not contact":
//   1. waitlist_leads.unsubscribed_at is not null (source='waitlist') — funnel-drip opt-outs.
//   2. email_suppression_list (source='email') — Resend webhook-fed bounces / complaints / unsubs,
//      plus any manual suppressions. This table is KALDR:GLOBAL (no company_id) because email
//      deliverability crosses tenants (a hard bounce on an address is a hard bounce forever).
// The operator sees them in one board, ordered newest-first, searchable by email. Resubscribe
// clears the correct source flag and writes an audit row (see suppressions-actions.ts).
//
// SMS/TCPA STOP is intentionally NOT wired here yet: no phone_suppression / sms_stop table exists
// in the schema. When Twilio 10DLC lands and we mirror STOP responses, add a third source here.
import { createServiceClient } from '@/lib/supabase/service';

export type SuppressionSource = 'waitlist' | 'email';
export type SuppressionReason = 'unsubscribed' | 'bounced' | 'complained' | 'manual';

export type SuppressionRow = {
  key: string;              // stable client-side key: `${source}:${id}`
  id: string;               // row id in its source table (lead_id or suppression_id)
  source: SuppressionSource;
  email: string;
  reason: SuppressionReason;
  suppressedAt: string;     // ISO
};

export type SuppressionSummary = {
  total: number;
  byWaitlist: number;
  byEmailBounce: number;
  byEmailComplaint: number;
  byEmailUnsub: number;
  byManual: number;
};

export type SuppressionBoard = {
  summary: SuppressionSummary;
  rows: SuppressionRow[];
};

// Cap the read so a runaway suppression count never blows the page. If we ever cross this,
// paginate. At 500 the search bar + client filter still stays snappy.
const HARD_CAP = 500;

export async function getSuppressionBoard(companyId: string): Promise<SuppressionBoard> {
  const sb = createServiceClient();

  const [waitlistRes, emailRes] = await Promise.all([
    sb
      .from('waitlist_leads')
      .select('id, email, unsubscribed_at')
      .eq('company_id', companyId)
      .not('unsubscribed_at', 'is', null)
      .order('unsubscribed_at', { ascending: false })
      .limit(HARD_CAP),
    sb
      .from('email_suppression_list')
      .select('id, email, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(HARD_CAP),
  ]);

  const waitlistRows: SuppressionRow[] = ((waitlistRes.data ?? []) as {
    id: string;
    email: string | null;
    unsubscribed_at: string;
  }[])
    .filter((r) => !!r.email)
    .map((r) => ({
      key: `waitlist:${r.id}`,
      id: r.id,
      source: 'waitlist' as const,
      email: (r.email ?? '').toLowerCase(),
      reason: 'unsubscribed' as const,
      suppressedAt: r.unsubscribed_at,
    }));

  const emailRows: SuppressionRow[] = ((emailRes.data ?? []) as {
    id: string;
    email: string;
    reason: string;
    created_at: string;
  }[])
    .filter((r) => isKnownReason(r.reason))
    .map((r) => ({
      key: `email:${r.id}`,
      id: r.id,
      source: 'email' as const,
      email: r.email.toLowerCase(),
      reason: r.reason as SuppressionReason,
      suppressedAt: r.created_at,
    }));

  // Merge, sort newest first, cap. If the same email is in both sources the operator sees both
  // rows (each source has its own resubscribe flow), so no dedupe here.
  const merged = [...waitlistRows, ...emailRows]
    .sort((a, b) => (a.suppressedAt < b.suppressedAt ? 1 : -1))
    .slice(0, HARD_CAP);

  const summary: SuppressionSummary = {
    total: merged.length,
    byWaitlist: waitlistRows.length,
    byEmailBounce: emailRows.filter((r) => r.reason === 'bounced').length,
    byEmailComplaint: emailRows.filter((r) => r.reason === 'complained').length,
    byEmailUnsub: emailRows.filter((r) => r.reason === 'unsubscribed').length,
    byManual: emailRows.filter((r) => r.reason === 'manual').length,
  };

  return { summary, rows: merged };
}

function isKnownReason(r: string): r is SuppressionReason {
  return r === 'unsubscribed' || r === 'bounced' || r === 'complained' || r === 'manual';
}

export function reasonLabel(r: SuppressionReason): string {
  switch (r) {
    case 'bounced':      return 'Hard bounce';
    case 'complained':   return 'Spam complaint';
    case 'unsubscribed': return 'Unsubscribed';
    case 'manual':       return 'Manual';
  }
}

export function sourceLabel(s: SuppressionSource): string {
  return s === 'waitlist' ? 'Waitlist' : 'Email (global)';
}
