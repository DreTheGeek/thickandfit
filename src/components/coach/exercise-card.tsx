'use client';

import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { ExerciseFavoriteButton } from '@/components/coach/exercise-favorite-button';
import { ExerciseFilmedButton } from '@/components/coach/exercise-filmed-button';
import { slugLabel, type SlugTranslator } from '@/lib/exercises/labels';
import type { ExerciseRow } from '@/lib/coach/exercises';

/**
 * One movement in her library.
 *
 * WHAT CHANGED AND WHY. The old card was a 44px icon, a truncated name, and a subtitle reading
 * `[muscleGroup, equipment].join(' · ')` which is EMPTY on 98% of her rows, plus an "Owned by me"
 * pill that appeared on every single one. So a grid of 367 cards was 367 near-identical white
 * pills carrying two icons and, usually, no second line at all.
 *
 * Three fixes, in order of how much they matter:
 *
 * 1. HER FOOTAGE IS ON THE CARD. She filmed 366 of these and the library showed an icon. A still
 *    from the actual clip is the difference between a list of names and a library.
 * 2. THE SUBTITLE LEADS WITH HER CUES. `cues` was already loaded by the query and had never been
 *    rendered anywhere but the detail page. Her written coaching note is what makes this HER
 *    library; muscle and equipment are the fallback, not the headline.
 * 3. THE NAME WRAPS. Her names differ at the END - "Cable Pull Through" vs "Cable Pull
 *    Through-hamstrings" - so truncation removes the only part that identifies them.
 */

/**
 * The still, and the reason it is a video element rather than an image.
 *
 * There is no stored poster for these clips, so the frame comes from a media fragment: `#t=0.5`
 * seeks half a second in, past the black frame most encoders put at zero. `preload="metadata"`
 * pulls the header only, a few KB, which is the same choice exercise-demo.tsx already made.
 *
 * Hovering scrubs. Choosing between two movements with near-identical names is exactly when a coach
 * wants to see one move, and it costs nothing to offer.
 *
 * THE FALLBACK IS NOT A STOCK PHOTO. The programs page uses a brand image because a program has no
 * canonical picture; an exercise does. Putting a photograph of a deadlift on "Banded fire hydrants"
 * asserts something false. No footage means the dumbbell tile, which reads as "not filmed" and is
 * true.
 */
function ExerciseThumb({ url, name }: { url: string | null; name: string }): ReactElement {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <span className="grid h-[84px] w-[84px] flex-none place-items-center bg-warm text-soft">
        <Icon name="dumbbell" size={22} />
      </span>
    );
  }
  return (
    <span className="relative h-[84px] w-[84px] flex-none overflow-hidden bg-black">
      <video
        src={`${url}#t=0.5`}
        preload="metadata"
        muted
        playsInline
        aria-label={name}
        onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
        onMouseLeave={(e) => {
          e.currentTarget.pause();
          e.currentTarget.currentTime = 0.5;
        }}
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
      <span className="pointer-events-none absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-white">
        <Icon name="play" size={10} />
      </span>
    </span>
  );
}

export function ExerciseCard({
  row,
  demoUrl,
}: {
  row: ExerciseRow;
  demoUrl: string | null;
}): ReactElement {
  const t = useTranslations('app.coach');
  const tl = useTranslations('app.library');

  // Her note first. It is the only line on this card that could not appear in anybody else's app.
  const meta = [
    slugLabel(tl as unknown as SlugTranslator, row.muscleGroup, 'muscles'),
    slugLabel(tl as unknown as SlugTranslator, row.equipment, 'equipmentTypes'),
  ]
    .filter(Boolean)
    .join(' · ');
  const subtitle = row.cues?.trim() || meta;

  return (
    <div className="group relative flex items-stretch overflow-hidden rounded-2xl bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.10)]">
      <Link href={`/coach/exercises/${row.id}`} className="tf-press flex min-w-0 flex-1 items-stretch">
        <ExerciseThumb url={demoUrl} name={row.name} />
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3.5 py-2.5">
          {/* Wraps. See the header: her names differ at the end. */}
          <span className="text-[14px] font-semibold leading-snug text-ink">{row.name}</span>
          {subtitle && <span className="line-clamp-2 text-[12px] leading-snug text-muted">{subtitle}</span>}
          {/* Only when it adds something. A second line repeating the first is worse than one line. */}
          {row.cues?.trim() && meta && (
            <span className="text-[11px] capitalize text-faint">{meta}</span>
          )}
        </span>
      </Link>
      <span className="flex flex-none items-center gap-0.5 pr-2">
        {/* The camera only appears on her own rows. The seed library is not hers to film, and the
            action rejects those ids anyway, so rendering a control that could only ever fail would
            be the same kind of lie as a checklist that says "saved" and did not. */}
        {row.isCoachAuthored && (
          <ExerciseFilmedButton exerciseId={row.id} initial={row.filmedAt != null || row.hasDemo} />
        )}
        <ExerciseFavoriteButton exerciseId={row.id} initial={row.isFavorite} />
      </span>
      {/* "Owned by me" used to sit here. With "My exercises" on by default it appeared on every
          visible row, which is the same no-information wallpaper as 41 cards each badged
          "Template" on the programs page. Removed rather than restyled. */}
      <span className="sr-only">{row.hasDemo ? t('exercisesHasDemo') : ''}</span>
    </div>
  );
}
