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
  // CSRF defense-in-depth: reject a cookie-credentialed mutating request whose Origin does not match
  // the Host. Bearer/API clients are server-to-server and send no Origin, so they pass; GET/HEAD and
  // same-origin app fetches pass. SameSite=Lax cookies + the JSON content-type are the primary guards.
  if (req && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.get('origin');
    if (origin) {
      const host = req.headers.get('host');
      try {
        if (!host || new URL(origin).host !== host) return null;
      } catch {
        return null;
      }
    }
  }

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
  let { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) {
    // The user is authenticated (getUser verified the JWT). If the user-client profile read missed
    // (transient RLS/replication lag), fall back to the service client so a valid session is not
    // bounced to sign-in. This is the login-bounce class of bug; reading one's own profile is safe.
    ({ data: profile } = await createServiceClient()
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .maybeSingle());
  }
  return profile ? { userId: user.id, companyId: profile.company_id, role: profile.role as Role } : null;
}

export function hasRole(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}

export const COACH_ROLES: Role[] = ['coach', 'assistant_coach', 'operator'];

// The approval / assignment authority: coach + operator ONLY, EXCLUDING assistant_coach. This is the
// app-layer reflection of the is_approver() SQL helper (0041). An assistant_coach may DRAFT but never
// APPROVE their own work, so the mid-ticket "last-eyes" gate must check this set, not COACH_ROLES.
export const APPROVER_ROLES: Role[] = ['coach', 'operator'];

// Where to send a freshly-authenticated user. Coaches/operators go to the app home;
// subscribers/free go to onboarding until they've completed it, then the dashboard.
// NEVER returns '/' (the marketing landing): an authed user should land in the app.
export async function homePathForUser(userId: string, role: Role): Promise<string> {
  // Operators run the QA/ops portal, not Stephanie's coaching console: land them on /admin.
  if (role === 'operator') return '/admin';
  if (COACH_ROLES.includes(role)) return '/coach';
  const svc = createServiceClient();
  const { data } = await svc
    .from('onboarding_responses')
    .select('profile_id')
    .eq('profile_id', userId)
    .maybeSingle();
  return data ? '/dashboard' : '/onboarding';
}
