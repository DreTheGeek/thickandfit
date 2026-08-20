// Subscriber progress screen (PRD-24). Three tabs: Gallery (own photos), Body (weight trend,
// weekly recap, measurements), Compare (before/after). Coaches see imported Lenus photos in the
// client Files tab separately.
import type { ReactElement } from 'react';
import { requireAuthOrPaused } from '@/lib/auth/guards';
import { listPhotosAction } from '@/lib/progress-photos/actions';
import { getLegacySnapshot } from '@/lib/legacy/snapshot';
import { getBodyStats } from '@/lib/body/stats';
import { getProfileTimezone } from '@/lib/datetime/profile-timezone';
import { ProgressPhotosScreen, type Tab } from '@/components/progress/progress-photos-screen';
import { getStrength } from '@/lib/progress/strength';
import { getPrediction } from '@/lib/prediction/read';
import { weightGoalFromKg } from '@/lib/goals/weight-goal';
import { createServiceClient } from '@/lib/supabase/service';
import { LegacySnapshotCard } from '@/components/legacy/legacy-snapshot-card';

export const dynamic = 'force-dynamic';

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}): Promise<ReactElement> {
  const ctx = await requireAuthOrPaused();
  const sp = await searchParams;
  // Every previous value still resolves. /you links ?tab=body and the handoff's Photos entry point
  // is ?tab=gallery, so widening the vocabulary must not orphan either.
  const TABS: Tab[] = ['overview', 'body', 'strength', 'gallery', 'compare'];
  const initialTab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : 'overview';
  const tz = await getProfileTimezone(ctx.userId);

  const [photos, body, snapshot, strength, prediction, goalRows] = await Promise.all([
    listPhotosAction(),
    getBodyStats(ctx.userId, tz),
    // Claimed legacy clients see a read-only "journey so far" card; null for everyone else.
    ctx.companyId ? getLegacySnapshot(ctx.userId, ctx.companyId) : Promise.resolve(null),
    getStrength(ctx.userId),
    // Time to goal. Already computed for Today; Progress is where the handoff actually asks for it.
    ctx.companyId ? getPrediction(ctx.userId, ctx.companyId) : Promise.resolve(null),
    // Her onboarding start and latest logged weight, the two inputs the shared goal helper takes.
    (async () => {
      const svc = createServiceClient();
      return Promise.all([
        svc
          .from('onboarding_responses')
          .select('answers')
          .eq('profile_id', ctx.userId)
          .maybeSingle(),
        svc
          .from('weight_entries')
          .select('weight_kg')
          .eq('profile_id', ctx.userId)
          .order('recorded_on', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
    })(),
  ]);

  const [{ data: onb }, { data: lw }] = goalRows;
  const answers = (onb?.answers ?? null) as { weightKg?: number; goalWeightKg?: number } | null;
  const goal = weightGoalFromKg(
    answers?.weightKg,
    answers?.goalWeightKg,
    lw ? Number(lw.weight_kg) : null,
  );

  return (
    <>
      {snapshot ? (
        <div className="mx-auto max-w-lg px-[22px] pt-6">
          <LegacySnapshotCard snapshot={snapshot} />
        </div>
      ) : null}
      <ProgressPhotosScreen
        initialPhotos={photos}
        profileId={ctx.userId}
        body={body}
        goal={goal}
        weeksToGo={prediction?.goal.weeksToGo ?? null}
        strength={strength}
        initialTab={initialTab}
      />
    </>
  );
}
