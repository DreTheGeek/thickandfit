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
import { headers } from 'next/headers';
import { after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { enrollInDrip, upsertGhlContact } from '@/lib/ghl/client';
import { sendLeadMagnet, sendWaitlistConfirmation } from '@/lib/email/resend';

const TENANT_SLUG = 'thick-and-fit';

/**
 * Run a side effect that must OUTLIVE the response without blocking it.
 *
 * On Vercel a bare `void asyncFn()` after the response races the freezing lambda, and slow vendors
 * lose that race silently. Proven in prod on 2026-07-30: a probe signup sent its Resend email
 * (~300ms, won) but never created its GHL contact (~1-2s, lost), so `ghl_contact_id` stayed null on
 * every lead. `after()` keeps the lambda alive until the work finishes.
 *
 * Every GHL tag push in this file goes through here. Those tags are not cosmetic: they are the
 * triggers and the EXIT CONDITION of the drip built in GoHighLevel, so a dropped `converted` tag
 * means a paying member keeps receiving "doors close in 24 hours".
 */
function runInBackground(label: string, fn: () => Promise<unknown>): void {
  const guarded = async (): Promise<void> => {
    try {
      await fn();
    } catch (e: unknown) {
      console.error(`${label}:`, e instanceof Error ? e.message : e);
    }
  };
  try {
    after(guarded);
  } catch {
    // Outside a request scope (a script or a test): run it inline rather than dropping it.
    void guarded();
  }
}

/** Tag a GHL contact in the background. See runInBackground for why this is not a bare void. */
function tagContactInBackground(
  label: string,
  contact: { email: string; firstName?: string | null; lastName?: string | null },
  tags: string[],
): void {
  runInBackground(label, () =>
    upsertGhlContact({
      email: contact.email,
      firstName: contact.firstName ?? null,
      lastName: contact.lastName ?? null,
      tags,
    }),
  );
}

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
  // Cloudflare Turnstile challenge response, produced by the widget on the client. Server
  // verifies it in /api/funnel/signup before submitSignup runs. Schema accepts it optional so
  // an existing curl / server-side caller with no widget stays valid — the verify layer in the
  // route is the gate, not the schema.
  turnstile_token: z.string().max(2048).optional(),
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

/**
 * Milestone thresholds at which we push a `referred:<N>` tag to the referrer's GHL contact so
 * Shakira can run congrats/top-referrer sequences off audience filters. Additive — a referrer at
 * 6 ends up with `referred:1` AND `referred:5`. Cap-hit gets `referred:20` explicitly so a "you
 * maxed out" sequence can fire distinctly from mid-tier congrats.
 */
const REFERRAL_MILESTONES: readonly number[] = [1, 5, 20];

/** Credit the referrer for a confirmed referral. Enforces the 20-cap by counting existing
 *  referral events on the referrer (cheap: one indexed count) before writing. Returns the new
 *  count so the caller can push milestone tags to GHL when a threshold has just been crossed. */
async function creditReferral(
  companyId: string,
  referrerLeadId: string,
  newLeadId: string,
): Promise<{ credited: boolean; newCount: number }> {
  const supabase = createServiceClient();
  const { count: prior } = await supabase
    .from('waitlist_entry_events')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', referrerLeadId)
    .eq('kind', 'referral');
  const priorCount = prior ?? 0;
  if (priorCount >= REFERRAL_CAP) return { credited: false, newCount: priorCount };
  const idem = `ref:${newLeadId}`;
  const inserted = await recordEntry(companyId, referrerLeadId, 'referral', ENTRY_POINTS.referral, idem, newLeadId);
  if (!inserted) return { credited: false, newCount: priorCount };
  await refreshEntryCount(referrerLeadId);
  return { credited: true, newCount: priorCount + 1 };
}

/**
 * Push referral-milestone tags to GHL when the referrer's new count JUST crossed a threshold.
 * Idempotent by GHL's additive-tag semantics — a second call with the same tag is a no-op. Runs
 * best-effort in the background; GHL being down never blocks the referral credit itself.
 */
async function pushReferralMilestoneTag(
  companyId: string,
  referrerLeadId: string,
  priorCount: number,
  newCount: number,
): Promise<void> {
  const crossed = REFERRAL_MILESTONES.filter((m) => priorCount < m && newCount >= m);
  if (crossed.length === 0) return;
  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from('waitlist_leads')
    .select('email, first_name, last_name')
    .eq('id', referrerLeadId)
    .eq('company_id', companyId)
    .maybeSingle();
  const referrer = row as { email: string; first_name: string | null; last_name: string | null } | null;
  if (!referrer?.email) return;
  const tags = crossed.map((n) => `referred:${n}`);
  // Awaited, NOT scheduled here. This function does a DB read first, so scheduling the tag from
  // inside it would mean calling after() once the response may already be gone. The caller wraps
  // this whole function in runInBackground instead, so there is exactly one scheduling point.
  await upsertGhlContact({
    email: referrer.email,
    firstName: referrer.first_name,
    lastName: referrer.last_name,
    tags,
  });
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
    .select('id, referral_code, confirm_token, entry_count, confirmed_at, created_at')
    .single();
  if (error || !lead) throw new Error(`funnel/service.submitSignup: ${error?.message ?? 'no row'}`);

  // A brand-new lead was created if created_at is within the last few seconds. Fine as a signal —
  // if two signups race the loser will read created_at from the winning insert and skip credit here.
  const isNew = Date.now() - new Date((lead as { created_at: string }).created_at).getTime() < 10_000;

  // Signup entry (idempotent per lead — a resubmit doesn't double-count).
  const signupInserted = await recordEntry(companyId, lead.id, 'signup', ENTRY_POINTS.signup, `signup:${lead.id}`);
  const entryCount = signupInserted ? await refreshEntryCount(lead.id) : (lead as { entry_count: number }).entry_count;

  // Referral credit — only when we resolved a code AND the referrer isn't the lead themselves.
  // Milestone push runs after credit so a threshold-crossing referral surfaces the tag same-request.
  if (referrer && referrer.id !== lead.id) {
    const { credited, newCount } = await creditReferral(companyId, referrer.id, lead.id);
    if (credited) {
      // priorCount = newCount - 1 (creditReferral just added exactly one). Backgrounded, never
      // blocking: the referral itself is durable in the DB whether or not GHL takes the tag.
      const ref = referrer;
      runInBackground('pushReferralMilestoneTag', () =>
        pushReferralMilestoneTag(companyId, ref.id, newCount - 1, newCount),
      );
    }
  }

  // Best-effort deliverability side effects. See runInBackground for why these cannot be bare voids:
  // a prod probe on 2026-07-30 signed up fine and the Resend confirmation arrived (~300ms, won the
  // race) while the GHL contact never appeared (~1-2s, lost it), which would have left the Aug 4
  // drip with an empty audience.
  const sideEffects = async (): Promise<void> => {
    await sendLeadMagnet(parsed.email, parsed.locale).catch((e) =>
      console.error('sendLeadMagnet:', e?.message),
    );
    // Name + phone so the GHL contact is not anonymous: a drip that opens "Hey ," is worse than no
    // drip, and the SMS track needs the number.
    const ghl = await enrollInDrip(parsed.email, parsed.locale, {
      firstName: parsed.first_name,
      lastName: parsed.last_name,
      phone: parsed.phone,
    }).catch((e) => {
      console.error('enrollInDrip:', e?.message);
      return { enrolled: false, contactId: null as string | null };
    });
    if (ghl.contactId) {
      await supabase
        .from('waitlist_leads')
        .update({ ghl_contact_id: ghl.contactId })
        .eq('id', lead.id);
    }
  };
  runInBackground('submitSignup sideEffects', sideEffects);

  // Double-opt-in: send the confirmation email once, only for a brand-new lead OR one that has
  // not yet confirmed. A returning-but-unconfirmed signup gets a fresh nudge instead of silence.
  // Absolute URL is built from the request host so preview + prod both work; falls back to prod.
  const alreadyConfirmed = (lead as { confirmed_at: string | null }).confirmed_at != null;
  if (!alreadyConfirmed) {
    const confirmToken = (lead as { confirm_token: string }).confirm_token;
    const origin = await requestOrigin();
    const confirmUrl = `${origin}/api/funnel/confirm?t=${encodeURIComponent(confirmToken)}`;
    // This one happened to win the race before, but "happened to" is not a guarantee: the whole
    // entry economy is gated on this email, so it gets the same protection as the rest.
    runInBackground('sendWaitlistConfirmation', () =>
      sendWaitlistConfirmation(parsed.email, parsed.locale, confirmUrl),
    );
  }

  return {
    leadId: lead.id as string,
    referralCode: (lead as { referral_code: string }).referral_code,
    entryCount,
    isNew,
  };
}

/** Build the public origin from the request headers with a safe production fallback. */
async function requestOrigin(): Promise<string> {
  try {
    const h = await headers();
    const proto = h.get('x-forwarded-proto') ?? 'https';
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (host) return `${proto}://${host}`;
  } catch {
    // headers() throws outside a request scope (e.g. eval, cron) — fall through to the prod default.
  }
  return 'https://www.teamthickandfit.com';
}

/**
 * Store a quiz response and credit +2 entries once. Idempotent on the lead — a re-submit updates
 * the response row (via unique(lead_id)) but never adds a second quiz entry.
 *
 * Also pushes the quiz signal to GHL as additive tags (goal:*, where:*, days:*, eats:*, lang:*,
 * quiz-done) so the drip's own behavior-triggered flows can select on "quiz completed" or "goal =
 * lose_fat" without needing our DB. GHL tags are additive on upsert; existing tags stay.
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

  // Push quiz signal to GHL. Best-effort, never blocks: GHL down must not fail the quiz response.
  const { data: leadRow } = await supabase
    .from('waitlist_leads')
    .select('email, first_name, last_name')
    .eq('id', parsed.leadId)
    .maybeSingle();
  const lead = leadRow as { email: string; first_name: string | null; last_name: string | null } | null;
  if (lead?.email) {
    const tags = [
      'quiz-done',
      ...parsed.goal.map((g) => `goal:${g}`),
      `where:${parsed.home_or_gym}`,
      `days:${parsed.days_per_week}`,
      `eats:${parsed.how_they_eat}`,
      `lang:${parsed.preferred_language ?? 'en'}`,
    ];
    tagContactInBackground(
      'submitQuiz upsertGhlContact',
      { email: lead.email, firstName: lead.first_name, lastName: lead.last_name },
      tags,
    );
  }

  const entryCount = await refreshEntryCount(parsed.leadId);
  return { entryCount, credited };
}

export type LeadStats = {
  entryCount: number;
  referralCount: number; // credited referrals so far (0..REFERRAL_CAP)
  referralCapRemaining: number;
  quizDone: boolean;
  confirmed: boolean; // double-opt-in state; drives the "check your email" banner on /join/thanks
  socialFollows: number;
  position: number | null; // rank by entry_count DESC across the tenant; null if unknown
  // The share code, read from the lead itself. The thank-you page used to depend on a `funnel_ref`
  // COOKIE for this and fell back to the unknown-lead page without it, which meant a browser that
  // had the lead but not the ref cookie lost the share link. Sourcing it here makes the cookie an
  // optimization rather than a requirement.
  referralCode: string;
};

/** Read the numbers the thank-you page renders. Called on every load, kept cheap. */
export async function getLeadStats(leadId: string): Promise<LeadStats | null> {
  const supabase = createServiceClient();
  const companyId = await resolveTenantId();
  const { data: lead } = await supabase
    .from('waitlist_leads')
    .select('id, entry_count, quiz_completed_at, confirmed_at, referral_code')
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
    confirmed: (lead as { confirmed_at: string | null }).confirmed_at != null,
    socialFollows: followCount ?? 0,
    position: aheadCount == null ? null : aheadCount + 1,
    referralCode: (lead as { referral_code: string }).referral_code,
  };
}

