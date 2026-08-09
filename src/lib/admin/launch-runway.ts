import 'server-only';
// Launch runway data — the one place a real ops team looks at "what's left before Aug 4 / doors open in October."
// Static const list rather than a DB table because launch-time tools should be easy to update via
// a single commit + code review, not require an admin UI. When the launch is behind us, this file
// gets moved to .planning/archive and the page redirects to /admin.
//
// Update rules:
//   - status:  'done' | 'in_progress' | 'blocked' | 'pending'
//   - When a task ships, flip status to 'done' + add commit sha to notes.
//   - When a task is blocked on a specific external action, put owner=the-person + notes=action.
//   - Add new blockers with an id that will not collide with existing (`aug4-*`, `doors-*`).
//
// Sources of truth this pulls from:
//   - Aug 4 blockers: workflow w27o73vjo (pages-auth-launch-scope) + kb-funnels doctrine
//   - Doors-open blockers: 2026-07-23 call decisions + call-2026-07-01 tier structure
//   - Ops long-poles: launch-runbook + STATE.md pending work

export type BlockerStatus = 'done' | 'in_progress' | 'blocked' | 'pending';
export type BlockerOwner = 'LaSean' | 'Rodney' | 'Shakira' | 'Stephanie' | 'vendor' | 'legal';
export type BlockerMilestone = 'aug4' | 'doors' | 'ongoing';

export type Blocker = {
  id: string;
  title: string;
  milestone: BlockerMilestone;
  owner: BlockerOwner;
  status: BlockerStatus;
  detail: string;
  notes?: string;
};

