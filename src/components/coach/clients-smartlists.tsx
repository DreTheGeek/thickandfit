'use client';

import { useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { useClientFilterUrl } from '@/components/coach/use-client-filters';
import { deleteSavedSegment } from '@/lib/coach/segment-actions';
import { SEGMENT_PRESETS, type ClientFilters, type SavedSegment } from '@/lib/coach/clients-types';

export function ClientsSmartLists({
  filters,
  saved,
}: {
  filters: ClientFilters;
  saved: SavedSegment[];
}): ReactElement {
  const t = useTranslations('app.coach');
  const { applyFilterSet } = useClientFilterUrl();
  const [pending, start] = useTransition();
  const active = filters.segment;

  function chip(key: string, label: string, isActive: boolean, onClick: () => void, onDelete?: () => void): ReactElement {
    return (
      <span
        key={key}
        className={[
          'group inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium',
          isActive ? 'border-ink bg-ink text-white' : 'border-line text-soft hover:border-ink hover:text-ink',
        ].join(' ')}
      >
        <button type="button" onClick={onClick} className="tf-press">
          {label}
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className={['tf-press opacity-0 transition-opacity group-hover:opacity-100', isActive ? 'text-white/70' : 'text-faint'].join(' ')}
            aria-label="delete"
          >
            <Icon name="x" size={12} />
          </button>
        )}
      </span>
    );
  }

  return (
    <div className="tf-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {SEGMENT_PRESETS.map((p) =>
        chip(p.slug, t(p.labelKey), active === p.slug, () =>
          applyFilterSet(p.filter as Record<string, unknown>, p.slug),
        ),
      )}
      {saved.map((s) =>
        chip(
          s.slug,
          s.name,
          active === s.slug,
          () => applyFilterSet(s.definition as Record<string, unknown>, s.slug),
          () => start(() => void deleteSavedSegment(s.id)),
        ),
      )}
      {pending && <span className="self-center text-[12px] text-faint">...</span>}
    </div>
  );
}
