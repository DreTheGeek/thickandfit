'use client';
// Error state with optional retry. Interactive, so it is a Client Component.
import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}): ReactElement {
  const t = useTranslations('common');
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="h-1 w-12 bg-ink" />
      <h3 className="tf-display text-[28px] text-ink">{t('errorTitle')}</h3>
      <p className="max-w-sm text-sm text-muted">{message ?? t('errorBody')}</p>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          {t('tryAgain')}
        </Button>
      ) : null}
    </div>
  );
}
