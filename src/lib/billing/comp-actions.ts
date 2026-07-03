'use server';
// Coach actions for comped access (time-boxed free entry: challenge winners, VIPs, make-goods).
// The entitlement backend (grantCompAccess/revokeCompAccess + isEntitled + expiry reminders) has
// existed since 0035; these actions are the missing UI-facing callers. Coach-guarded, company-scoped
// (never trust the client's profileId across tenants), audit-logged.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { grantCompAccess, revokeCompAccess } from '@/lib/billing/entitlement';
import { logCoachAction } from '@/lib/coach/audit';

export type CompResult = { ok: boolean; error?: string };

const GrantInput = z.object({
  profileId: z.string().uuid(),
  days: z.number().int().min(1).max(365),
});

// Verify the target profile belongs to the coach's company before touching entitlement.
async function assertSameCompany(profileId: string, companyId: string): Promise<{ prior: string | null } | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('profiles')
    .select('company_id, comp_access_until')
    .eq('id', profileId)
    .maybeSingle();
  const row = data as { company_id: string; comp_access_until: string | null } | null;
  if (!row || row.company_id !== companyId) return null;
  return { prior: row.comp_access_until };
}

export async function grantCompAction(input: unknown): Promise<CompResult> {
  const parsed = GrantInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const target = await assertSameCompany(parsed.data.profileId, ctx.companyId);
  if (!target) return { ok: false, error: 'not_found' };

  await grantCompAccess(parsed.data.profileId, parsed.data.days);
  logCoachAction(createServiceClient(), {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'profile',
    entityId: parsed.data.profileId,
    action: 'comp_access_granted',
    previousState: { comp_access_until: target.prior },
    newState: { days: parsed.data.days },
  });
  revalidatePath(`/coach/subscribers/${parsed.data.profileId}`);
  return { ok: true };
}

export async function revokeCompAction(profileId: unknown): Promise<CompResult> {
  const parsed = z.string().uuid().safeParse(profileId);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const target = await assertSameCompany(parsed.data, ctx.companyId);
  if (!target) return { ok: false, error: 'not_found' };

  await revokeCompAccess(parsed.data);
  logCoachAction(createServiceClient(), {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'profile',
    entityId: parsed.data,
    action: 'comp_access_revoked',
    previousState: { comp_access_until: target.prior },
    newState: { comp_access_until: null },
  });
  revalidatePath(`/coach/subscribers/${parsed.data}`);
  return { ok: true };
}
