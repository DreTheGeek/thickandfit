'use client';

import { useState, type ReactElement } from 'react';
import { Icon } from '@/components/ui/icons';
import { COACH_COPY } from '@/lib/lessons/copy';

/**
 * A lesson video, playing from the private bucket.
 *
 * Same shape as ExerciseDemo and for the same reasons: `preload="metadata"` fetches the header for
 * the poster frame and duration without pulling the file, so opening a lesson costs kilobytes
 * rather than the 40 MB some of these run to. The signed URL is minted per request and expires.
 *
 * Landscape rather than the 9:16 of a filmed demo: these are screen recordings and talking-head
 * explainers, not phone-shot movements.
 */
export function LessonVideo({ url, title }: { url: string | null; title: string }): ReactElement {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl bg-warm text-center">
        <Icon name="camera" size={26} />
        <span className="px-6 text-[12px] text-muted">{COACH_COPY.assetMissing}</span>
      </div>
    );
  }

  return (
    <video
      controls
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
      aria-label={title}
      className="aspect-video w-full rounded-2xl bg-black object-contain"
      src={url}
    />
  );
}
