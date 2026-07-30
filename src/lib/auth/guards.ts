// Page-level auth guards (redirect on failure). For app pages, not API routes.
import 'server-only';
import { redirect } from 'next/navigation';
import {
  resolveAuth,
  hasRole,
  homePathForUser,
  COACH_ROLES,
  APPROVER_ROLES,
  MEMBER_ROLES,
  type AuthContext,
} from '@/lib/auth/session';
import { isEntitled, hasAckedHealth } from '@/lib/billing/entitlement';
import { isStripeConfigured } from '@/lib/billing/stripe';

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await resolveAuth();
  if (!ctx) redirect('/auth/sign-in');
  return ctx;
}

/**
 * Member-only surfaces (onboarding, and anything that writes a member's health/goal data).
 *
 * Nothing ROUTES staff here: homePathForUser sends operators to /admin and coaches to /coach before
 * it ever looks at onboarding. But the page was guarded by requireAuth alone, so a bookmark or a
 * pasted link dropped a coach into the member wizard, which would ask her for her body fat and PAR-Q
 * answers and write a member health profile onto a staff account. The intent was already visible in
 * the submit route (the CRM contact was gated on these two roles); this makes the rest match.
 *
 * Sends staff to their own console rather than 404ing: they are not doing anything wrong, they are
 * just in the wrong place.
 */
export async function requireMember(): Promise<AuthContext> {
  const ctx = await requireAuth();
  // homePathForUser is the single source of truth for where a role belongs. Re-deriving it here
  // would be a second copy to keep in sync, and it already returns /admin for operators and /coach
  // for coach roles without touching onboarding_responses for either.
  if (!hasRole(ctx.role, MEMBER_ROLES)) redirect(await homePathForUser(ctx.userId, ctx.role));
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
  if (isStripeConfigured() && !(await isEntitled(ctx.userId))) redirect('/checkout');
  // Health / assumption-of-risk disclaimer must be accepted before any training content.
  if (!(await hasAckedHealth(ctx.userId))) redirect('/disclaimer');
  return ctx;
}
