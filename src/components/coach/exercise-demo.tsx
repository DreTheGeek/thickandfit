'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';

/**
 * Her filmed demo, playing inside her own app.
 *
 * "i dont see her recorded video in this software anywhere." She was right: 366 of her 367
 * movements carried a Lenus video key and nothing here could play one, so years of footage were
 * invisible in the product built around them.
 *
 * `preload="metadata"` on purpose: it fetches the header for the poster frame and duration without
 * pulling the whole file, so opening a movement costs a few kilobytes rather than a megabyte and a
 * half. The signed URL is minted per request and expires in an hour.
 */
export function ExerciseDemo({ url, name }: { url: string | null; name: string }): ReactElement {
  const t = useTranslations('app.coach');
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    // Honest empty state. 80 of her keys 403 on Lenus and were never downloadable, so "not filmed
    // yet" is the truth for those rows, not an error to apologise for.
    return (
      <div className="flex aspect-[9/16] max-h-[420px] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-warm text-center">
        <Icon name="camera" size={26} />
        <span className="px-6 text-[12px] text-muted">{failed ? t('demoFailed') : t('demoNone')}</span>
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
