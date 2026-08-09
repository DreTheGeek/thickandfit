'use server';
// Writes for the two coach settings screens.
//
// Coach-gated (requireCoach admits coach, assistant coach and operator) and Zod-validated on the way
// in, because a server action is a public HTTP endpoint no matter how private the page that calls it
// looks. The whole object is sent and the whole object is written: see the note on coachSettingsSchema
// for why a partial patch is refused rather than merged.
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { logCoachAction } from '@/lib/coach/audit';
import {
  coachSettingsFromRow,
  coachSettingsSchema,
  coachSettingsToRow,
} from '@/lib/coach/settings-shared';

export type SaveCoachSettingsResult = { ok: true } | { ok: false; error: 'invalid' | 'noCompany' | 'failed' };

/**
 * Save the whole settings object for the coach's company.
 *
 * Upsert rather than update: 0115 seeds a row per existing company, but a company created after this
 * migration by a path that does not know about settings would otherwise have nowhere to write, and
 * "Save changes" would report success against zero rows.
 */
export async function saveCoachSettingsAction(input: unknown): Promise<SaveCoachSettingsResult> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'noCompany' };

  const parsed = coachSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const svc = createServiceClient();
  const { data: before } = await svc
    .from('coach_settings')
    .select('*')
    .eq('company_id', ctx.companyId)
    .maybeSingle();

  const { error } = await svc.from('coach_settings').upsert(
    {
      company_id: ctx.companyId,
      ...coachSettingsToRow(parsed.data),
      updated_by: ctx.userId,
    },
    { onConflict: 'company_id' },
  );
  if (error) {
    // Sanitized: the caller gets a code, the detail stays in the server log.
    console.error('saveCoachSettingsAction:', error.message);
    return { ok: false, error: 'failed' };
  }

  logCoachAction(svc, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'coach_settings',
    entityId: ctx.companyId,
    action: 'update',
    previousState: before ? coachSettingsFromRow(before as Record<string, unknown>) : null,
    newState: parsed.data,
  });

  // These settings change what MEMBERS see, not only what the coach sees, so the member surfaces
  // that read them have to drop their cached render too.
  for (const path of ['/coach/settings/client-app', '/coach/settings/coaching', '/checkin', '/progress', '/nutrition']) {
    revalidatePath(path);
  }
  return { ok: true };
}

export type ClearFollowUpsResult = { ok: true } | { ok: false; error: 'noCompany' | 'failed' };

/**
 * Danger zone: drop every follow-up reminder the coach has configured.
 *
 * Scoped honestly. Follow-ups are CONFIGURED here and nothing in the app schedules one yet, so this
 * clears the two reminder settings and that is the whole of it. It is still destructive and still
 * irreversible from the UI, which is why it sits behind a confirmation and writes an audit row.
 */
export async function clearFollowUpsAction(): Promise<ClearFollowUpsResult> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'noCompany' };

  const svc = createServiceClient();
  const { error } = await svc
    .from('coach_settings')
    .update({ meal_plan_followup: 'none', training_followup: 'none', updated_by: ctx.userId })
    .eq('company_id', ctx.companyId);
  if (error) {
    console.error('clearFollowUpsAction:', error.message);
    return { ok: false, error: 'failed' };
  }

  logCoachAction(svc, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'coach_settings',
    entityId: ctx.companyId,
    action: 'clear_follow_ups',
    newState: { meal_plan_followup: 'none', training_followup: 'none' },
  });

  revalidatePath('/coach/settings/coaching');
  return { ok: true };
}
