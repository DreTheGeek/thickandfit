'use client';
// Coverage checklist: what should work, what it connects to, and what action produces what reaction.
// Ported out of the coach portal's App Health page when that page merged into /admin/health. Client
// component only for the status filter; the data is a static map, so nothing is fetched here.
//
// Colour is state, not decoration: green = live, amber = partial, grey = planned.
import { useMemo, useState, type ReactElement } from 'react';
import { coverageByArea, coverageTotals, type CoverageItem, type CoverageStatus } from '@/lib/admin/system-map';

const TONE: Record<CoverageStatus, { dot: string; text: string; label: string }> = {
  live: { dot: '#1F7A46', text: 'text-[#1F7A46]', label: 'Live' },
  partial: { dot: '#B98A1C', text: 'text-[#B98A1C]', label: 'Partial' },
  planned: { dot: '#9A958D', text: 'text-faint', label: 'Planned' },
};

type Filter = CoverageStatus | 'all';

export function CoverageView(): ReactElement {
  const [filter, setFilter] = useState<Filter>('all');
  const totals = useMemo(() => coverageTotals(), []);
  const groups = useMemo(
    () =>
      coverageByArea()
        .map((g) => ({ area: g.area, items: g.items.filter((i) => filter === 'all' || i.status === filter) }))
        .filter((g) => g.items.length > 0),
    [filter],
  );

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: totals.live + totals.partial + totals.planned },
    { key: 'live', label: 'Live', count: totals.live },
    { key: 'partial', label: 'Partial', count: totals.partial },
    { key: 'planned', label: 'Planned', count: totals.planned },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            className={[
              'tf-press rounded-full border px-3.5 py-1.5 text-[12px] font-semibold',
              filter === c.key ? 'border-ink bg-ink text-surface' : 'border-line text-muted hover:border-ink hover:text-ink',
            ].join(' ')}
          >
            {c.label} <span className={filter === c.key ? 'opacity-70' : 'text-faint'}>{c.count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <section key={group.area}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">{group.area}</h3>
            <div className="overflow-hidden rounded-xl border border-line bg-bg">
              {group.items.map((it: CoverageItem, i) => {
                const tone = TONE[it.status];
                return (
                  <div
                    key={`${group.area}-${it.name}`}
                    className={['px-4 py-3', i < group.items.length - 1 ? 'border-b border-divider' : ''].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-ink">{it.name}</div>
                        {it.route ? <div className="font-mono text-[11px] text-faint">{it.route}</div> : null}
                      </div>
                      <span className={['inline-flex shrink-0 items-center gap-2 text-[12px] font-semibold', tone.text].join(' ')}>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: tone.dot }} aria-hidden />
                        {tone.label}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-1 text-[12px] sm:grid-cols-2">
                      <div className="text-soft">
                        <span className="text-faint">Action: </span>
                        {it.action}
                      </div>
                      <div className="text-soft">
                        <span className="text-faint">Reaction: </span>
                        {it.reaction}
                      </div>
                    </div>
                    {it.connects.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {it.connects.map((c) => (
                          <span key={c} className="rounded-full bg-warm px-2 py-0.5 text-[10px] font-medium text-muted">
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {it.notes ? <div className="mt-1.5 text-[11px] italic text-faint">{it.notes}</div> : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
