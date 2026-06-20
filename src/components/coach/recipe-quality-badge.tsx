import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import type { QualityBand } from '@/lib/coach/recipes-types';

// 3-band quality pill. Color-coded against the design tokens: alert for needs-review,
// warm/muted for usable, accent for high quality. Works in both server + client trees.
const BAND_STYLE: Record<QualityBand, string> = {
  needs_review: 'bg-alert/15 text-alert',
  usable: 'bg-warm text-soft',
  high: 'bg-accent/15 text-accent',
};

export function RecipeQualityBadge({
  band,
  score,
  showScore = false,
  className = '',
}: {
  band: QualityBand;
  score?: number;
  showScore?: boolean;
  className?: string;
}): ReactElement {
  const t = useTranslations('app.coach');
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${BAND_STYLE[band]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(`recipeQuality_${band}`)}
      {showScore && score != null && <span className="opacity-60">{score}</span>}
    </span>
  );
}
