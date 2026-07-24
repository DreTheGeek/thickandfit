import 'server-only';
// Waitlist funnel service — the read/write layer for the Libra Season launch (Aug 4 → Sept 27).
//
// Route rule from kb-funnels SKILL.md: the thank-you page is the product pre-launch. Signup fires
// its side effects but never blocks the caller from getting a lead id, share URL, and entry count.
// Idempotency comes from waitlist_entry_events(lead_id, idempotency_key) being unique — a retried
// signup, a resubmitted quiz, or a re-clicked referral link never double-credits.
//
// Post-conversion suppression: convertLead() flips converted_at and, together with unsubscribed_at,
// is the truth for every drip send filter. Nothing else in this service or the drip owner may bypass
// those two columns.
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { enrollInDrip } from '@/lib/ghl/client';
import { sendLeadMagnet } from '@/lib/email/resend';

const TENANT_SLUG = 'thick-and-fit';

// Entry point values (spec locked in the 2026-07-23 call + kb-funnels/references/referral-mechanics.md).
export const ENTRY_POINTS = {
  signup: 1,
  quiz: 2,
  referral: 3,
  follow: 1,
} as const;

// Referral credit cap (per the launch plan: max 20 credited referrals per lead).
export const REFERRAL_CAP = 20;

// Validators
export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  first_name: z.string().trim().min(1).max(60).optional(),
  last_name: z.string().trim().min(1).max(60).optional(),
  phone: z.string().trim().min(7).max(24).optional(),
  instagram_handle: z.string().trim().min(1).max(60).optional(),
  locale: z.enum(['en', 'es']).default('en'),
  referred_by_code: z.string().trim().min(4).max(40).optional(),
  source: z.string().max(120).optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const quizSchema = z.object({
  leadId: z.string().uuid(),
  goal: z.array(z.enum(['lose_fat', 'build_muscle', 'recomp', 'strength', 'feel_better', 'nutrition'])).min(1).max(6),
  home_or_gym: z.enum(['home', 'gym', 'both']),
  days_per_week: z.number().int().min(1).max(7),
  how_they_eat: z.enum(['macros', 'meal_plan', 'intuitive', 'not_sure']),
  preferred_language: z.enum(['en', 'es']).optional(),
});
export type QuizInput = z.infer<typeof quizSchema>;

export type SignupResult = {
  leadId: string;
  referralCode: string;
  entryCount: number;
  isNew: boolean;
};

async function resolveTenantId(): Promise<string> {
  const supabase = createServiceClient();
  const { data } = await supabase.from('companies').select('id').eq('slug', TENANT_SLUG).maybeSingle();
  if (!data) throw new Error('funnel/service: tenant not configured');
  return (data as { id: string }).id;
}

/** Look up a referrer by their share code. Case-insensitive, tenant-scoped. */
export async function findLeadByReferralCode(code: string): Promise<{ id: string; first_name: string | null } | null> {
  if (!code) return null;
  const supabase = createServiceClient();
  const companyId = await resolveTenantId();
  const { data } = await supabase
    .from('waitlist_leads')
    .select('id, first_name')
    .eq('company_id', companyId)
    .eq('referral_code', code.trim().toLowerCase())
    .maybeSingle();
  return data as { id: string; first_name: string | null } | null;
}

/** Append an entry event, idempotent on (lead_id, idempotency_key). Returns whether it was new. */
async function recordEntry(
  companyId: string,
  leadId: string,
  kind: 'signup' | 'quiz' | 'referral' | 'follow_ig' | 'follow_tt' | 'follow_yt' | 'post_public',
  points: number,
  idempotencyKey: string,
  sourceLeadId: string | null = null,
): Promise<boolean> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('waitlist_entry_events').insert({
    company_id: companyId,
    lead_id: leadId,
    kind,
    points,
    idempotency_key: idempotencyKey,
    source_lead_id: sourceLeadId,
  });
  if (!error) return true;
  // 23505 = unique_violation on the dedupe index. Not an error, just a no-op.
  if ((error as { code?: string }).code === '23505') return false;
  console.error('funnel/service.recordEntry:', error.message);
  return false;
}

