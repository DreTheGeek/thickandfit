import 'server-only';
// K3 batch materializer: sweep every subscriber and refresh their user_state row. Called nightly
// by tf-materialize-user-state-nightly (30 min after the insights cron). Idempotent — upserts on
// (company_id, profile_id), so re-running the same day just replaces the snapshot with fresh numbers.
//
// Never throws at the batch level: one bad member cannot fail the whole run. Errors are tallied
// and returned so cron_job_log carries the counts for launchproof/observability.
import { createServiceClient } from '@/lib/supabase/service';
import { computeUserState } from '@/lib/user-state/compute';

export type MaterializeResult = {
  ok: boolean;
  total: number;
  written: number;
  skipped: number; // no-onboarding
  errors: number;
  ranAtIso: string;
};

async function listSubscriberProfiles(): Promise<{ id: string; company_id: string }[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('profiles')
    .select('id, company_id')
    .eq('role', 'subscriber');
  return ((data ?? []) as { id: string; company_id: string }[]).filter((p) => p.company_id);
}

export async function materializeAllUserStates(): Promise<MaterializeResult> {
  const ranAtIso = new Date().toISOString();
  const profiles = await listSubscriberProfiles();
  let written = 0;
  let skipped = 0;
  let errors = 0;

  for (const p of profiles) {
    try {
      const r = await computeUserState(p.id, p.company_id);
      if (r.status === 'ok') written += 1;
      else if (r.status === 'noOnboarding') skipped += 1;
      else errors += 1;
    } catch (e) {
      errors += 1;
      console.error('materializeAllUserStates member', p.id, e instanceof Error ? e.message : e);
    }
  }

  return { ok: errors === 0, total: profiles.length, written, skipped, errors, ranAtIso };
}
