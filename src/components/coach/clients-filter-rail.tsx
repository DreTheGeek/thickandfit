'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { useClientFilterUrl } from '@/components/coach/use-client-filters';
import { NONE_KEY, type ClientFacets, type ClientFilters, type Bucket, type TagStat } from '@/lib/coach/clients-types';
import { statusLabelKey } from '@/lib/coach/standing';

type T = (k: string) => string;

function healthLabel(t: T, k: string): string {
  if (k === NONE_KEY) return t('healthLegacy');
  if (k === 'paying-current') return t('healthPayingCurrent');
  if (k === 'lapsed') return t('healthLapsed');
  if (k === 'due-soon/late') return t('healthDueSoonLate');
  if (k === 'no-charges-on-record') return t('healthNoCharges');
  return k;
}
function planLabel(t: T, k: string): string {
  if (k === 'personalCoaching') return t('planPersonalCoaching');
  if (k === 'bootcamp') return t('planBootcamp');
  if (k === 'basic') return t('planBasic');
  return t('statusUnknown');
}
function langLabel(t: T, k: string): string {
  if (k === 'en') return t('english');
  if (k === 'es') return t('spanish');
  return t('statusUnknown');
}
function ownerLabel(k: string): string {
  if (k === NONE_KEY) return '-';
  return k.charAt(0).toUpperCase() + k.slice(1);
}
const CAT_KEY: Record<string, string> = {
  program: 'catProgram',
  tier: 'catTier',
  health: 'catHealth',
  service: 'catService',
  lifecycle: 'catLifecycle',
  language: 'catLanguage',
  special: 'catSpecial',
  custom: 'catCustom',
};

function FacetRow({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  color?: string;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-warm/60"
    >
      <span
        className={[
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
          active ? 'border-ink bg-ink text-white' : 'border-line',
        ].join(' ')}
      >
        {active && <Icon name="check" size={11} />}
      </span>
      {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      <span className={['min-w-0 flex-1 truncate', active ? 'font-semibold text-ink' : 'text-soft'].join(' ')}>{label}</span>
      <span className="shrink-0 text-[12px] text-faint">{count}</span>
    </button>
  );
}

function Group({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }): ReactElement {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-divider py-2 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-faint"
      >
        {title}
        <Icon name="chevronRight" size={12} className={open ? 'rotate-90' : ''} />
      </button>
      {open && <div className="mt-0.5 flex flex-col">{children}</div>}
    </div>
  );
}

export function ClientsFilterRail({
  facets,
  filters,
}: {
  facets: ClientFacets;
  filters: ClientFilters;
}): ReactElement {
  const t = useTranslations('app.coach');
  const { toggleMulti, setParam } = useClientFilterUrl();

  const tagsByCat = new Map<string, TagStat[]>();
  for (const tag of facets.tags) {
    const arr = tagsByCat.get(tag.category) ?? [];
    arr.push(tag);
    tagsByCat.set(tag.category, arr);
  }
  const catOrder = ['program', 'tier', 'health', 'service', 'lifecycle', 'language', 'special', 'custom'];

  const simple = (label: string, items: Bucket[], param: keyof ClientFilters & string, fmt: (k: string) => string): ReactElement | null => {
    if (items.length === 0) return null;
    const active = filters[param] as string[];
    return (
      <Group title={label}>
        {items.map((b) => (
          <FacetRow
            key={b.key}
            label={fmt(b.key)}
            count={b.count}
            active={active.includes(b.key)}
            onClick={() => toggleMulti(param, b.key)}
          />
        ))}
      </Group>
    );
  };

  return (
    <aside className="w-full shrink-0 lg:w-60">
      <div className="rounded-2xl border border-line bg-surface px-2 py-2">
        <Group title={t('facetStanding')}>
          {facets.standing.map((b) => (
            <FacetRow
              key={b.key}
              label={t(b.key === 'healthy' ? 'standingHealthy' : b.key === 'at_risk' ? 'standingAtRisk' : 'standingChurned')}
              count={b.count}
              active={filters.standing.includes(b.key)}
              onClick={() => toggleMulti('standing', b.key)}
            />
          ))}
        </Group>

        {simple(t('facetStatus'), facets.status, 'status', (k) => (k === NONE_KEY ? t('statusUnknown') : t(statusLabelKey(k))))}
        {simple(t('facetBillingHealth'), facets.health, 'health', (k) => healthLabel(t, k))}
        {simple(t('facetPlan'), facets.product, 'product', (k) => planLabel(t, k))}

        {facets.tags.length > 0 && (
          <Group title={t('facetTags')}>
            {catOrder
              .filter((c) => tagsByCat.has(c))
              .map((cat) => (
                <div key={cat} className="mb-1">
                  <div className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-[1px] text-line">{t(CAT_KEY[cat])}</div>
                  {(tagsByCat.get(cat) ?? []).map((tag) => (
                    <FacetRow
                      key={tag.slug}
                      label={tag.label}
                      count={tag.count}
                      color={tag.color}
                      active={filters.tags.includes(tag.slug)}
                      onClick={() => toggleMulti('tags', tag.slug)}
                    />
                  ))}
                </div>
              ))}
          </Group>
        )}

        {simple(t('facetLanguage'), facets.lang, 'lang', (k) => langLabel(t, k))}
        {simple(t('facetOwner'), facets.owner, 'owner', (k) => ownerLabel(k))}
        {simple(t('facetCohort'), facets.cohort, 'cohort', (k) => (k === NONE_KEY ? t('statusUnknown') : k))}

        <Group title={t('facetLegacy')}>
          <FacetRow
            label={t('legacy')}
            count={facets.legacyCount}
            active={filters.legacy === true}
            onClick={() => setParam('legacy', filters.legacy === true ? null : '1')}
          />
        </Group>
      </div>
    </aside>
  );
}
