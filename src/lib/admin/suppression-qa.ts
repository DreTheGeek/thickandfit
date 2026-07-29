import 'server-only';
// Suppression QA harness (kb-funnels doctrine: "test the suppression before the first email").
//
// The mis-send that will hurt Aug-4 is sending "doors close in 24 hours" to someone who already
// bought, or blasting the double-opt-in drip to someone who just signed up before they confirmed.
// This harness seeds one throwaway lead end-to-end and asserts the DB proxies for every suppression
// hook. We do not have read access to GHL, so instead we assert the two columns that OWN the
// suppression: waitlist_leads.confirmed_at and .converted_at. Those are the ONLY switches the drip
// filters read, and convertLead() is the ONLY path that flips converted_at + pushes converted/member
// tags to GHL. If converted_at is null after a fresh signup, no premature GHL conversion tag fired.
//
// English-only ops surface.
import { createServiceClient } from '@/lib/supabase/service';

export type QaStep = {
  name: string;
  ok: boolean;
  detail: string;
};

export type QaResult = {
  overall: 'pass' | 'fail';
  email: string | null;
  leadId: string | null;
  steps: QaStep[];
  startedAt: string;
  finishedAt: string;
};

export type CleanupResult = {
  deleted: number;
  error?: string;
};

// Any address at test.local is a black-hole domain: it will bounce cleanly and never reach a real
// inbox. We match on this suffix so cleanup only ever touches QA rows.
export const QA_EMAIL_PREFIX = 'qa-';
export const QA_EMAIL_DOMAIN = 'test.local';

export function isQaEmail(email: string | null): boolean {
  if (!email) return false;
  return email.startsWith(QA_EMAIL_PREFIX) && email.endsWith(`@${QA_EMAIL_DOMAIN}`);
}

/**
 * Read the QA rows currently in the table so the page can show the operator what has accumulated
 * (and how many would be swept by Cleanup). Scoped by explicit email pattern; not tenant-scoped
 * because these rows are always ephemeral and we sweep them by the same pattern.
 */
export async function listQaLeads(): Promise<{ email: string; created_at: string; confirmed_at: string | null; converted_at: string | null }[]> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('waitlist_leads')
    .select('email, created_at, confirmed_at, converted_at')
    .like('email', `${QA_EMAIL_PREFIX}%@${QA_EMAIL_DOMAIN}`)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) {
    console.error('suppression-qa.listQaLeads:', error.message);
    return [];
  }
  return (data ?? []) as {
    email: string;
    created_at: string;
    confirmed_at: string | null;
    converted_at: string | null;
  }[];
}

/**
 * Read a QA row by email. Used by the runner between phases so each assertion reads fresh state
 * from the database instead of trusting whatever submitSignup/confirmLeadByToken returned.
 */
export async function readQaLead(email: string): Promise<{
  id: string;
  email: string;
  confirm_token: string | null;
  entry_count: number;
  confirmed_at: string | null;
  converted_at: string | null;
} | null> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('waitlist_leads')
    .select('id, email, confirm_token, entry_count, confirmed_at, converted_at')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  if (error) {
    console.error('suppression-qa.readQaLead:', error.message);
    return null;
  }
  return data as {
    id: string;
    email: string;
    confirm_token: string | null;
    entry_count: number;
    confirmed_at: string | null;
    converted_at: string | null;
  } | null;
}

/** Delete every QA lead (and their entry ledger via ON DELETE CASCADE). Returns how many rows went. */
export async function deleteQaLeads(): Promise<CleanupResult> {
  const svc = createServiceClient();
  // Head-count first so we can report an accurate deleted-count; the delete itself with no returning
  // clause doesn't tell us the row count in supabase-js v2.
  const { count, error: cErr } = await svc
    .from('waitlist_leads')
    .select('id', { count: 'exact', head: true })
    .like('email', `${QA_EMAIL_PREFIX}%@${QA_EMAIL_DOMAIN}`);
  if (cErr) return { deleted: 0, error: cErr.message };
  const { error: delErr } = await svc
    .from('waitlist_leads')
    .delete()
    .like('email', `${QA_EMAIL_PREFIX}%@${QA_EMAIL_DOMAIN}`);
  if (delErr) return { deleted: 0, error: delErr.message };
  return { deleted: count ?? 0 };
}
