'use client';
// 'use client' is REQUIRED, and its absence is the bug the first version of this screen shipped
// with: useTranslations is the client hook, this is rendered from an async server page, and the
// result was a 500 behind "Something went wrong" on every visit. tsc, eslint and `next build` were
// all green, because nothing about the call is statically wrong; only opening the page shows it.
// The alternative was getTranslations from next-intl/server, but the component holds Links and no
// data access, so the client boundary is the cheaper of the two and matches train-cards.tsx.
//
// The screen between "today's workout" and being mid-set.
//
// It closes the biggest real gap in the 8.0 handoff's main file. Until now every route into a
// session went straight to the live player: the Train banner AND every exercise row linked to
// /workout/{planId}?day={n}, so tapping a movement out of curiosity dropped her into a running
// workout. There was no screen that answered "what am I about to do, do I have the equipment, and
// have I got time", which is the decision she actually makes before starting.
//
// Four of the handoff's eight elements. The other four are deliberately absent, and the reasoning is
// worth keeping because each looks free and is not:
//   Save      saved WHERE? Workouts are coach-assigned, not browsed from a catalogue. Favourites
//             exist for exercises and recipes, not sessions.
//   Schedule  the program engine owns the schedule. Letting a member move a session breaks the plan
//             structure her coach wrote, and there is no reschedule model to move it within.
//   Share     plausible later, but it needs an OG image and a public URL for a private session.
//   Download  this is a sprint disguised as an icon: offline video from a PRIVATE bucket behind
//             expiring signed URLs, plus a storage-quota UI and an eviction policy. The underlying
//             need is already half-met, because the player holds a Wake Lock and its draft survives
//             a reload, so losing signal mid-workout does not lose her sets.
//
// A tapped icon that does nothing is worse than an absent one.
import Link from 'next/link';
import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { PortalCard, PortalLabel } from '@/components/portal/today-cards';
import { PortalButton, PortalStatRow } from '@/components/portal/portal-chrome';
import { shootImage } from '@/components/portal/train-cards';
import { Icon } from '@/components/ui/icons';

export type PreviewExercise = {
  exercise_id: string;
  name: string;
  sets: number | null;
  reps: number | null;
  repsMin: number | null;
  repsMax: number | null;
  restSec: number | null;
  /** A prescribed duration, where the movement is timed rather than counted. */
  timeSec: number | null;
  equipment: string | null;
  hasDemo: boolean;
  /** Superset / circuit grouping, used for the handoff's section headings. */
  groupKey: string | null;
  groupKind: string | null;
};

/**
 * Estimated time, from the prescription she is about to perform.
 *
 * NOT a data gap, which is how it first looked. Every session exercise already carries sets, reps
 * and rest_sec, so both figures are arithmetic. The one judgement is SECONDS_PER_REP: a tempo
 * constant standing in for how long a rep takes, which is genuinely unknowable per person and per
 * movement. 4s is a deliberately unfussy middle for a controlled lift.
 *
 * Reported as "about", and rounded to 5 minutes, because a number like "37 min" claims a precision
 * this does not have. Active excludes rest; total includes it, which is the difference between
 * "how long am I working" and "when am I leaving".
 */
/**
 * Per-rep tempo. Two of them, because a rep is not one thing.
 *
 * 4s is a controlled lift: down, pause, up. Applying it to everything is what made a jump-rope row
 * of 500 skips estimate at 33 minutes. Above CYCLIC_THRESHOLD reps the movement is not a lift at
 * all, it is conditioning (skips, marches, steps), where a rep is under a second. Her library has
 * eight such rows and every one is jump rope at 300 to 500.
 */
const SECONDS_PER_REP = 4;
const CYCLIC_SECONDS_PER_REP = 0.5;
const CYCLIC_THRESHOLD = 50;
const DEFAULT_REST_SEC = 60;

export function estimateSession(exercises: PreviewExercise[]): { activeMin: number; totalMin: number } {
  let activeSec = 0;
  let restSec = 0;
  for (const e of exercises) {
    const sets = e.sets ?? 1;
    if (e.timeSec != null && e.timeSec > 0) {
      // A prescribed duration beats any tempo guess, and 271 rows in her library carry one: the
      // cardio machines, where reps are meaningless and the plan says "20 minutes".
      activeSec += sets * e.timeSec;
    } else {
      // A rep range estimates at its top: the plan asks for "8-10" and finishing the set is 10.
      const reps = e.repsMax ?? e.reps ?? e.repsMin ?? 10;
      const tempo = reps > CYCLIC_THRESHOLD ? CYCLIC_SECONDS_PER_REP : SECONDS_PER_REP;
      activeSec += sets * reps * tempo;
    }
    // Rest happens BETWEEN sets, so a single set rests zero times. Getting this wrong is how an
    // estimate quietly inflates by one rest period per movement.
    restSec += Math.max(0, sets - 1) * (e.restSec ?? DEFAULT_REST_SEC);
  }
  const round5 = (sec: number): number => Math.max(5, Math.round(sec / 60 / 5) * 5);
  return { activeMin: round5(activeSec), totalMin: round5(activeSec + restSec) };
}

