'use server';
// Admin-portal access actions: the passcode gate + operator grants (so Dre can add his QA teammates
// himself instead of needing a DB console). Internal ops tool, English-only by design.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOperator } from '@/lib/auth/guards';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyAndSetAdminGate } from '@/lib/admin/passcode';
import { logCoachAction } from '@/lib/coach/audit';

export type AccessResult = { ok: boolean; error?: string };

// Passcode entry. Rate-limited hard (it is a shared secret) and only reachable by operators anyway.
export async function enterAdminPasscodeAction(input: unknown): Promise<AccessResult> {
  const parsed = z.string().min(1).max(200).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'empty' };
  const ctx = await requireOperator();
  const allowed = await checkRateLimit(ctx.userId, 'admin-passcode', 10, 300);
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
