'use client';

import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icons';
import { StatusPill } from '@/components/coach/status-pill';
import { formatCents } from '@/components/coach/money';
import { useClientFilterUrl } from '@/components/coach/use-client-filters';
import { healthLabel } from '@/components/coach/client-labels';
import { NONE_KEY, type ClientRow, type SortField } from '@/lib/coach/clients-types';

function planLabel(t: (k: string) => string, p: string | null): string {
  if (p === 'personalCoaching') return t('planPersonalCoaching');
  if (p === 'bootcamp') return t('planBootcamp');
  if (p === 'basic') return t('planBasic');
  return '-';
}

function fmtDate(value: string | null, locale: string): string {
  if (!value) return '-';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

function Th({
  children,
  field,
  active,
  dir,
  onSort,
  className = '',
  align = 'left',
}: {
  children: React.ReactNode;
  field?: SortField;
  active?: boolean;
  dir?: 'asc' | 'desc';
  onSort?: (f: SortField) => void;
  className?: string;
  align?: 'left' | 'right';
}): ReactElement {
  const base = `px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[1px] text-faint ${align === 'right' ? 'text-right' : 'text-left'} ${className}`;
  if (!field) return <th className={base}>{children}</th>;
  return (
    <th className={base}>
      <button
        type="button"
        onClick={() => onSort?.(field)}
        className={`tf-press inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''} ${active ? 'text-ink' : 'hover:text-ink'}`}
      >
        {children}
        {active && <Icon name={dir === 'asc' ? 'chevronRight' : 'chevronRight'} size={11} className={dir === 'asc' ? '-rotate-90' : 'rotate-90'} />}
      </button>
    </th>
  );
}

export function ClientsTable({
  rows,
  totalAll,
  sort,
  dir,
  locale,
  pending,
}: {
  rows: ClientRow[];
  totalAll: number;
  sort: SortField;
  dir: 'asc' | 'desc';
  locale: string;
  pending: boolean;
}): ReactElement {
  const t = useTranslations('app.coach');
  const router = useRouter();
  const { setSort, sp } = useClientFilterUrl();
  const open = (id: string): void => {
    const qs = sp.toString();
    router.push(qs ? `/coach/clients/${id}?from=${encodeURIComponent(qs)}` : `/coach/clients/${id}`);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line bg-warm/40">
              <Th field="name" active={sort === 'name'} dir={dir} onSort={setSort}>
                {t('colMember')}
              </Th>
              <Th>{t('colStatus')}</Th>
              <Th className="hidden lg:table-cell">{t('facetBillingHealth')}</Th>
              <Th className="hidden sm:table-cell">{t('colPlan')}</Th>
              <Th className="hidden lg:table-cell">{t('colTags')}</Th>
              <Th field="mrr" active={sort === 'mrr'} dir={dir} onSort={setSort} align="right">
                {t('colMrr')}
              </Th>
              <Th field="lifetime" active={sort === 'lifetime'} dir={dir} onSort={setSort} align="right" className="hidden md:table-cell">
                {t('colLifetime')}
              </Th>
              <Th className="hidden lg:table-cell">{t('colOwner')}</Th>
              <Th field="started" active={sort === 'started'} dir={dir} onSort={setSort} className="hidden lg:table-cell">
                {t('colJoined')}
              </Th>
            </tr>
          </thead>
          <tbody className={pending ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => open(r.id)}
                className="tf-press cursor-pointer border-b border-divider last:border-0 hover:bg-warm/50"
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar initials={r.initials} size={32} />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-ink">{r.name}</div>
                      <div className="truncate text-[12px] text-faint">{r.email ?? r.phone ?? '-'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <StatusPill status={r.status} health={r.billingHealth} />
                </td>
                <td className="hidden px-3 py-2.5 text-[13px] text-soft lg:table-cell">
                  {r.billingHealth ? healthLabel(t, r.billingHealth) : <span className="text-faint">{healthLabel(t, NONE_KEY)}</span>}
                </td>
                <td className="hidden px-3 py-2.5 text-[13px] text-soft sm:table-cell">{planLabel(t, r.productType)}</td>
                <td className="hidden px-3 py-2.5 lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {r.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag.slug}
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-soft"
                        style={{ borderColor: `${tag.color}55` }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                        {tag.label}
                      </span>
                    ))}
                    {r.tags.length > 2 && <span className="text-[11px] text-faint">+{r.tags.length - 2}</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-[13px] font-semibold tabular-nums">
                  {r.priceCents != null ? formatCents(r.priceCents, r.currency, locale) : '-'}
                </td>
                <td className="hidden px-3 py-2.5 text-right text-[13px] tabular-nums text-soft md:table-cell">
                  {formatCents(r.lifetimeCents, r.currency, locale)}
                </td>
                <td className="hidden px-3 py-2.5 text-[13px] capitalize text-soft lg:table-cell">{r.owner ?? '-'}</td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 text-[13px] text-soft lg:table-cell">{fmtDate(r.startedAt, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="px-4 py-16 text-center text-sm text-faint">
          {totalAll === 0 ? t('noClients') : t('noClientsFiltered')}
        </div>
      )}
    </div>
  );
}
