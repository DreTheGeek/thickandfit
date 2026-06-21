'use client';

import { useMemo, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { UnderlineTabs, type TabOption } from '@/components/ui/tabs';
import type { SystemHealth, ServiceStatus } from '@/lib/coach/system-health';
import { coverageByArea, coverageTotals, type CoverageItem, type CoverageStatus } from '@/lib/coach/system-map';

type Tab = 'status' | 'coverage';

const DOT: Record<ServiceStatus | CoverageStatus, { dot: string; text: string }> = {
  operational: { dot: 'bg-accent', text: 'text-accent-ink' },
  configured: { dot: 'bg-accent', text: 'text-accent-ink' },
  live: { dot: 'bg-accent', text: 'text-accent-ink' },
  partial: { dot: 'bg-[#E0A53B]', text: 'text-[#B5781A]' },
  planned: { dot: 'bg-line', text: 'text-faint' },
  down: { dot: 'bg-alert', text: 'text-alert-ink' },
};

function StatusDot({ status, label }: { status: ServiceStatus | CoverageStatus; label: string }): ReactElement {
  const m = DOT[status];
  return (
    <span className={['inline-flex shrink-0 items-center gap-2 text-[12px] font-semibold', m.text].join(' ')}>
      <span className={['h-2 w-2 rounded-full', m.dot].join(' ')} />
      {label}
    </span>
  );
}

export function HealthView({ health }: { health: SystemHealth }): ReactElement {
  const t = useTranslations('app.coach');
  const [tab, setTab] = useState<Tab>('status');
  const [cov, setCov] = useState<CoverageStatus | 'all'>('all');

  const totals = useMemo(() => coverageTotals(), []);
  const filtered = useMemo(() => coverageByArea().map((g) => ({ area: g.area, items: g.items.filter((i) => cov === 'all' || i.status === cov) })).filter((g) => g.items.length > 0), [cov]);

  const sLabel = (s: ServiceStatus | CoverageStatus): string =>
    s === 'operational' ? t('statusOperational')
      : s === 'configured' ? t('statusConfigured')
        : s === 'live' ? t('statusLive')
          : s === 'partial' ? t('statusPartial')
            : s === 'down' ? t('statusDown')
              : t('statusPlanned');

  const options: TabOption<Tab>[] = [
    { value: 'status', label: t('healthTabStatus') },
    { value: 'coverage', label: t('healthTabCoverage') },
  ];

  const covChips: { key: CoverageStatus | 'all'; label: string; count: number }[] = [
    { key: 'all', label: t('coverageAll'), count: totals.live + totals.partial + totals.planned },
    { key: 'live', label: t('statusLive'), count: totals.live },
    { key: 'partial', label: t('statusPartial'), count: totals.partial },
    { key: 'planned', label: t('statusPlanned'), count: totals.planned },
  ];

  return (
    <div>
      <UnderlineTabs options={options} value={tab} onChange={setTab} className="mb-6" />

      {tab === 'status' && (
        <div className="flex flex-col gap-6">
          {/* Live data counts */}
          <section>
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[1px] text-faint">{t('healthData')}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {health.data.map((d) => (
                <div key={d.key} className="rounded-2xl border border-line bg-surface p-4">
                  <div className="font-display text-[26px] leading-none tabular-nums">{d.value}</div>
                  <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-faint">{d.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Services */}
          <section>
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[1px] text-faint">{t('systemStatus')}</h2>
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              {health.services.map((s, i) => (
                <div key={s.key} className={['flex items-center justify-between gap-3 px-5 py-3.5', i < health.services.length - 1 ? 'border-b border-divider' : ''].join(' ')}>
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium">{s.name}</div>
                    <div className="truncate text-[12px] text-faint">{s.detail}</div>
                  </div>
                  <StatusDot status={s.status} label={sLabel(s.status)} />
                </div>
              ))}
            </div>
          </section>

          {/* Automation + deploy */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[1px] text-faint">{t('healthAutomation')}</h2>
              <div className="flex items-center justify-between border-b border-divider py-2 text-[13px]">
                <span className="text-faint">{t('lastSync')}</span>
                <span className="font-medium">{health.automation.ghlLastSyncLabel}</span>
              </div>
              <div className="flex items-center justify-between py-2 text-[13px]">
                <span className="text-faint">{t('cronSchedule')}</span>
                <span className="font-medium tabular-nums">{health.automation.ghlCron}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[1px] text-faint">{t('healthDeploy')}</h2>
              <div className="flex items-center justify-between border-b border-divider py-2 text-[13px]">
                <span className="text-faint">{t('deployEnv')}</span>
                <span className="font-medium capitalize">{health.deploy.env}</span>
              </div>
              <div className="flex items-center justify-between border-b border-divider py-2 text-[13px]">
                <span className="text-faint">{t('deployCommit')}</span>
                <span className="font-mono text-[12px]">{health.deploy.commit ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between py-2 text-[13px]">
                <span className="text-faint">{t('deployRegion')}</span>
                <span className="font-medium">{health.deploy.region ?? '—'}</span>
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === 'coverage' && (
        <div className="flex flex-col gap-4">
          <p className="rounded-xl bg-warm px-4 py-3 text-[13px] text-soft">{t('coverageIntro')}</p>
          <div className="flex flex-wrap gap-2">
            {covChips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCov(c.key)}
                className={['tf-press rounded-full border px-3.5 py-1.5 text-[12px] font-semibold', cov === c.key ? 'border-ink bg-ink text-bg' : 'border-line text-muted'].join(' ')}
              >
                {c.label} <span className={cov === c.key ? 'text-bg/70' : 'text-faint'}>{c.count}</span>
              </button>
            ))}
          </div>

          {filtered.map((group) => (
            <section key={group.area}>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">{group.area}</h2>
              <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                {group.items.map((it: CoverageItem, i) => (
                  <div key={it.name} className={['px-5 py-3.5', i < group.items.length - 1 ? 'border-b border-divider' : ''].join(' ')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold">{it.name}</div>
                        {it.route && <div className="font-mono text-[11px] text-faint">{it.route}</div>}
                      </div>
                      <StatusDot status={it.status} label={sLabel(it.status)} />
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-1 text-[12px] sm:grid-cols-2">
                      <div className="text-soft"><span className="text-faint">{t('colAction')}: </span>{it.action}</div>
                      <div className="text-soft"><span className="text-faint">{t('colReaction')}: </span>{it.reaction}</div>
                    </div>
                    {it.connects.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {it.connects.map((c) => (
                          <span key={c} className="rounded-full bg-warm px-2 py-0.5 text-[10px] font-medium text-muted">{c}</span>
                        ))}
                      </div>
                    )}
                    {it.notes && <div className="mt-1.5 text-[11px] italic text-faint">{it.notes}</div>}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
