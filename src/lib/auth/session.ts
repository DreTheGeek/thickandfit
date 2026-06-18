// Auth + role resolution. Works from either a cookie session (app routes) or a Bearer
// access token (API/tests). Roles come from the profile, gated by RLS/company scope.
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type Role = 'subscriber' | 'free' | 'coach' | 'assistant_coach' | 'operator';

export type AuthContext = { userId: string; companyId: string | null; role: Role };

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function resolveAuth(req?: Request): Promise<AuthContext | null> {
  const bearer = req?.headers.get('authorization') ?? '';
  const token = bearer.toLowerCase().startsWith('bearer ') ? bearer.slice(7).trim() : null;

  if (token) {
    const svc = createServiceClient();
    const {
      data: { user },
    } = await svc.auth.getUser(token);
    if (!user) return null;
    const { data: profile } = await svc
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .maybeSingle();
    return profile ? { userId: user.id, companyId: profile.company_id, role: profile.role as Role } : null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .maybeSingle();
  return profile ? { userId: user.id, companyId: profile.company_id, role: profile.role as Role } : null;
}

export function hasRole(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}

export const COACH_ROLES: Role[] = ['coach', 'assistant_coach', 'operator'];