/** Refresh entry_count on the lead from the ledger. Called after any entry insert. */
async function refreshEntryCount(leadId: string): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase.from('waitlist_entry_events').select('points').eq('lead_id', leadId);
  const sum = ((data ?? []) as { points: number }[]).reduce((a, b) => a + (Number(b.points) || 0), 0);
  await supabase.from('waitlist_leads').update({ entry_count: sum }).eq('id', leadId);
  return sum;
}

/** Credit the referrer for a confirmed referral. Enforces the 20-cap by counting existing
 *  referral events on the referrer (cheap: one indexed count) before writing. */
async function creditReferral(companyId: string, referrerLeadId: string, newLeadId: string): Promise<void> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from('waitlist_entry_events')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', referrerLeadId)
    .eq('kind', 'referral');
  if ((count ?? 0) >= REFERRAL_CAP) return; // cap reached, silently skip credit
  const idem = `ref:${newLeadId}`;
  const inserted = await recordEntry(companyId, referrerLeadId, 'referral', ENTRY_POINTS.referral, idem, newLeadId);
  if (inserted) await refreshEntryCount(referrerLeadId);
}

/**
 * Sign up a lead. Idempotent per (company, email): a resubmit updates the details and returns the
 * existing lead + share code (never a new one — the referral link must stay stable for the whole
 * launch). Credits a referrer if the code resolves.
 */
export async function submitSignup(input: SignupInput): Promise<SignupResult> {
  const parsed = signupSchema.parse(input);
  const supabase = createServiceClient();
  const companyId = await resolveTenantId();

  // Resolve any referrer first — a bad code just falls through (no crash on the friend's flow).
  const referrer = parsed.referred_by_code ? await findLeadByReferralCode(parsed.referred_by_code) : null;

  // Upsert on (company, email). RETURNING gives us the referral_code the DB default generated.
  // We only set fields the caller provided so a returning user's stored name/phone isn't wiped.
  const patch: Record<string, unknown> = {
    company_id: companyId,
    email: parsed.email,
    locale: parsed.locale,
    source: parsed.source ?? 'waitlist',
  };
  if (parsed.first_name) patch.first_name = parsed.first_name;
  if (parsed.last_name) patch.last_name = parsed.last_name;
  if (parsed.phone) patch.phone = parsed.phone;
  if (parsed.instagram_handle) patch.instagram_handle = parsed.instagram_handle;
  if (referrer) patch.referred_by_code = parsed.referred_by_code!.trim().toLowerCase();

  const { data: lead, error } = await supabase
    .from('waitlist_leads')
    .upsert(patch, { onConflict: 'company_id,email' })
    .select('id, referral_code, entry_count, created_at')
    .single();
  if (error || !lead) throw new Error(`funnel/service.submitSignup: ${error?.message ?? 'no row'}`);

  // A brand-new lead was created if created_at is within the last few seconds. Fine as a signal —
  // if two signups race the loser will read created_at from the winning insert and skip credit here.
  const isNew = Date.now() - new Date((lead as { created_at: string }).created_at).getTime() < 10_000;

  // Signup entry (idempotent per lead — a resubmit doesn't double-count).
  const signupInserted = await recordEntry(companyId, lead.id, 'signup', ENTRY_POINTS.signup, `signup:${lead.id}`);
  const entryCount = signupInserted ? await refreshEntryCount(lead.id) : (lead as { entry_count: number }).entry_count;

  // Referral credit — only when we resolved a code AND the referrer isn't the lead themselves.
  if (referrer && referrer.id !== lead.id) {
    await creditReferral(companyId, referrer.id, lead.id);
  }

  // Best-effort deliverability side effects. Both return false rather than throw when unconfigured.
  void sendLeadMagnet(parsed.email, parsed.locale).catch((e) => console.error('sendLeadMagnet:', e?.message));
  void enrollInDrip(parsed.email, parsed.locale)
    .then((ghl) => {
      if (ghl.contactId) void supabase.from('waitlist_leads').update({ ghl_contact_id: ghl.contactId }).eq('id', lead.id);
    })
    .catch((e) => console.error('enrollInDrip:', e?.message));

  return {
    leadId: lead.id as string,
    referralCode: (lead as { referral_code: string }).referral_code,
    entryCount,
    isNew,
  };
}