/**
 * Double-opt-in confirmation. Called from GET /api/funnel/confirm when a user clicks the emailed
 * confirm link. Flips confirmed_at (idempotent — a second click on the same link returns ok:true
 * silently) and pushes a `confirmed` GHL tag so GHL's audience filter can promote the lead from
 * the pre-confirmation holding audience into the live drip. Bad/unknown token returns ok:false;
 * the caller redirects to /join/thanks?confirmed=0 without leaking token validity.
 */
export async function confirmLeadByToken(
  token: string,
): Promise<{ ok: boolean; leadId: string | null }> {
  const supabase = createServiceClient();
  const companyId = await resolveTenantId();
  const { data, error } = await supabase
    .from('waitlist_leads')
    .update({ confirmed_at: new Date().toISOString() })
    .eq('company_id', companyId)
    .eq('confirm_token', token)
    .is('confirmed_at', null)
    .select('id, email, first_name, last_name');
  if (error) {
    console.error('funnel/service.confirmLeadByToken:', error.message);
    return { ok: false, leadId: null };
  }
  const rows = (data ?? []) as { id: string; email: string; first_name: string | null; last_name: string | null }[];
  if (rows.length === 0) {
    // Token already used OR unknown. Check the already-confirmed case so a legitimate re-click is friendly.
    const { data: existing } = await supabase
      .from('waitlist_leads')
      .select('id, confirmed_at')
      .eq('company_id', companyId)
      .eq('confirm_token', token)
      .maybeSingle<{ id: string; confirmed_at: string | null }>();
    const prior = existing as { id: string; confirmed_at: string | null } | null;
    // Return the id even on a re-click. The token still identifies the lead, and the caller uses it
    // to restore the funnel_lead cookie so a second click lands on a populated page, not the
    // unknown-lead fallback.
    return { ok: Boolean(prior?.confirmed_at), leadId: prior?.id ?? null };
  }
  const row = rows[0];
  tagContactInBackground(
    'confirmLeadByToken upsertGhlContact',
    { email: row.email, firstName: row.first_name, lastName: row.last_name },
    ['confirmed'],
  );
  return { ok: true, leadId: row.id };
}

