// Today screen cards, 8.0 handoff (.planning/design_handoff/8.0/client-portal.html, data-screen="today").
//
// Presentational only. Every value arrives as a prop from today-screen.tsx, which keeps all of the
// state, the summary refetch and the habit toggles. Nothing here reads the database.
import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import { Icon } from '@/components/ui/icons';

/** The handoff's .card: --surface-2 ground, hairline white border, 20px radius. */
export function PortalCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div className={`rounded-[20px] border border-line bg-surface ${className}`}>{children}</div>
  );
}

/** The handoff's .label: 10px, heavy, uppercase, wide tracking, muted. */
export function PortalLabel({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="text-[10px] font-extrabold uppercase tracking-[0.8px] text-muted">{children}</div>
  );
}

/**
 * Transformation status. The hero of the screen.
 *
 * `photoUrl` is optional and deliberately so. The handoff puts a photo of the member down the right
 * 47%, and the only honest source for that is her own latest progress photo. Rather than fill the
 * slot with a stock body or a picture of Stephanie (which would read as the member's own progress),
 * the card drops the photo panel and lets the copy run full width. It still reads correctly because
 * the copy column is only 60% to begin with.
 */
export function TransformCard({
  labelStatus,
  labelToGoal,
  labelStart,
  labelCurrent,
  labelGoal,
  pct,
  startLb,
  currentLb,
  goalLb,
  photoUrl,
  photoAlt,
}: {
  labelStatus: string;
  labelToGoal: string;
  labelStart: string;
  labelCurrent: string;
  labelGoal: string;
  pct: number;
  startLb: number;
  currentLb: number;
  goalLb: number;
  photoUrl?: string | null;
  photoAlt?: string;
}): ReactElement {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <PortalCard className="relative min-h-[180px] overflow-hidden p-[18px]">
      {photoUrl ? (
        <div className="absolute right-0 top-0 h-full w-[47%]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt={photoAlt ?? ''} className="h-full w-full object-cover object-top" />
          {/* Fades the photo into the card ground so it reads as one surface, not a pasted-in tile. */}
          <div
            aria-hidden
            className="absolute inset-0 z-[2]"
            style={{ background: 'linear-gradient(to right, var(--c-surface), transparent 45%)' }}
          />
        </div>
      ) : null}

      <div className={`relative z-[3] ${photoUrl ? 'w-[60%]' : 'w-full'}`}>
        <PortalLabel>{labelStatus}</PortalLabel>

        <div className="tf-display mt-2 text-[57px] font-black leading-[0.95] tracking-[-3px]">
          {clamped}%
        </div>

        <PortalLabel>{labelToGoal}</PortalLabel>

        <div className="mt-[18px] grid grid-cols-3 gap-2">
          {[
            { v: startLb, l: labelStart },
            { v: currentLb, l: labelCurrent },
            { v: goalLb, l: labelGoal },
          ].map((c) => (
            <div key={c.l}>
              <strong className="block text-[13px] tabular-nums">{c.v}</strong>
              <span className="text-[8px] uppercase tracking-[0.6px] text-faint">{c.l}</span>
            </div>
          ))}
        </div>

        <div className="mt-[13px] h-[5px] overflow-hidden rounded-full bg-warm">
          <i className="block h-full rounded-full bg-ink" style={{ width: `${clamped}%` }} />
        </div>
      </div>
    </PortalCard>
  );
}

export type PlanRow = {
  key: string;
  /** Row title, already translated. Its first letter becomes the tile glyph. */
  title: string;
  sub: string;
  /** A link turns the row into an action; a value renders the figure instead. */
  href?: string;
  action?: string;
  value?: string;
  /** True when the value is a target she has hit. Green is functional only, so this gates it. */
  hit?: boolean;
  /**
   * Makes the whole row a button that opens a capture sheet.
   *
   * MOVE and RECOVER have no href and no server-side source: nothing syncs steps or sleep yet, so
   * the member is the source. Without this the two rows rendered a figure she had no way to enter,
   * which is how the 8.0 Today re-skin silently dropped the capability that dashboard/mission.tsx
   * used to carry. A row that shows a target must offer a way to meet it.
   */
  onCapture?: () => void;
};

/**
 * Today's plan: the four rows the handoff draws as TRAIN / FUEL / MOVE / RECOVER.
 *
 * The handoff puts a single letter in each tile (T, F, M, R). Those are English initials, and this
 * app ships Spanish, so the glyph is taken from the first character of the TRANSLATED title. The
 * design's look survives and Entrenar / Alimentacion / Movimiento / Recuperacion each get their own
 * correct letter instead of an English one.
 */
export function PlanCard({ title, edit, rows }: { title: string; edit?: ReactNode; rows: PlanRow[] }): ReactElement {
  return (
    <PortalCard className="mt-2.5 p-3.5">
      <div className="flex items-center justify-between">
        <PortalLabel>{title}</PortalLabel>
        {edit}
      </div>

      <div className="mt-3 grid gap-2.5">
        {rows.map((r) => {
          const inner = (
            <>
              <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-ink text-[13px] font-black text-bg">
                {r.title.charAt(0).toUpperCase()}
              </span>

              <div className="min-w-0 text-left">
                <strong className="block truncate text-[12px] uppercase">{r.title}</strong>
                <small className="block truncate text-faint">{r.sub}</small>
              </div>

              {r.href && r.action ? (
                <Link
                  href={r.href}
                  className="tf-press rounded-full bg-ink px-3 py-1.5 text-[10px] font-extrabold uppercase text-bg"
                >
                  {r.action}
                </Link>
              ) : r.value ? (
                <strong className={`text-[11px] tabular-nums ${r.hit ? 'text-accent' : 'text-soft'}`}>
                  {r.value}
                </strong>
              ) : r.onCapture ? (
                // No figure yet, so the affordance IS the answer to "how do I put one here".
                <span className="grid h-6 w-6 place-items-center rounded-full border border-line text-faint">
                  <Icon name="plus" size={13} />
                </span>
              ) : null}
            </>
          );

          const shell = 'grid w-full grid-cols-[34px_1fr_auto] items-center gap-2.5';

          // A capture row is tappable even once it holds a value: the number is self-reported, so
          // correcting yesterday's guess has to stay one tap away.
          return r.onCapture ? (
            <button key={r.key} type="button" onClick={r.onCapture} className={`tf-press ${shell}`}>
              {inner}
            </button>
          ) : (
            <div key={r.key} className={shell}>
              {inner}
            </div>
          );
        })}
      </div>
    </PortalCard>
  );
}

/** The two-up row under the plan: next best action, and the live challenge. */
export function SmallCard({
  label,
  heading,
  children,
}: {
  label: string;
  heading: string;
  children?: ReactNode;
}): ReactElement {
  return (
    <PortalCard className="min-h-[110px] p-[13px]">
      <PortalLabel>{label}</PortalLabel>
      <h3 className="mb-2 mt-1 text-[12px] leading-tight">{heading}</h3>
      {children}
    </PortalCard>
  );
}
