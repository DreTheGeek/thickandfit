// Page-level auth guards (redirect on failure). For app pages, not API routes.
import 'server-only';
import { redirect } from 'next/navigation';
import { resolveAuth, hasRole, COACH_ROLES, type AuthContext } from '@/lib/auth/session';
import { isEntitled } from '@/lib/billing/entitlement';

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

// Pay-to-enter gate (defense-in-depth alongside the app layout). Coaches pass by role; everyone else
// needs an active subscription or a live comp, else they are sent to checkout.
export async function requireEntitled(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (hasRole(ctx.role, COACH_ROLES)) return ctx;
  if (await isEntitled(ctx.userId)) return ctx;
  redirect('/checkout');
}
