// /admin/waitlist/draws — run and audit the giveaway drawings.
//
// Three drawings are planned (2026-07-23 call): early-bird around Aug 18 to restart sharing in the
// middle of the campaign, the main prize when doors open Sept 27, and a founding-members-only final
// when the 5-day window closes.
//
// Everything here is built around one requirement: because entries are earned partly by referral,
// the drawing is a real promotion and the result has to be defensible. Each draw stores its own
// frozen pool, a sha256 of that pool, and the crypto-random seed, so Verify can recompute the
// winner from the record itself. Voided draws are retained with a reason - never deleted.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { AdminPage, Card, Stat } from '@/components/admin/ui';
import { DrawRunner, DrawRowActions } from '@/components/admin/draw-runner';
import { buildPool, listDraws } from '@/lib/admin/waitlist-draw';
import { DEFAULT_FILTERS, type DrawRow } from '@/lib/admin/draw-types';

export const dynamic = 'force-dynamic';

export default async function DrawsPage(): Promise<ReactElement> {
  const ctx = await requireOperator();

  if (!ctx.companyId) {
    return (
      <AdminPage title="Drawings" subtitle="Run and audit the giveaway drawings.">
        <Card>
          <p className="text-[13px] text-muted">No company scope on your account.</p>
        </Card>
      </AdminPage>
    );
  }

  const [pool, draws] = await Promise.all([
    buildPool(ctx.companyId, DEFAULT_FILTERS),
    listDraws(ctx.companyId),
  ]);

  const live = draws.filter((d) => !d.voidedAt);

  return (
    <AdminPage
      title="Drawings"
      subtitle="Weighted by entries, frozen and hashed at draw time, recomputable from the record. Voided draws stay on file."
    >
      <Card title="Eligible pool right now">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Entrants" value={fmt(pool.entrantCount)} sub="confirmed, non-test" />
          <Stat label="Total entries" value={fmt(pool.totalEntries)} sub="the weight pool" />
          <Stat
            label="Avg entries"
            value={pool.entrantCount === 0 ? '-' : (pool.totalEntries / pool.entrantCount).toFixed(1)}
            sub="per entrant"
          />
          <Stat label="Draws run" value={String(live.length)} sub={draws.length > live.length ? `${draws.length - live.length} voided` : 'none voided'} />
        </div>
      </Card>

      <Card title="Run a drawing">
        <DrawRunner eligibleNow={pool.entrantCount} />
      </Card>

      <Card title={`History (${draws.length})`}>
        {draws.length === 0 ? (
          <p className="text-[13px] text-muted">
            No drawings yet. The early-bird is scheduled for around Aug 18 to restart sharing mid-campaign.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {draws.map((d) => (
              <DrawCard key={d.id} draw={d} />
            ))}
          </div>
        )}
      </Card>
    </AdminPage>
  );
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function DrawCard({ draw }: { draw: DrawRow }): ReactElement {
  const voided = Boolean(draw.voidedAt);
  return (
    <div className={`rounded-md border p-3 ${voided ? 'border-line bg-bg opacity-70' : 'border-line bg-surface'}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {voided && (
              <span className="rounded-full bg-alert-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-[1px] text-alert-ink">
                voided
              </span>
            )}
            <span className="text-[13px] font-semibold text-ink">{draw.label}</span>
            <span className="text-[11px] tabular-nums text-faint">
              {draw.drawnAt.slice(0, 16).replace('T', ' ')}
            </span>
          </div>

          <p className="mt-1.5 text-[13px] text-ink">
            Winner: <span className="font-semibold">{draw.winnerName ?? draw.winnerEmail ?? 'unknown'}</span>
            {draw.winnerEmail && draw.winnerName && (
              <span className="text-muted"> ({draw.winnerEmail})</span>
            )}
          </p>

          <p className="mt-1 text-[12px] text-muted">
            {fmt(draw.entrantCount)} entrants / {fmt(draw.totalEntries)} entries
          </p>

          {/* The verification triple, printed so it can be copied into an announcement or a
              response to a challenge without opening the database. */}
          <div className="mt-2 flex flex-col gap-0.5 font-mono text-[10px] leading-snug text-faint">
            <span>seed {draw.seed}</span>
            <span className="break-all">pool {draw.poolHash}</span>
          </div>

          {voided && draw.voidReason && (
            <p className="mt-2 text-[12px] italic text-alert-ink">Voided: {draw.voidReason}</p>
          )}
        </div>

        <DrawRowActions drawId={draw.id} isVoided={voided} />
      </div>
    </div>
  );
}
