'use server';
// Admin-portal access actions: the passcode gate + operator grants + teammate provisioning (so Dre
// can create coach / assistant / operator accounts himself instead of needing a DB console).
// Internal ops tool, English-only by design.
import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { requireOperator } from '@/lib/auth/guards';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyAndSetAdminGate } from '@/lib/admin/passcode';
import { logCoachAction } from '@/lib/coach/audit';
import { TEAMMATE_ROLES } from '@/lib/admin/access-types';
import type { AccessResult, InviteResult } from '@/lib/admin/access-types';

const inviteSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(TEAMMATE_ROLES),
  fullName: z.string().trim().min(1).max(80),
});

// Create (or re-assert) a teammate account and email them a branded set-password link. Idempotent:
// an existing account in this company gets its role re-asserted and a fresh link re-sent rather than
// a duplicate. The person sets their OWN password from the email; the operator never sees it.
export async function inviteTeammateAction(input: unknown): Promise<InviteResult> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireOperator();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  if (!(await checkRateLimit(ctx.userId, 'admin-invite', 20, 3600, { failClosed: true }))) {
    return { ok: false, error: 'rate_limited' };
  }

  const { email, role, fullName } = parsed.data;
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(' ') || firstName;
  const svc = createServiceClient();

  // Existing account in THIS company? (idempotent re-invite)
  const { data: existing } = await svc
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .eq('company_id', ctx.companyId)
    .maybeSingle();

  let userId = (existing as { id: string } | null)?.id ?? null;
  const status: 'created' | 'updated' = userId ? 'updated' : 'created';

  if (!userId) {
    // Pre-confirm the email so there is no separate confirmation step: the set-password link below
    // is the only action the teammate needs to take.
    const { data: created, error: cErr } = await svc.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName, first_name: firstName, last_name: lastName },
    });
    if (cErr || !created?.user) {
      // Most common cause: the email already exists (possibly in another tenant / as a member).
      console.error('inviteTeammateAction createUser:', cErr?.message);
      return { ok: false, error: 'exists_or_failed' };
    }
    userId = created.user.id;
    // The on_auth_user_created trigger writes the profile row; give it a beat before we update it.
    await new Promise((r) => setTimeout(r, 1200));
  }

  const { error: upErr } = await svc
    .from('profiles')
    .update({ role, full_name: fullName, company_id: ctx.companyId })
    .eq('id', userId);
  if (upErr) {
    console.error('inviteTeammateAction profile:', upErr.message);
    return { ok: false, error: 'failed' };
  }

  // Branded set-password (recovery) email via SMTP. Anon client; the redirect lands the teammate on
  // /auth/reset-password to choose a password, then routes them by role (coach -> /coach etc.).
  // Origin from the request host so the link auto-adapts to the live domain at cutover.
  const h = await headers();
  const origin = h.get('origin') ?? `https://${h.get('host') ?? 'app.teamthickandfit.com'}`;
  const anon = createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { error: mailErr } = await anon.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
  });
  if (mailErr) {
    console.error('inviteTeammateAction email:', mailErr.message);
    return { ok: false, error: 'email_failed' };
  }

  logCoachAction(svc, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'profile',
    entityId: userId,
    action: 'admin.invite_teammate',
    newState: { email, role, status },
  });
  revalidatePath('/admin/team');
  return { ok: true, status };
}

const removeSchema = z.string().uuid();

// Remove a teammate: delete their account so they lose console access and their email frees up for a
// clean re-invite. Guarded hard, because this is destructive: operators only, same company, staff
// roles only, never yourself (self-lockout), and never the last operator (would lock everyone out of
// /admin). Deleting the auth user cascades the profile row; the explicit profile delete is a
// belt-and-suspenders no-op if the cascade already fired.
export async function removeTeammateAction(input: unknown): Promise<AccessResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireOperator();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const targetId = parsed.data;
  if (targetId === ctx.userId) return { ok: false, error: 'self' };

  const svc = createServiceClient();
  const { data: prof } = await svc
    .from('profiles')
    .select('id, role, email, company_id')
    .eq('id', targetId)
    .maybeSingle();
  const p = prof as { id: string; role: string; email: string | null; company_id: string | null } | null;
  // Scope to this company AND staff roles only, so this can never touch a member or another tenant.
  if (!p || p.company_id !== ctx.companyId) return { ok: false, error: 'not_found' };
  if (!(TEAMMATE_ROLES as readonly string[]).includes(p.role)) return { ok: false, error: 'not_staff' };

  if (p.role === 'operator') {
    const { count } = await svc
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', ctx.companyId)
      .eq('role', 'operator');
    if ((count ?? 0) <= 1) return { ok: false, error: 'last_operator' };
  }

  const { error: delErr } = await svc.auth.admin.deleteUser(targetId);
  if (delErr) {
    console.error('removeTeammateAction deleteUser:', delErr.message);
    return { ok: false, error: 'failed' };
  }
  await svc.from('profiles').delete().eq('id', targetId);

  logCoachAction(svc, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'profile',
    entityId: targetId,
    action: 'admin.remove_teammate',
    newState: { email: p.email, role: p.role },
  });
  revalidatePath('/admin/team');
  return { ok: true };
}

// Passcode entry. Rate-limited hard (it is a shared secret) and only reachable by operators anyway.
export async function enterAdminPasscodeAction(input: unknown): Promise<AccessResult> {
  const parsed = z.string().min(1).max(200).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'empty' };
  const ctx = await requireOperator();
  const allowed = await checkRateLimit(ctx.userId, 'admin-passcode', 10, 300, { failClosed: true });
  if (!allowed) return { ok: false, error: 'rate_limited' };
  const ok = await verifyAndSetAdminGate(parsed.data);
  if (!ok) return { ok: false, error: 'wrong' };
  revalidatePath('/admin');
  return { ok: true };
}

// Promote an existing account (by email) to operator so a teammate can reach /admin.
export async function grantOperatorAction(input: unknown): Promise<AccessResult> {
  const parsed = z.string().trim().email().safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_email' };
  const ctx = await requireOperator();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const svc = createServiceClient();
  // Find the auth user by email, then their profile in this company.
  const { data: prof } = await svc
    .from('profiles')
    .select('id, role, email')
    .ilike('email', parsed.data)
    .eq('company_id', ctx.companyId)
    .maybeSingle();
  if (!prof) return { ok: false, error: 'not_found' };
  const p = prof as { id: string; role: string };
  if (p.role === 'operator') return { ok: true };
  const { error } = await svc.from('profiles').update({ role: 'operator' }).eq('id', p.id);
  if (error) {
    console.error('grantOperatorAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  logCoachAction(svc, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'profile',
    entityId: p.id,
    action: 'admin.grant_operator',
    newState: { role: 'operator', email: parsed.data },
  });
  revalidatePath('/admin');
  return { ok: true };
}
