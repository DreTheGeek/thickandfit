'use server';
// Write, switch on, and delete a seasonal campaign.
//
// The only path that can arm a message to a whole cohort, so both the validation and the audit
// entries are deliberately thorough. See season-shared.ts for the window arithmetic and
// generators.ts for what actually sends.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { logCoachAction } from '@/lib/coach/audit';
import { CAMPAIGN_AUDIENCES, isMonthDay } from '@/lib/campaigns/season-shared';

export type CampaignResult = { ok: true } | { ok: false; error: string };

const MD = z.string().refine(isMonthDay, 'monthDay');

const CampaignInput = z.object({
  id: z.string().uuid().optional(),
  // Lowercase and dashes only: it is a dedupe key that lives in a URL, and renaming one makes it a
  // NEW campaign that everybody receives again.
  key: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(120),
  startsMd: MD,
  endsMd: MD,
  audience: z.enum(CAMPAIGN_AUDIENCES as [string, ...string[]]),
  minTenureDays: z.number().int().min(0).max(365),
  titleEn: z.string().min(1).max(120),
  bodyEn: z.string().min(1).max(600),
  titleEs: z.string().min(1).max(120),
  bodyEs: z.string().min(1).max(600),
  link: z.string().startsWith('/').max(200),
});

/**
 * Create or update a campaign. Always saved INACTIVE-safe: this never flips is_active.
 *
 * Writing and arming are separate calls on purpose. Somebody drafting December copy in October
 * should not be one mistyped field away from sending it, and an edit to a live campaign should not
 * silently re-arm one that was deliberately switched off.
 */
export async function saveCampaignAction(input: unknown): Promise<CampaignResult> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'noCompany' };
  const parsed = CampaignInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const c = parsed.data;

  const svc = createServiceClient();
  const row = {
    company_id: ctx.companyId,
    key: c.key,
    title: c.title,
    starts_md: c.startsMd,
    ends_md: c.endsMd,
    audience: c.audience,
    min_tenure_days: c.minTenureDays,
    title_en: c.titleEn,
    body_en: c.bodyEn,
    title_es: c.titleEs,
    body_es: c.bodyEs,
    link: c.link,
    created_by: ctx.userId,
  };

  const { error } = c.id
    ? await svc.from('seasonal_campaigns').update(row).eq('id', c.id).eq('company_id', ctx.companyId)
    : await svc.from('seasonal_campaigns').insert(row);
  if (error) {
    console.error('saveCampaignAction:', error.message);
    // The unique (company_id, key) constraint is the likely one, and "that name is taken" is a
    // fixable message where "failed" is not.
    return { ok: false, error: error.code === '23505' ? 'keyTaken' : 'failed' };
  }

  logCoachAction(svc, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'seasonal_campaign',
    entityId: c.id ?? c.key,
    action: c.id ? 'campaign.update' : 'campaign.create',
    newState: { key: c.key, startsMd: c.startsMd, endsMd: c.endsMd, audience: c.audience },
  });

  revalidatePath('/coach/campaigns');
  return { ok: true };
}

const ArmInput = z.object({ id: z.string().uuid(), isActive: z.boolean() });

/**
 * Arm or disarm a campaign. Its own action, and its own audit line.
 *
 * This is the switch that decides whether 256 women get a message, so it is one deliberate act with
 * one entry in the log rather than a field buried in a form somebody was editing for another reason.
 */
export async function setCampaignActiveAction(input: unknown): Promise<CampaignResult> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'noCompany' };
  const parsed = ArmInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const svc = createServiceClient();
  const { error } = await svc
    .from('seasonal_campaigns')
    .update({ is_active: parsed.data.isActive })
    .eq('id', parsed.data.id)
    .eq('company_id', ctx.companyId);
  if (error) {
    console.error('setCampaignActiveAction:', error.message);
    return { ok: false, error: 'failed' };
  }

  logCoachAction(svc, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'seasonal_campaign',
    entityId: parsed.data.id,
    action: parsed.data.isActive ? 'campaign.arm' : 'campaign.disarm',
    newState: { isActive: parsed.data.isActive },
  });

  revalidatePath('/coach/campaigns');
  return { ok: true };
}

const DeleteInput = z.object({ id: z.string().uuid() });

/**
 * Delete a campaign.
 *
 * The notifications it already sent stay: they are part of a member's record, and they carry the
 * campaign key in the link, so deleting the row does not orphan anything or resend anything. It DOES
 * mean re-creating a campaign with the same key skips everybody who already received this year's —
 * which is the right answer, since the dedupe is about what she was sent, not about what exists.
 */
export async function deleteCampaignAction(input: unknown): Promise<CampaignResult> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'noCompany' };
  const parsed = DeleteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const svc = createServiceClient();
  const { error } = await svc
    .from('seasonal_campaigns')
    .delete()
    .eq('id', parsed.data.id)
    .eq('company_id', ctx.companyId);
  if (error) {
    console.error('deleteCampaignAction:', error.message);
    return { ok: false, error: 'failed' };
  }

  logCoachAction(svc, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'seasonal_campaign',
    entityId: parsed.data.id,
    action: 'campaign.delete',
    newState: { deleted: true },
  });

  revalidatePath('/coach/campaigns');
  return { ok: true };
}