/**
 * Post-conversion suppression. Called from the Stripe checkout.session.completed webhook when the
 * customer's email matches a waitlist lead. Flipping converted_at excludes them from EVERY drip
 * send in OUR filters (scheduled + triggered) — see the kb-funnels route-rule doctrine. Idempotent.
 *
 * Belt AND suspenders: also pushes a `converted` + `member` tag to GHL so GHL's own audience
 * filters (which we do not own) suppress the "doors close in 24 hours" broadcast to a buyer. That
 * mis-send is the highest-severity failure mode in the funnel. GHL update is best-effort — the
 * DB flag is the source of truth.
 */
export async function convertLead(email: string): Promise<{ found: boolean }> {
  const supabase = createServiceClient();
  const companyId = await resolveTenantId();
  const emailNormalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from('waitlist_leads')
    .update({ converted_at: new Date().toISOString() })
    .eq('company_id', companyId)
    .eq('email', emailNormalized)
    .is('converted_at', null)
    .select('id, first_name, last_name');
  if (error) {
    console.error('funnel/service.convertLead:', error.message);
    return { found: false };
  }
  const rows = (data ?? []) as { id: string; first_name: string | null; last_name: string | null }[];
  if (rows.length > 0) {
    const row = rows[0];
    tagContactInBackground(
      'convertLead upsertGhlContact',
      { email: emailNormalized, firstName: row.first_name, lastName: row.last_name },
      ['converted', 'member'],
    );
  }
  return { found: rows.length > 0 };
}
