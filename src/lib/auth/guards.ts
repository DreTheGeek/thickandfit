// Page-level auth guards (redirect on failure). For app pages, not API routes.
import 'server-only';
import { redirect } from 'next/navigation';
import { resolveAuth, hasRole, COACH_ROLES, APPROVER_ROLES, type AuthContext } from '@/lib/auth/session';
import { isEntitled, hasAckedHealth, pastDueOnly } from '@/lib/billing/entitlement';
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
    // NOT everyone who fails the gate needs the same screen. A member whose card declined is being
    // dunned on a subscription she still wants; sending her to checkout offers to sell her a second
    // one, and startCheckoutAction would have created it. She needs the card-update flow, and the
    // page needs to say why she is there rather than leaving her to guess.
    redirect((await pastDueOnly(ctx.userId)) ? '/account/billing?fix=card' : '/checkout');
  }
  // Health / assumption-of-risk disclaimer must be accepted before any training content.
  if (!(await hasAckedHealth(ctx.userId))) redirect('/disclaimer');
  return ctx;
}