export const BLOCKERS: readonly Blocker[] = [
  // ═══════════════════════════════════════ AUG 4 — waitlist opens ═══════════════════════════════════════
  {
    id: 'aug4-google-oauth',
    title: 'Google OAuth button either wired or hidden',
    milestone: 'aug4',
    owner: 'LaSean',
    status: 'done',
    detail: 'Env-gated on NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED. Currently hidden. Flip env to "true" AFTER wiring provider in Supabase.',
    notes: 'commit 8aa4131',
  },
  {
    id: 'aug4-disclaimer-public',
    title: '/disclaimer publicly reachable',
    milestone: 'aug4',
    owner: 'LaSean',
    status: 'done',
    detail: 'Moved out of (app) route group. Public read + Sign-up CTA; authed users still get Accept form.',
    notes: 'commit 8aa4131',
  },
  {
    id: 'aug4-turnstile',
    title: 'Turnstile bot defense on /api/funnel/signup',
    milestone: 'aug4',
    owner: 'LaSean',
    // COMPUTED, not asserted. This read 'done' because the CODE shipped, while the control itself was
    // inert: verifyTurnstileToken lazy-gates on TURNSTILE_SECRET_KEY and skips silently when unset, so
    // the board claimed bot defense was live while the signup endpoint had none. A security control
    // reported as active while inactive is worse than one honestly marked pending, so this one asks
    // the environment instead of trusting a hand-edited string.
    status: process.env.TURNSTILE_SECRET_KEY ? 'done' : 'pending',
    detail:
      'Server-side verify + client widget, lazy-gated on TURNSTILE_SECRET_KEY. Until that secret is in Vercel prod the verify SKIPS and the only guard on signup is the 5/min IP limit.',
    notes: 'commit 8aa4131 (code). Arms itself the moment the secret lands.',
  },
  {
    id: 'aug4-double-opt-in',
    title: 'Waitlist double-opt-in confirmation email + /api/funnel/confirm',
    milestone: 'aug4',
    owner: 'LaSean',
    status: 'done',
    detail: 'Migration 0092 (confirm_token), branded email, callback route with idempotent verify. E2E-tested live (4/4 assertions).',
    notes: 'commit 4399914',
  },
  {
    id: 'aug4-resend-dns',
    title: 'Resend teamthickandfit.com domain verify + SPF/DKIM/DMARC',
    milestone: 'aug4',
    owner: 'LaSean',
    status: 'done',
    detail: 'Composio Resend connect link awaiting click. Once connected: register domain, fetch DNS records, publish at DNS provider, verify.',
    notes: 'Domain teamthickandfit.com verified 2026-07-30. Confirmation, support and recap mail all observed delivering 2026-08-01. DMARC on _dmarc still outstanding.',
  },
  {
    id: 'aug4-ghl-workflow',
    title: 'GHL waitlist workflow built + GHL_WAITLIST_WORKFLOW_ID in Vercel prod',
    milestone: 'aug4',
    owner: 'Rodney',
    status: 'blocked',
    detail: 'Build the 14-email + 8-text drip workflow in Stephanie\'s GHL location. Paste the workflow ID and LaSean adds the env var.',
    notes: 'Composio\'s HighLevel toolkit only exposes trigger-link tools, not workflow creation — manual build in GHL UI required.',
  },
  {
    id: 'aug4-twilio-10dlc',
    title: 'Twilio 10DLC brand + campaign registration (1-4 wk vetting)',
    milestone: 'aug4',
    owner: 'Rodney',
    status: 'blocked',
    detail: 'Submit brand + campaign at console.twilio.com → Messaging → Regulatory Compliance. Start THIS WEEK or SMS drip does not exist.',
    notes: 'No Composio path — manual submission.',
  },
  {
    id: 'aug4-sentry-posthog',
    title: 'Sentry DSN + PostHog key in Vercel prod',
    milestone: 'aug4',
    owner: 'LaSean',
    status: 'blocked',
    detail: 'Composio Sentry connect link awaiting click. Once connected: auto-create project, fetch DSN, push to Vercel prod, redeploy.',
    notes: 'Zero prod observability today — launch-day errors get swallowed silently.',
  },

  // ═══════════════════════════════════════ SEPT 27 — doors open ═══════════════════════════════════════
  {
    id: 'doors-stripe-live',
    title: 'Stripe live keys + STRIPE_PRICE_SELF/TEAM/STEPH + webhook secret',
    milestone: 'doors',
    owner: 'Stephanie',
    status: 'blocked',
    detail: 'Blocked on Stripe identity verification (forward Stripe email to lasean@kaldrbusiness.com; entity Thick Fit Coaching LLC). Paywall auto-arms the moment STRIPE_SECRET_KEY lands.',
  },
  {
    id: 'doors-founding-window',
    title: 'A2 5-day founding-window pricing logic ($19.97 → $24.97)',
    milestone: 'doors',
    owner: 'LaSean',
    status: 'pending',
    detail: 'Two Stripe prices + window-close date logic in priceForTier(). Waitlist gets first 24h at founding; public gets remaining 4 days; then price flips.',
  },
  {
    id: 'doors-mux-env',
    title: 'Mux tokens/secret/webhook/signing-key in Vercel prod',
    milestone: 'doors',
    owner: 'LaSean',
    status: 'blocked',
    detail: 'Workout demo playback + signed URLs cannot function without these. Core paid product value.',
  },
  {
    id: 'doors-legacy-reconcile',
    title: 'Legacy Lenus subscribers pre-paywall reconcile (~256 rows)',
    milestone: 'doors',
    owner: 'LaSean',
    status: 'pending',
    detail: 'client_subscriptions has ~256 imported rows with no native Stripe sub → all get paywalled when Stripe arms. Comp-grant them OR UNION the tables BEFORE flipping Stripe live.',
    notes: 'Blocks Stephanie\'s existing client base.',
  },
  {
    id: 'doors-stephanie-content',
    title: 'Stephanie content long-pole: AI KB, demo videos, recipes, offer blueprint',
    milestone: 'doors',
    owner: 'Stephanie',
    status: 'blocked',
    detail: 'AI Knowledge Base (blocks /coach-chat quality — Gap Log #5), 369 demo videos, approved recipe/exercise lists, offer blueprint.',
  },
  {
    id: 'doors-onboarding-split',
    title: 'D: onboarding pre/post-paywall split',
    milestone: 'doors',
    owner: 'LaSean',
    status: 'done',
    notes: 'Walked end to end on prod 2026-08-01.',
    detail: 'Per 2026-07-23 call: name/email/phone/goals stay pre-paywall; weight/pictures/body-fat move post-paywall so we do not waste tokens on non-converters.',
  },
  {
    id: 'doors-storytelling-video',
    title: 'AI childhood storytelling video (viral launch asset)',
    milestone: 'doors',
    owner: 'Stephanie',
    status: 'pending',
    detail: 'Comment-to-DM ("Comment THICK") → waitlist. Central promo per waitlist campaign plan Part Two.',
  },
  {
    id: 'doors-past-clients',
    title: 'Past-client cleanup + segmentation (5 groups)',
    milestone: 'doors',
    owner: 'Stephanie',
    status: 'pending',
    detail: 'Rodney sends the churn list; Stephanie marks who is actually active/free/off-platform/bootcamp; Shakira segments + drafts reactivation.',
    notes: 'Fastest revenue in the campaign — 200-300 reactivations at $19.97/mo.',
  },

  // ═══════════════════════════════════════ ONGOING / OPS HYGIENE ═══════════════════════════════════════
  {
    id: 'ongoing-vercel-pro',
    title: 'Confirm Vercel plan = Pro (not Hobby)',
    milestone: 'ongoing',
    owner: 'LaSean',
    status: 'pending',
    detail: 'Hobby caps pg_cron at 1/day and froze prod once before. Confirm Pro before doors open.',
  },
  {
    id: 'ongoing-refund-cookies',
    title: 'Public /refund-policy + /cookies pages',
    milestone: 'ongoing',
    owner: 'LaSean',
    status: 'pending',
    detail: 'Chargeback defense + GDPR notice-at-collection. Foundation stayed no-refund on $19.97; mid-ticket has conditional 30-day check-in guarantee.',
  },
  {
    id: 'ongoing-community-mod',
    title: 'Community moderation queue (/admin/community/reports)',
    milestone: 'ongoing',
    owner: 'LaSean',
    status: 'done',
    notes: '/admin/community/reports is live.',
    detail: 'Launch-day risk: one bad post + no admin queue means it lives until Stephanie sees it manually.',
  },
];

export type BlockerCounts = {
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
  pending: number;
  pct: number;
};

/**
 * Whole-number days from now until an ISO instant, floored at 0. Lives here rather than in the page
 * because Date.now() is impure and a React render body must stay pure (Path A rule: never call
 * Date.now() / new Date() in a render). Server modules are the right home for clock reads.
 */
export function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** Roll up blocker status for one milestone bucket. */
export function countByMilestone(milestone: BlockerMilestone): BlockerCounts {
  const bucket = BLOCKERS.filter((b) => b.milestone === milestone);
  const total = bucket.length;
  const done = bucket.filter((b) => b.status === 'done').length;
  const inProgress = bucket.filter((b) => b.status === 'in_progress').length;
  const blocked = bucket.filter((b) => b.status === 'blocked').length;
  const pending = bucket.filter((b) => b.status === 'pending').length;
  return { total, done, inProgress, blocked, pending, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}