/**
 * Store a quiz response and credit +2 entries once. Idempotent on the lead — a re-submit updates
 * the response row (via unique(lead_id)) but never adds a second quiz entry.
 */
export async function submitQuiz(input: QuizInput): Promise<{ entryCount: number; credited: boolean }> {
  const parsed = quizSchema.parse(input);
  const supabase = createServiceClient();
  const companyId = await resolveTenantId();

  // Upsert the response row (unique on lead_id).
  const { error: qErr } = await supabase.from('waitlist_quiz_responses').upsert(
    {
      company_id: companyId,
      lead_id: parsed.leadId,
      goal: parsed.goal,
      home_or_gym: parsed.home_or_gym,
      days_per_week: parsed.days_per_week,
      how_they_eat: parsed.how_they_eat,
      preferred_language: parsed.preferred_language ?? 'en',
    },
    { onConflict: 'lead_id' },
  );
  if (qErr) throw new Error(`funnel/service.submitQuiz: ${qErr.message}`);

  // Award the entry (dedupe key ensures once-only).
  const credited = await recordEntry(companyId, parsed.leadId, 'quiz', ENTRY_POINTS.quiz, `quiz:${parsed.leadId}`);
  // Stamp the completion time on the lead itself (idempotent — first-write wins in practice).
  await supabase.from('waitlist_leads').update({ quiz_completed_at: new Date().toISOString() }).eq('id', parsed.leadId).is('quiz_completed_at', null);

  const entryCount = await refreshEntryCount(parsed.leadId);
  return { entryCount, credited };
}

export type LeadStats = {
  entryCount: number;
  referralCount: number; // credited referrals so far (0..REFERRAL_CAP)
  referralCapRemaining: number;
  quizDone: boolean;
  socialFollows: number;
  position: number | null; // rank by entry_count DESC across the tenant; null if unknown
};

/** Read the numbers the thank-you page renders. Called on every load, kept cheap. */
export async function getLeadStats(leadId: string): Promise<LeadStats | null> {
  const supabase = createServiceClient();
  const companyId = await resolveTenantId();
  const { data: lead } = await supabase
    .from('waitlist_leads')
    .select('id, entry_count, quiz_completed_at')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead) return null;

  const [{ count: refCount }, { count: followCount }, { count: aheadCount }] = await Promise.all([
    supabase.from('waitlist_entry_events').select('id', { count: 'exact', head: true }).eq('lead_id', leadId).eq('kind', 'referral'),
    supabase.from('waitlist_entry_events').select('id', { count: 'exact', head: true }).eq('lead_id', leadId).in('kind', ['follow_ig', 'follow_tt', 'follow_yt']),
    supabase
      .from('waitlist_leads')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gt('entry_count', (lead as { entry_count: number }).entry_count)
      .is('unsubscribed_at', null),
  ]);
  const referralCount = refCount ?? 0;
  return {
    entryCount: (lead as { entry_count: number }).entry_count,
    referralCount,
    referralCapRemaining: Math.max(0, REFERRAL_CAP - referralCount),
    quizDone: (lead as { quiz_completed_at: string | null }).quiz_completed_at != null,
    socialFollows: followCount ?? 0,
    position: aheadCount == null ? null : aheadCount + 1,
  };
}

/**
 * Post-conversion suppression. Called from the Stripe checkout.session.completed webhook when the
 * customer's email matches a waitlist lead. Flipping converted_at excludes them from EVERY drip
 * send (scheduled + triggered) — see the kb-funnels route-rule doctrine. Idempotent.
 */
export async function convertLead(email: string): Promise<{ found: boolean }> {
  const supabase = createServiceClient();
  const companyId = await resolveTenantId();
  const { data, error } = await supabase
    .from('waitlist_leads')
    .update({ converted_at: new Date().toISOString() })
    .eq('company_id', companyId)
    .eq('email', email.trim().toLowerCase())
    .is('converted_at', null)
    .select('id');
  if (error) {
    console.error('funnel/service.convertLead:', error.message);
    return { found: false };
  }
  return { found: ((data ?? []) as unknown[]).length > 0 };
}
