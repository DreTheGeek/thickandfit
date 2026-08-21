import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Who is still waiting to be let into the app, and who has already been asked.
 *
 * THE GAP THIS EXISTS FOR. 272 of Stephanie's clients came across from Lenus with their whole
 * history - weigh-ins, check-ins, photos, years of messages - and 3 people in total can actually log
 * in. The invite pipeline that fixes that has been built and correct for weeks
 * (lib/legacy/invite.ts): bilingual, single-use links, idempotent, dry-run by default. It had no
 * screen. Its only caller was an internal route behind a CRON_SECRET bearer token, so the person
 * whose clients these are had no way to invite them.
 *
 * INVITED IS NOT CLAIMED, and the difference is the whole point of this screen. An invite that was
 * sent and never opened looks identical to one never sent unless something reads the send log, and
 * "I emailed everyone" with a third of them silently unopened is how a migration quietly loses a
 * third of a business.
 */

export type InviteRow = {
  contactId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  language: string | null;
  /** What she bought on Lenus. Two vocabularies live here; see the note in the coach console. */
  productType: string | null;
  /** An invite email has gone out. Not the same as her having used it. */
  invitedAt: string | null;
  /** The last send failed at the provider. Worth showing: a bounce is a wrong address, not a no. */
  lastSendFailed: boolean;
};

export type InviteQueue = {
  /** Legacy clients with an email who have never claimed an account. */
  waiting: InviteRow[];
  /** Of those, how many have already been emailed at least once. */
  invited: number;
  /** Legacy clients who HAVE claimed. The number that actually matters. */
  claimed: number;
  /** Everyone in scope, claimed or not. */
  totalClients: number;
  /** True when Resend is configured. Without it every send fails and the screen must say so. */
  emailConfigured: boolean;
};

export async function getInviteQueue(companyId: string): Promise<InviteQueue> {
  const svc = createServiceClient();

  // The SAME predicate inviteLegacyClients uses. If these two ever disagree the screen shows a
  // person the sender would refuse, which is worse than showing nobody.
  const [{ data: waiting, error: wErr }, { count: claimed }, { count: totalClients }, { data: sends }] =
    await Promise.all([
      svc
        .from('contacts')
        .select('id, email, first_name, last_name, language, product_type')
        .eq('company_id', companyId)
        .eq('type', 'client')
        .eq('is_legacy', true)
        .is('profile_id', null)
        .not('email', 'is', null)
        .order('first_name', { ascending: true })
        .limit(2000),
      svc
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('type', 'client')
        .eq('is_legacy', true)
        .not('profile_id', 'is', null),
      svc
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('type', 'client')
        .eq('is_legacy', true),
      svc
        .from('email_send_log')
        .select('to_email, status, created_at')
        .eq('company_id', companyId)
        .eq('template', 'legacy_invite')
        .order('created_at', { ascending: false })
        .limit(5000),
    ]);

  if (wErr) console.error('getInviteQueue waiting:', wErr.message);

  // Newest send per address wins: a resend after a bounce should read as sent, not as failed.
  const lastSend = new Map<string, { status: string; at: string }>();
  for (const s of (sends ?? []) as { to_email: string; status: string; created_at: string }[]) {
    const key = (s.to_email ?? '').toLowerCase();
    if (!key || lastSend.has(key)) continue;
    lastSend.set(key, { status: s.status, at: s.created_at });
  }

  const rows: InviteRow[] = ((waiting ?? []) as {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    language: string | null;
    product_type: string | null;
  }[]).map((c) => {
    const send = lastSend.get((c.email ?? '').toLowerCase());
    return {
      contactId: c.id,
      email: c.email,
      firstName: c.first_name,
      lastName: c.last_name,
      language: c.language,
      productType: c.product_type,
      invitedAt: send?.at ?? null,
      lastSendFailed: send?.status === 'failed',
    };
  });

  return {
    waiting: rows,
    invited: rows.filter((r) => r.invitedAt != null).length,
    claimed: claimed ?? 0,
    totalClients: totalClients ?? 0,
    // Read here rather than in the component: the key is server-only, and a screen that offers to
    // send while nothing can send is the kind of silent failure this whole console keeps producing.
    emailConfigured: Boolean((process.env.RESEND_API_KEY ?? '').trim()),
  };
}
