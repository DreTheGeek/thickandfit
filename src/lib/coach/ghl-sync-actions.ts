'use server';

import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { logCoachAction } from '@/lib/coach/audit';
import { syncGhlPipelines, type SyncResult } from '@/lib/coach/ghl-sync';

/** In-app "Sync now" trigger for coaches. Runs the GHL -> Supabase pipeline sync. */
export async function runGhlSync(): Promise<SyncResult> {
  const ctx = await requireCoach();
  if (!ctx.companyId) {
    return { ok: false, pipelines: 0, stages: 0, opportunities: 0, linked: 0, unmatched: 0, error: 'no_company' };
  }
  const result = await syncGhlPipelines(ctx.companyId);
  const sb = createServiceClient();
  logCoachAction(sb, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'ghl_sync',
    action: 'run',
    newState: result,
  });
  void sb.from('cron_job_log').insert({
    job_name: 'ghl-sync-manual',
    status: result.ok ? 'success' : 'error',
    detail: result,
  });
  if (result.ok) {
    revalidatePath('/coach/leads');
    revalidatePath('/coach');
  }
  return result;
}
