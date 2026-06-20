'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Badge, Tag } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icons';

export type CoachSubscriber = {
  id: string;
  name: string;
  email: string;
  role: string;
  legacy: boolean;
  locale: string;
  joined: string;
  workouts: number;
};

type Seg = 'all' | 'spanish' | 'premium' | 'free' | 'legacy';

function initials(name: string, email: string): string {
  const src = (name || email).trim();
  return (
    src
      .split(/\s+|@|\./)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

export function SubscribersList({ rows }: { rows: CoachSubscriber[] }): ReactElement {
  const t = useTranslations('app.coach');
  const [q, setQ] = useState('');
  const [seg, setSeg] = useState<Seg>('all');

  const counts = useMemo(
    () => ({
      all: rows.length,
      spanish: rows.filter((r) => r.locale === 'es').length,
      premium: rows.filter((r) => r.role === 'subscriber').length,
      free: rows.filter((r) => r.role === 'free').length,
      legacy: rows.filter((r) => r.legacy).length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (seg === 'spanish' && r.locale !== 'es') return false;
      if (seg === 'premium' && r.role !== 'subscriber') return false;
      if (seg === 'free' && r.role !== 'free') return false;
      if (seg === 'legacy' && !r.legacy) return false;
      if (needle && !(`${r.name} ${r.email}`.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [rows, q, seg]);

  const chips: { key: Seg; label: string; n: number }[] = [
    { key: 'all', label: t('segAll'), n: counts.all },
    { key: 'spanish', label: t('segSpanish'), n: counts.spanish },
    { key: 'premium', label: t('segPremium'), n: counts.premium },
    { key: 'free', label: t('segFree'), n: counts.free },
    { key: 'legacy', label: t('segLegacy'), n: counts.legacy },
  ];

  return (
    <div>
      {/* Search */}
      <div className="mb-3 flex items-center gap-2 border border-line bg-surface px-3.5 py-3">
        <Icon name="search" size={18} className="text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchSubs')}
          className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
        />
      </div>

      {/* Segment chips */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {chips.map((c) => {
          const active = c.key === seg;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setSeg(c.key)}
              className={[
                'tf-press shrink-0 rounded-full border px-3.5 py-1.5 text-[12px]',
                active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink',
              ].join(' ')}
            >
              {c.label} · {c.n}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {/* header (sm+) */}
        <div className="hidden grid-cols-[2fr_1fr_1fr_0.8fr] gap-3 border-b border-line px-4 py-3 text-[11px] font-semibold uppercase tracking-[1px] text-faint sm:grid">
          <span>{t('colMember')}</span>
          <span>{t('colTier')}</span>
          <span>{t('colJoined')}</span>
          <span>{t('colWorkouts')}</span>
        </div>
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-sm text-faint">{t('noSubscribers')}</p>
        ) : (
          filtered.map((r, i) => (
            <Link
              key={r.id}
              href={`/coach/subscribers/${r.id}`}
              className={[
                'tf-press flex items-center gap-3 px-4 py-3.5 sm:grid sm:grid-cols-[2fr_1fr_1fr_0.8fr] sm:items-center',
                i < filtered.length - 1 ? 'border-b border-divider' : '',
              ].join(' ')}
            >
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar initials={initials(r.name, r.email)} size={34} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold">{r.name}</span>
                  <span className="block truncate text-[12px] text-faint">{r.email}</span>
                </span>
              </span>
              <span className="hidden items-center gap-1.5 sm:flex">
                {r.role === 'free' ? (
                  <Tag outlined={false}>{t('segFree')}</Tag>
                ) : (
                  <Tag>{t('segPremium')}</Tag>
                )}
                {r.legacy && <Badge variant="legacy">{t('legacy')}</Badge>}
              </span>
              <span className="hidden text-[13px] text-muted sm:block">{r.joined}</span>
              <span className="hidden text-[13px] font-semibold sm:block">{r.workouts}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
