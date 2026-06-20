'use client';

import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { createSavedSegment } from '@/lib/coach/segment-actions';
import { filtersToDefinition } from '@/components/coach/client-labels';
import type { ClientFilters } from '@/lib/coach/clients-types';

export function SaveSegmentDialog({
  filters,
  open,
  onClose,
}: {
  filters: ClientFilters;
  open: boolean;
  onClose: () => void;
}): ReactElement | null {
  const t = useTranslations('app.coach');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  if (!open) return null;

  function save(): void {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('smartListName'));
      return;
    }
    start(async () => {
      const res = await createSavedSegment({ name: trimmed, definition: filtersToDefinition(filters) });
      if (res.ok) {
        setName('');
        setError('');
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="tf-display text-[22px]">{t('saveSmartList')}</h2>
          <button type="button" onClick={onClose} className="tf-press text-faint hover:text-ink">
            <Icon name="x" size={18} />
          </button>
        </div>
        <Input
          label={t('smartListName')}
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder={t('smartListName')}
        />
        {error && <p className="mt-2 text-[12px] text-alert-ink">{error}</p>}
        <div className="mt-5 flex gap-2">
          <Button variant="primary" size="sm" onClick={save} disabled={pending} className="flex-1">
            {t('save')}
          </Button>
          <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
            {t('cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}
