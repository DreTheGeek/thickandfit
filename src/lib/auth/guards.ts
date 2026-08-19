// Page-level auth guards (redirect on failure). For app pages, not API routes.
import 'server-only';
import { redirect } from 'next/navigation';
import { resolveAuth, hasRole, COACH_ROLES, APPROVER_ROLES, type AuthContext } from '@/lib/auth/session';
import { isEntitled, hasAckedHealth, pastDueOnly, isPaused } from '@/lib/billing/entitlement';
import { isStripeConfigured } from '@/lib/billing/stripe';

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await resolveAuth();
  if (!ctx) redirect('/auth/sign-in');
  return ctx;
}

export async function requireCoach(): Promise<AuthContext> {
  const ctx = await requireAuth();
  // Authed non-coaches belong in the app, not the marketing landing.
  if (!hasRole(ctx.role, COACH_ROLES)) redirect('/dashboard');
  return ctx;
}

// Operator-only surfaces (/admin: QA checklist, ops links). Coaches/assistants are redirected to
// their console so Stephanie's view never grows ops clutter; members go to the app.
export async function requireOperator(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (ctx.role !== 'operator') redirect(hasRole(ctx.role, COACH_ROLES) ? '/coach' : '/dashboard');
  return ctx;
}

// The mid-ticket "last-eyes" gate (PRD-30, WP8). requireCoach admits assistant_coach (COACH_ROLES
// includes it), so it CANNOT guard the approve / assignment paths: an assistant must never approve
// their own draft. requireApprover admits coach + operator ONLY. This is the single enforcement point
// that stands between an assistant's draft and a client; an assistant_coach is redirected to their own
// drafts inbox BEFORE any publish code runs. RLS is not the gate here (is_coach() includes assistant
// and the coach app uses the BYPASSRLS service client), so this server-side role check is the real one.
export async function requireApprover(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!hasRole(ctx.role, APPROVER_ROLES)) redirect('/coach/drafts');
  return ctx;
}

// Pay-to-enter gate (defense-in-depth alongside the app layout). Coaches pass by role; everyone else
// needs an active subscription or a live comp, else they are sent to checkout.
// CRITICAL: while Stripe is unconfigured (pre-launch), the paywall must NOT fire - checkout cannot
// complete, so gating on it dead-ended every new self-signup (onboarding -> /dashboard -> /checkout
// -> notConfigured, with no escape on any later login). Pay-to-enter re-activates automatically the
// moment the live STRIPE_SECRET_KEY lands; the health-disclaimer gate below applies either way.
export async function requireEntitled(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (hasRole(ctx.role, COACH_ROLES)) return ctx;
  if (isStripeConfigured() && !(await isEntitled(ctx.userId))) {
    // NOT everyone who fails the gate needs the same screen. Three different women land here and
    // each needs a different page; sending all of them to checkout is how a fixable problem and an
    // agreed break both turn into a cancellation.
    //
    //   paused    she asked for this break and is coming back on a date. Anything that looks like a
    //             paywall re-opens a decision she already made in our favour.
    //   past_due  her card declined on a subscription she still wants. Checkout would sell her a
    //             SECOND one, which startCheckoutAction would have happily created.
    //   otherwise she has never subscribed, and checkout is genuinely her screen.
    if ((await isPaused(ctx.userId)).paused) redirect('/paused');
    redirect((await pastDueOnly(ctx.userId)) ? '/account/billing?fix=card' : '/checkout');
  }
  // Health / assumption-of-risk disclaimer must be accepted before any training content.
  if (!(await hasAckedHealth(ctx.userId))) redirect('/disclaimer');
  return ctx;
}

/**
 * Training surfaces that keep their READ half during a pause.
 *
 * requireEntitled bounces a paused member to /paused, which is right for a page that is only the
 * program and wrong for /workouts, where the program shares a screen with her logged history. That
 * history is the most concrete "her stuff" this app holds, and the pause decision (2026-08-14) was
 * that she keeps all of it. /paused links to it; before this the link bounced her straight back to
 * /paused, which is the one thing a page listing what she keeps must not do.
 *
 * `onBreak` is returned rather than left for the caller to look up, so the page cannot forget to
 * ask and quietly serve a paused member the program half.
 *
 * Identical to requireEntitled except for that one branch — including the health-disclaimer gate,
 * which a paused member skips because nothing is prescribing her anything.
 */
export async function requireEntitledOrPaused(): Promise<AuthContext & { onBreak: boolean }> {
  const ctx = await requireAuth();
  if (hasRole(ctx.role, COACH_ROLES)) return { ...ctx, onBreak: false };
  if (isStripeConfigured() && !(await isEntitled(ctx.userId))) {
    if ((await isPaused(ctx.userId)).paused) return { ...ctx, onBreak: true };
    redirect((await pastDueOnly(ctx.userId)) ? '/account/billing?fix=card' : '/checkout');
  }
  if (!(await hasAckedHealth(ctx.userId))) redirect('/disclaimer');
  return { ...ctx, onBreak: false };
}

/**
 * Her own records, reachable during a pause.
 *
 * The decision (2026-08-14): a paused member keeps everything of her own and can reach nothing else.
 * requireEntitled is the wrong guard for those screens — it would bounce her to /paused when the
 * whole point is that her history is still hers — and requireAuth is too loose, because it would
 * also admit a lapsed member who never paused.
 *
 * Use on: her progress, her history, her messages, her account. NOT on training, the AI coach, or
 * anything that costs money to serve. A pause stops the coaching, not the record of it.
 */
export async function requireAuthOrPaused(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (hasRole(ctx.role, COACH_ROLES)) return ctx;
  if (!isStripeConfigured()) return ctx;
  if (await isEntitled(ctx.userId)) return ctx;
  if ((await isPaused(ctx.userId)).paused) return ctx;
  // Not entitled and not paused: same three-way routing as requireEntitled, so a declined card does
  // not get sent to checkout from here either.
  redirect((await pastDueOnly(ctx.userId)) ? '/account/billing?fix=card' : '/checkout');
}
