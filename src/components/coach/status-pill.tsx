'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { deriveStanding, STANDING_VARIANT, statusLabelKey } from '@/lib/coach/standing';

/** The one canonical client status pill: color from standing, label from raw status. */
export function StatusPill({
  status,
  health,
  className = '',
}: {
  status: string | null;
  health: string | null;
  className?: string;
}): ReactElement {
  const t = useTranslations('app.coach');
  const standing = deriveStanding(status, health);
  return (
    <Badge variant={STANDING_VARIANT[standing]} className={className}>
      {t(statusLabelKey(status))}
    </Badge>
  );
}
