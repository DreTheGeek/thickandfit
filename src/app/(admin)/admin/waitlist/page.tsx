// Admin waitlist campaign dashboard. Aug-4-critical monitoring surface — Rodney and Shakira
// watch this from admin.teamthickandfit.com to catch the funnel stalling before it's a crisis.
// One page, one aggregator (getWaitlistMetrics), all queries head-only where possible so page
// load is cheap even at 5k leads.
//
// Section grammar mirrors kb-funnels doctrine 5's three-branch diagnostic tree:
//   TOP    → total + last24h + last-hour        (traffic — the "not enough visitors" branch)
//   MIDDLE → confirmed / quiz / tier candidates (page conversion + engagement)
//   BOTTOM → referrals + K-factor + top referrers (sharing — the "share loop broken" branch)
// Plus checkpoints (goal-vs-actual) and an ES/EN split.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { AdminPage, Card, Stat } from '@/components/admin/ui';
import { getWaitlistMetrics, type Checkpoint } from '@/lib/admin/waitlist-metrics';

export const dynamic = 'force-dynamic';

export default async function AdminWaitlistPage(): Promise<ReactElement> {
  await requireOperator();
  const m = await getWaitlistMetrics();

  return (
    <AdminPage
      title="Waitlist"
      subtitle="Libra Season — signups, confirmations, quiz completion, referral loop, checkpoint status."
    >
      {/* TOP OF FUNNEL — traffic */}
      <Card title="Signups">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total" value={fmt(m.total)} sub="all-time" />
          <Stat label="Last 24h" value={fmt(m.last24h)} sub={m.lastHour > 0 ? `${fmt(m.lastHour)} in last hour` : 'quiet'} />
          <Stat label="Converted" value={fmt(m.converted)} sub="became paid members" tone={m.converted > 0 ? 'good' : undefined} />
          <Stat label="Unsubscribed" value={fmt(m.unsubscribed)} sub="opted out" tone={m.unsubscribed > 0 ? 'warn' : undefined} />
        </div>
      </Card>

      {/* Checkpoints — goal-vs-actual with tone */}
      <Card title="Checkpoint status">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {m.checkpoints.map((cp) => (
            <CheckpointTile key={cp.label} cp={cp} />
          ))}
        </div>
      </Card>

      {/* Middle: conversion + engagement */}
      <Card title="Engagement">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Confirmed"
            value={fmt(m.confirmed)}
            sub={m.total > 0 ? `${Math.round((m.confirmed / m.total) * 100)}% of total` : '—'}
            tone={m.total > 0 && m.confirmed / m.total >= 0.7 ? 'good' : m.total > 20 && m.confirmed / m.total < 0.5 ? 'warn' : undefined}
          />
          <Stat
            label="Quiz done"
            value={fmt(m.quizCompleted)}
            sub={`${m.quizCompletionPct}% of total`}
            tone={m.quizCompletionPct >= 40 ? 'good' : m.total > 20 && m.quizCompletionPct < 20 ? 'warn' : undefined}
          />
          <Stat
            label="ES / EN split"
            value={`${m.esPct}% ES`}
            sub={`${fmt(m.esCount)} ES · ${fmt(m.enCount)} EN`}
          />
          <Stat
            label="Unconfirmed"
            value={fmt(m.unconfirmed)}
            sub="email pending"
            tone={m.unconfirmed > 0 && m.total > 0 && m.unconfirmed / m.total > 0.5 ? 'warn' : undefined}
          />
        </div>
      </Card>

      {/* Bottom of funnel — share loop */}
      <Card title="Referral loop">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Referrals credited" value={fmt(m.totalReferrals)} sub="+3 entries each" />
          <Stat label="Unique referrers" value={fmt(m.uniqueReferrers)} sub="brought ≥1 friend" />
          <Stat
            label="K-factor"
            value={m.kFactor.toFixed(2)}
            sub={m.kFactor >= 0.5 ? 'viral' : m.kFactor >= 0.3 ? 'healthy' : m.uniqueReferrers > 5 ? 'weak' : 'early'}
            tone={m.kFactor >= 0.5 ? 'good' : m.uniqueReferrers > 20 && m.kFactor < 0.3 ? 'warn' : undefined}
          />
          <Stat
            label="Tier candidates"
            value={fmt(Object.values(m.tierCandidateCounts).reduce((a, b) => a + b, 0))}
            sub={
              Object.keys(m.tierCandidateCounts).length > 0
                ? Object.entries(m.tierCandidateCounts).map(([k, v]) => `${k}:${v}`).join(' · ')
                : 'no quiz flags yet'
            }
          />
        </div>
      </Card>

      {/* Top referrers table — the leaderboard */}
      <Card title={`Top referrers (${m.topReferrers.length})`}>
        {m.topReferrers.length === 0 ? (
          <p className="text-[13px] text-muted">No credited referrals yet. First referrer surfaces here the moment their friend signs up with a ?r=&lt;code&gt; link.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[1px] text-faint">
                  <th className="pb-2 pr-4 font-semibold">#</th>
                  <th className="pb-2 pr-4 font-semibold">Referrer</th>
                  <th className="pb-2 pr-4 font-semibold">Email</th>
                  <th className="pb-2 pr-4 font-semibold text-right">Referrals</th>
                  <th className="pb-2 pr-4 font-semibold text-right">Entries</th>
                  <th className="pb-2 font-semibold">Share code</th>
                </tr>
              </thead>
              <tbody>
                {m.topReferrers.map((r, i) => (
                  <tr key={r.leadId} className="border-t border-line">
                    <td className="py-2.5 pr-4 tabular-nums text-faint">{i + 1}</td>
                    <td className="py-2.5 pr-4 text-ink">{r.firstName ?? '(no name)'}</td>
                    <td className="py-2.5 pr-4 text-muted">{r.email}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-ink tabular-nums">{r.referralCount}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-muted">{r.entryCount}</td>
                    <td className="py-2.5 font-mono text-[12px] text-faint">{r.referralCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminPage>
  );
}

// ────────────────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function CheckpointTile({ cp }: { cp: Checkpoint }): ReactElement {
  const tone: 'good' | 'warn' | 'bad' | undefined =
    cp.status === 'ahead' ? 'good' : cp.status === 'behind' ? 'bad' : cp.status === 'on_track' ? 'good' : undefined;
  const statusLabel =
    cp.status === 'pending' ? 'pending' :
    cp.status === 'ahead' ? '✓ ahead' :
    cp.status === 'on_track' ? '✓ on track' :
    'behind';
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">{cp.label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={[
            'font-display text-[24px] tabular-nums',
            tone === 'good' ? 'text-[#1F7A46]' : tone === 'bad' ? 'text-alert-ink' : 'text-ink',
          ].join(' ')}
        >
          {fmt(cp.actual)}
        </span>
        <span className="text-[12px] text-faint">/ {fmt(cp.targetLo)}–{fmt(cp.targetHi)}</span>
      </div>
      <div
        className={[
          'mt-1 text-[11px] font-semibold',
          tone === 'good' ? 'text-[#1F7A46]' : tone === 'bad' ? 'text-alert-ink' : 'text-faint',
        ].join(' ')}
      >
        {statusLabel}
      </div>
    </div>
  );
}