/** "3 x 8-10", or "3 x 10", or "6" for a movement with no prescribed sets. */
function prescription(e: PreviewExercise): string {
  const range = e.repsMin != null && e.repsMax != null && e.repsMin !== e.repsMax
    ? `${e.repsMin}-${e.repsMax}`
    : e.reps != null
      ? String(e.reps)
      : null;
  if (e.sets == null) return range ?? '';
  return range ? `${e.sets} × ${range}` : String(e.sets);
}

export function SessionPreview({
  day,
  dayLabel,
  programName,
  weekLine,
  exercises,
  startHref,
}: {
  day: number;
  dayLabel: string;
  programName: string;
  weekLine: string;
  exercises: PreviewExercise[];
  startHref: string;
}): ReactElement {
  const t = useTranslations('app.activities');
  const { activeMin, totalMin } = estimateSession(exercises);

  // The equipment this session actually needs, deduped, so she can tell from the door whether the
  // rack she needs is free. Reads exercises.equipment, a real column since migration 0007.
  const equipment = Array.from(
    new Set(exercises.map((e) => e.equipment).filter((v): v is string => !!v && v !== 'body only')),
  ).slice(0, 6);

  // Section headings from the grouping the program already carries. A superset is a section in the
  // handoff's sense: consecutive rows performed together.
  //
  // Computed UP FRONT rather than by carrying a `lastGroup` variable through the map. Mutating
  // during render is what react-hooks/immutability forbids, and it is right to: with Strict Mode or
  // a partial re-render the carried value is not guaranteed to start clean, so headings could
  // silently stop appearing.
  // group_key is an opaque UUID from her Lenus export, NOT a name. The first version printed it as
  // the heading, so the screen carried "418D67A7-0C65-47FF-9370-9440F19FE1B7" above a pair of
  // banded squats. It is only useful for detecting where one group ends and the next begins; the
  // word comes from group_kind, which is 'superset' on 1,531 rows and null on the rest.
  const rows = exercises.map((e, i) => ({
    e,
    heading:
      e.groupKey && e.groupKey !== (exercises[i - 1]?.groupKey ?? null) && e.groupKind
        ? t(e.groupKind === 'superset' ? 'previewSuperset' : 'previewGroup')
        : null,
  }));

  return (
    <div className="pb-28">
      <div className="relative h-[240px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shootImage(day)} alt="" className="h-full w-full object-cover" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,.92), rgba(0,0,0,.25))' }}
        />
        <Link
          href="/workouts"
          aria-label={t('back')}
          className="tf-press absolute left-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white"
        >
          <Icon name="x" size={18} />
        </Link>
        <div className="absolute inset-x-[22px] bottom-4 z-10">
          <div className="text-[12px] text-white/70">{weekLine}</div>
          <h1 className="tf-display mt-1 text-[32px] leading-[0.95] tracking-[-1px] text-white">
            {dayLabel}
          </h1>
          <div className="mt-1 text-[12px] text-white/70">{programName}</div>
        </div>
      </div>

      <div className="px-[22px] pt-4">
        <PortalStatRow
          order="label-first"
          divider
          stats={[
            { key: 'total', label: t('previewTotalTime'), value: t('previewMinutes', { n: totalMin }) },
            { key: 'active', label: t('previewActiveTime'), value: t('previewMinutes', { n: activeMin }) },
            { key: 'moves', label: t('previewMovements'), value: String(exercises.length) },
          ]}
        />
        {/* Said out loud rather than implied by a tidy number. The estimate assumes a tempo, which
            is the one input here nobody can know. */}
        <p className="mt-2 text-[11px] text-faint">{t('previewEstimateNote')}</p>

        {equipment.length > 0 && (
          <div className="mt-4">
            <PortalLabel>{t('previewEquipment')}</PortalLabel>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {equipment.map((eq) => (
                <span
                  key={eq}
                  className="rounded-full border border-line px-3 py-1 text-[12px] capitalize text-soft"
                >
                  {eq}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 grid gap-2">
          {rows.map(({ e, heading }, i) => {
            return (
              <div key={e.exercise_id + i}>
                {heading && (
                  <div className="mb-1.5 mt-3 first:mt-0">
                    <PortalLabel>{heading}</PortalLabel>
                  </div>
                )}
                <PortalCard className="flex items-center gap-3 p-3">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-[9px] bg-warm text-faint">
                    <Icon name={e.hasDemo ? 'play' : 'dumbbell'} size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[13px]">{e.name}</strong>
                    <small className="block truncate text-faint">
                      {[prescription(e), e.equipment].filter(Boolean).join(' · ')}
                    </small>
                  </span>
                </PortalCard>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky, because the list is long and the one action on this screen must not require
          scrolling back to reach. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg px-[22px] py-3.5">
        <PortalButton href={startHref} variant="action">
          {t('startWorkout')}
        </PortalButton>
      </div>
    </div>
  );
}
