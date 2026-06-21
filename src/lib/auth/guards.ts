// Page-level auth guards (redirect on failure). For app pages, not API routes.
import 'server-only';
import { redirect } from 'next/navigation';
import { resolveAuth, hasRole, COACH_ROLES, type AuthContext } from '@/lib/auth/session';

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
