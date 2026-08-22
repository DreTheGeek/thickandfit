'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';

/**
 * Her filmed demo, on the member's side of the app.
 *
 * A near-twin of `coach/exercise-demo.tsx` and deliberately its own file rather than a shared one:
 * the two differ in the strings (a member is not reading "your cues") and in the ground they sit
 * on, and the coach console and the portal are separate palettes on purpose. Sharing it would mean
 * threading a locale namespace and a surface token through a component whose whole job is to play
 * one video.
 *
 * `preload="metadata"` fetches the header for the poster frame and duration without pulling the
 * file, so opening a movement costs a few kilobytes rather than a megabyte and a half. The signed
 * URL is minted per request and expires in an hour.
 */
export function MemberExerciseDemo({
  url,
  name,
  hasDemo,
}: {
  url: string | null;
  name: string;
  hasDemo: boolean;
}): ReactElement {
  const t = useTranslations('app.activities');
  const [failed, setFailed] = useState(false);

  if (!hasDemo || !url || failed) {
    // Honest, and two different sentences. 80 of her Lenus keys 403'd and were never downloadable,
    // so "not filmed yet" is the TRUTH for those rows rather than an error to apologise for. A row
    // that has a path the bucket cannot serve is a different thing and says so.
    return (
      <div className="flex aspect-[9/16] max-h-[420px] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-surface text-center">
        <Icon name="camera" size={26} className="text-faint" />
        <span className="px-8 text-[12px] leading-relaxed text-muted">
          {failed ? t('demoFailed') : t('demoNone')}
        </span>
      </div>
    );
  }

  return (
    <video
      controls
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
      aria-label={name}
      className="aspect-[9/16] max-h-[420px] w-full rounded-2xl bg-black object-contain"
    >
      <source src={url} type="video/mp4" />
    </video>
  );
}
